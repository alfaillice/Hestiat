import { NextResponse } from "next/server";
import { prisma } from "../../../../../../src/server/lib/prisma";
import { stripe } from "../../../../../../src/server/lib/stripe";
import { getCurrentUser } from "../../../../../../src/server/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    const booking = await prisma.booking.findFirst({ where: { id, guestId: currentUser.id }, include: { listing: true, guest: true } });

    if (!booking) return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
    if (booking.status !== "PENDING") return NextResponse.json({ error: "La reserva ya no está pendiente de pago." }, { status: 409 });
    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      await prisma.booking.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED" } });
      return NextResponse.json({ error: "El tiempo para completar esta reserva ha expirado." }, { status: 409 });
    }
    if (booking.paymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
      return NextResponse.json({ paymentIntentId: existing.id, clientSecret: existing.client_secret, status: existing.status });
    }

    const platformFee = booking.platformFeeCents;

    const intent = await stripe.paymentIntents.create({
      amount: booking.totalCents,
      currency: booking.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },

      metadata: {
        bookingId: booking.id,
        listingId: booking.listingId,
        guestId: booking.guestId,
      },
      description: `Hestiat · ${booking.listing.title ?? "Alojamiento"} · ${booking.id}`,
      receipt_email: booking.guest.email,
    }, { idempotencyKey: `booking-payment:${booking.id}` });

    await prisma.booking.update({
      where: { id },
      data: { paymentIntentId: intent.id },
    });

    return NextResponse.json({ paymentIntentId: intent.id, clientSecret: intent.client_secret });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 500 });
  }
}
