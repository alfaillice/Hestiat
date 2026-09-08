import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type AvailabilityState =
  | 'AVAILABLE'
  | 'BLOCKED'
  | 'RESERVED_INTERNAL'
  | 'RESERVED_EXTERNAL'
  | 'CONFLICT'
  | 'UNAVAILABLE';

export type AvailabilityResult = {
  available: boolean;
  state: AvailabilityState;
  blockedDates: string[];
  internalReservationId?: string;
  externalReservationId?: string;
  reason?: string;
};

export function activeBookingWhere(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: 'CONFIRMED' },
      { status: 'PENDING', OR: [{ expiresAt: { gt: now } }, { expiresAt: null }] },
    ],
  };
}

/**
 * The single availability authority for search, quote and checkout.
 * It combines manual blocks, Hestiat bookings and external reservations.
 */
export async function getListingAvailability(
  listingId: string,
  checkIn: Date,
  checkOut: Date,
  client = prisma,
): Promise<AvailabilityResult> {
  const [days, internal, external] = await Promise.all([
    client.availabilityDay.findMany({
      where: { listingId, date: { gte: checkIn, lt: checkOut }, status: 'BLOCKED' },
      orderBy: { date: 'asc' },
    }),
    client.booking.findFirst({
      where: {
        listingId,
        ...activeBookingWhere(),
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true, checkIn: true, checkOut: true },
    }),
    client.externalReservation.findFirst({
      where: {
        listingId,
        status: 'ACTIVE',
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true, externalReservationId: true },
    }),
  ]);

  if (internal && external) {
    return {
      available: false,
      state: 'CONFLICT',
      blockedDates: [],
      internalReservationId: internal.id,
      externalReservationId: external.externalReservationId,
      reason: 'Existe una reserva interna y externa solapadas; no se vende la estancia.',
    };
  }
  if (internal) {
    return { available: false, state: 'RESERVED_INTERNAL', blockedDates: [], internalReservationId: internal.id };
  }
  if (external) {
    return { available: false, state: 'RESERVED_EXTERNAL', blockedDates: [], externalReservationId: external.externalReservationId };
  }
  if (days.length) {
    return {
      available: false,
      state: 'BLOCKED',
      blockedDates: days.map((d) => d.date.toISOString().slice(0, 10)),
    };
  }
  return { available: true, state: 'AVAILABLE', blockedDates: [] };
}

/** Serialize competing checkouts for the same listing inside one DB transaction. */
export async function lockListing(tx: Prisma.TransactionClient, listingId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${listingId}, 0))`;
}
