import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/src/server/lib/prisma";
import { stripe } from "@/src/server/lib/stripe";

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 });

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  try {
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    if (alreadyProcessed) return NextResponse.json({ received: true, duplicate: true });

    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });

      if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object as Stripe.PaymentIntent;
        const bookingId = intent.metadata?.bookingId;
        if (bookingId) {
          const booking = await tx.booking.findUnique({ where: { id: bookingId } });
          if (booking) {
            await tx.booking.updateMany({ where: { id: bookingId, status: "PENDING" }, data: { status: "CONFIRMED", paidAt: new Date(), paymentFailureMessage: null } });
            await tx.paymentRecord.upsert({
              where: { bookingId },
              create: { bookingId, userId: booking.guestId, stripePaymentIntentId: intent.id, amountCents: booking.totalCents, platformFeeCents: booking.platformFeeCents, hostAmountCents: booking.totalCents - booking.platformFeeCents, currency: booking.currency, status: "SUCCEEDED" },
              update: { status: "SUCCEEDED", stripePaymentIntentId: intent.id }
            });
          }
        }
      }

      if (event.type === "payment_intent.payment_failed") {
        const intent = event.data.object as Stripe.PaymentIntent;
        const bookingId = intent.metadata?.bookingId;
        if (bookingId) {
          // Un fallo de pago no consume la reserva inmediatamente: el huésped puede reintentarlo.
          await tx.booking.updateMany({
            where: { id: bookingId, status: "PENDING" },
            data: { paymentFailureMessage: intent.last_payment_error?.message?.slice(0, 500) ?? "El pago no pudo completarse." },
          });
        }
      }

      if (event.type === "payment_intent.canceled") {
        const intent = event.data.object as Stripe.PaymentIntent;
        const bookingId = intent.metadata?.bookingId;
        if (bookingId) await tx.booking.updateMany({ where: { id: bookingId, status: "PENDING" }, data: { status: "EXPIRED" } });
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const payment = await tx.paymentRecord.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
          if (payment) {
            const refundedCents = charge.amount_refunded ?? payment.refundedCents;
            await tx.paymentRecord.update({ where: { id: payment.id }, data: { refundedCents, status: refundedCents >= payment.amountCents ? "REFUNDED" : refundedCents > 0 ? "PARTIALLY_REFUNDED" : payment.status } });
          }
        }
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Una entrega duplicada concurrente puede perder la carrera del INSERT único.
    if (error instanceof Error && /Unique constraint|unique constraint|P2002/i.test(error.message)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error(error);
    return NextResponse.json({ error: "Error procesando webhook." }, { status: 500 });
  }
}
