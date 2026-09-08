import { NextResponse } from "next/server";
import { prisma } from "../../../../../../src/server/lib/prisma";
import { getCurrentUser } from "../../../../../../src/server/lib/auth";
import { stripe } from "../../../../../../src/server/lib/stripe";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findFirst({ where: { id, guestId: user.id }, select: { id: true, status: true, totalCents: true, currency: true, paymentIntentId: true, expiresAt: true, paidAt: true, paymentFailureMessage: true } });
  if (!booking) return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  let paymentStatus: string | null = null;
  if (booking.paymentIntentId && stripe) {
    try { paymentStatus = (await stripe.paymentIntents.retrieve(booking.paymentIntentId)).status; } catch {}
  }
  return NextResponse.json({ ...booking, paymentStatus });
}
