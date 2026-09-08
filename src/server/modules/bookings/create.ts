import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { calculateBookingPrice } from './pricing';
import { getListingAvailability, lockListing } from '../availability/unified';

export type CreatePendingBookingInput = {
  listingId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  email: string;
  name: string;
  guestId?: string;
};

export async function createPendingBooking(input: CreatePendingBookingInput) {
  return prisma.$transaction(async (tx) => {
    // PostgreSQL advisory transaction lock makes the overlap check + insert atomic
    // for all Hestiat checkout paths, including concurrent requests.
    await lockListing(tx, input.listingId);

    const listing = await tx.listing.findUnique({ where: { id: input.listingId } });
    if (!listing || listing.status !== 'PUBLISHED') throw new Error('LISTING_UNAVAILABLE');
    if (listing.maxGuests && input.guests > listing.maxGuests) throw new Error('GUEST_LIMIT');

    const nights = Math.ceil((input.checkOut.getTime() - input.checkIn.getTime()) / 86400000);
    if (nights < listing.minNights) throw new Error('MIN_NIGHTS');

    const availability = await getListingAvailability(input.listingId, input.checkIn, input.checkOut, tx);
    if (!availability.available) {
      throw new Error(availability.state === 'BLOCKED' ? 'DATES_BLOCKED' : 'DATES_TAKEN');
    }

    const days = await tx.availabilityDay.findMany({
      where: { listingId: input.listingId, date: { gte: input.checkIn, lt: input.checkOut } },
    });
    const prices: number[] = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(input.checkIn.getTime() + i * 86400000);
      const row = days.find((x) => x.date.getTime() === d.getTime());
      const price = row?.priceCents ?? listing.basePriceCents;
      if (!price || price <= 0) throw new Error('PRICE_MISSING');
      prices.push(price);
    }

    let guest = input.guestId ? await tx.user.findUnique({ where: { id: input.guestId } }) : null;
    if (!guest) {
      guest = await tx.user.findUnique({ where: { email: input.email } });
      if (!guest) guest = await tx.user.create({ data: { email: input.email, name: input.name, role: 'GUEST' } });
    }

    const pricing = calculateBookingPrice({ nightlyPricesCents: prices, currency: listing.currency });
    const booking = await tx.booking.create({
      data: {
        listingId: input.listingId,
        guestId: guest.id,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        nights,
        subtotalCents: pricing.subtotalCents,
        cleaningCents: pricing.cleaningCents,
        taxesCents: pricing.taxesCents,
        platformFeeCents: pricing.platformFeeCents,
        totalCents: pricing.totalCents,
        currency: pricing.currency,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    return { booking, pricing, guestCreated: !input.guestId && guest.email === input.email };
  }, { isolationLevel: 'Serializable' });
}
