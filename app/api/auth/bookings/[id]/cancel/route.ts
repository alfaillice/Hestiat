import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../../src/server/lib/auth';
import { cancelGuestBooking } from '../../../../../../src/server/modules/cancellations/service';
import { prisma } from '../../../../../../src/server/lib/prisma';
import { cancellationDecision } from '../../../../../../src/server/modules/cancellations/policy';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findFirst({ where: { id, guestId: user.id }, include: { listing: { select: { cancellationPolicy: true } } } });
  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
  if (booking.status !== 'CONFIRMED') return NextResponse.json({ refundableCents: 0, percentage: 0, label: 'No reembolsable ahora' });
  return NextResponse.json(cancellationDecision(booking.listing.cancellationPolicy, booking.totalCents, booking.checkIn));
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try { return NextResponse.json(await cancelGuestBooking((await params).id, user.id)); }
  catch (e) {
    const code = e instanceof Error ? e.message : 'UNKNOWN';
    const status = code === 'BOOKING_NOT_FOUND' ? 404 : 409;
    return NextResponse.json({ error: code }, { status });
  }
}
