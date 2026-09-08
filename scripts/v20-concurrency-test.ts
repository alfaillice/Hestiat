import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createPendingBooking } from '../src/server/modules/bookings/create';

const prisma = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatorio para la prueba V20.');

  const suffix = `v20-${Date.now()}`;
  const host = await prisma.user.create({ data: { email: `host-${suffix}@test.local`, name: 'V20 Host', role: 'HOST' } });
  const guest1 = await prisma.user.create({ data: { email: `guest1-${suffix}@test.local`, name: 'Guest 1', role: 'GUEST' } });
  const guest2 = await prisma.user.create({ data: { email: `guest2-${suffix}@test.local`, name: 'Guest 2', role: 'GUEST' } });
  const listing = await prisma.listing.create({
    data: { hostId: host.id, title: 'V20 concurrency test', type: 'APARTMENT', status: 'PUBLISHED', maxGuests: 4, basePriceCents: 10000, currency: 'EUR' },
  });

  const checkIn = new Date(Date.now() + 7 * DAY); checkIn.setUTCHours(0,0,0,0);
  const checkOut = new Date(checkIn.getTime() + 2 * DAY);

  const results = await Promise.allSettled([
    createPendingBooking({ listingId: listing.id, checkIn, checkOut, guests: 2, email: guest1.email, name: guest1.name!, guestId: guest1.id }),
    createPendingBooking({ listingId: listing.id, checkIn, checkOut, guests: 2, email: guest2.email, name: guest2.name!, guestId: guest2.id }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, `Se esperaba 1 reserva creada, se obtuvieron ${fulfilled.length}`);
  assert.equal(rejected.length, 1, `Se esperaba 1 rechazo, se obtuvieron ${rejected.length}`);
  const rejection = rejected[0] as PromiseRejectedResult;
  assert.equal(rejection.reason?.message, 'DATES_TAKEN');

  const bookings = await prisma.booking.count({ where: { listingId: listing.id, status: 'PENDING' } });
  assert.equal(bookings, 1);

  await prisma.booking.deleteMany({ where: { listingId: listing.id } });
  await prisma.listing.delete({ where: { id: listing.id } });
  await prisma.user.deleteMany({ where: { id: { in: [host.id, guest1.id, guest2.id] } } });
  console.log('V20 concurrency test: OK — solo una reserva ganó la carrera.');
}

main().catch(async (error) => { console.error('V20 concurrency test: FAILED', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
