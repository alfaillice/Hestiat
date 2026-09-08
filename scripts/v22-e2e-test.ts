import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createPendingBooking } from '../src/server/modules/bookings/create';
import { getListingAvailability } from '../src/server/modules/availability/unified';
import { enqueueEvent } from '../src/server/modules/operations/events';
import { runWorkerOnce } from '../src/server/modules/operations/worker-core';
import { parseICal, generateICal } from '../src/server/modules/channels/ical';

const prisma = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatorio para V22.');
  const suffix = `v22-${Date.now()}`;
  const host = await prisma.user.create({ data: { email: `host-${suffix}@test.local`, name: 'V22 Host', role: 'HOST' } });
  const guest1 = await prisma.user.create({ data: { email: `guest1-${suffix}@test.local`, name: 'Guest 1', role: 'GUEST' } });
  const guest2 = await prisma.user.create({ data: { email: `guest2-${suffix}@test.local`, name: 'Guest 2', role: 'GUEST' } });
  const listing = await prisma.listing.create({
    data: { hostId: host.id, title: 'V22 E2E', type: 'APARTMENT', status: 'PUBLISHED', maxGuests: 4, basePriceCents: 10000, currency: 'EUR' },
  });

  try {
    const checkIn = new Date(Date.now() + 7 * DAY); checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkIn.getTime() + 2 * DAY);

    // 1) Concurrent checkout: exactly one transaction may win.
    const race = await Promise.allSettled([
      createPendingBooking({ listingId: listing.id, checkIn, checkOut, guests: 2, email: guest1.email, name: guest1.name!, guestId: guest1.id }),
      createPendingBooking({ listingId: listing.id, checkIn, checkOut, guests: 2, email: guest2.email, name: guest2.name!, guestId: guest2.id }),
    ]);
    assert.equal(race.filter(x => x.status === 'fulfilled').length, 1, 'La carrera debe crear una sola reserva');
    assert.equal(race.filter(x => x.status === 'rejected').length, 1, 'La carrera debe rechazar la segunda reserva');

    const booking = await prisma.booking.findFirstOrThrow({ where: { listingId: listing.id, status: 'PENDING' } });
    const availabilityWhilePending = await getListingAvailability(listing.id, checkIn, checkOut);
    assert.equal(availabilityWhilePending.available, false);
    assert.equal(availabilityWhilePending.state, 'RESERVED_INTERNAL');

    // 2) External reservation also blocks availability.
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
    const connection = await prisma.listingChannelConnection.create({
      data: { listingId: listing.id, provider: 'ICAL', externalCalendarUrl: 'https://calendar.test/feed.ics', capabilities: ['IMPORT'] },
    });
    await prisma.externalReservation.create({
      data: { listingId: listing.id, connectionId: connection.id, provider: 'ICAL', externalReservationId: `ext-${suffix}`, checkIn, checkOut, status: 'ACTIVE' },
    });
    const availabilityExternal = await getListingAvailability(listing.id, checkIn, checkOut);
    assert.equal(availabilityExternal.available, false);
    assert.equal(availabilityExternal.state, 'RESERVED_EXTERNAL');
    await prisma.externalReservation.deleteMany({ where: { connectionId: connection.id } });
    await prisma.listingChannelConnection.delete({ where: { id: connection.id } });

    // 3) Manual block is respected by the same authority.
    await prisma.availabilityDay.create({ data: { listingId: listing.id, date: checkIn, status: 'BLOCKED' } });
    const availabilityBlocked = await getListingAvailability(listing.id, checkIn, checkOut);
    assert.equal(availabilityBlocked.available, false);
    assert.equal(availabilityBlocked.state, 'BLOCKED');
    await prisma.availabilityDay.deleteMany({ where: { listingId: listing.id } });

    // 4) Expired PENDING no longer blocks checkout, even before the worker runs.
    const expired = await prisma.booking.create({
      data: {
        listingId: listing.id, guestId: guest1.id, checkIn, checkOut, guests: 1, nights: 2,
        subtotalCents: 20000, totalCents: 21600, platformFeeCents: 1600, currency: 'EUR',
        status: 'PENDING', expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const availabilityExpired = await getListingAvailability(listing.id, checkIn, checkOut);
    assert.equal(availabilityExpired.available, true, 'Un PENDING expirado no debe bloquear');
    await prisma.booking.delete({ where: { id: expired.id } });

    // 5) iCal parser is deterministic and duplicate UIDs remain one logical reservation.
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:dup-v22', 'DTSTART:20300101T120000Z', 'DTEND:20300103T120000Z', 'STATUS:CONFIRMED', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:dup-v22', 'DTSTART:20300101T120000Z', 'DTEND:20300103T120000Z', 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const parsed = parseICal(ics);
    assert.equal(parsed.length, 2, 'El parser conserva eventos; la identidad se deduplica por UID al persistir');
    const feed = generateICal(listing.id, [{ id: 'booking-v22', checkIn, checkOut, status: 'CONFIRMED' }]);
    assert.match(feed, /UID:hestiat-booking-v22@hestiat\.com/);

    // 6) Event enqueue is idempotent.
    const dedupe = `v22-dedupe-${suffix}`;
    const j1 = await enqueueEvent({ type: 'CHANNEL_ICAL_SYNC_REQUESTED', payload: { connectionId: 'x' }, dedupeKey: dedupe, provider: 'ICAL' });
    const j2 = await enqueueEvent({ type: 'CHANNEL_ICAL_SYNC_REQUESTED', payload: { connectionId: 'x' }, dedupeKey: dedupe, provider: 'ICAL' });
    assert.equal(j1.id, j2.id, 'El mismo dedupeKey debe reutilizar el job');

    // 7) A failed job reaches DLQ exactly once after maxAttempts=1.
    const dlqKey = `v22-dlq-${suffix}`;
    const dlqJob = await enqueueEvent({ type: 'V22_UNSUPPORTED_EVENT', payload: {}, dedupeKey: dlqKey, maxAttempts: 1 });
    await runWorkerOnce(10);
    const failed = await prisma.eventJob.findUniqueOrThrow({ where: { id: dlqJob.id } });
    assert.equal(failed.status, 'FAILED');
    const dlq = await prisma.eventDeadLetter.findMany({ where: { jobId: dlqJob.id } });
    assert.equal(dlq.length, 1);
    const runs = await prisma.eventJobRun.count({ where: { jobId: dlqJob.id } });
    assert.equal(runs, 1);

    // 8) Stale processing leases are recovered by claimJobs through the worker.
    const staleKey = `v22-stale-${suffix}`;
    const staleJob = await enqueueEvent({ type: 'V22_UNSUPPORTED_STALE', payload: {}, dedupeKey: staleKey, maxAttempts: 1 });
    await prisma.eventJob.update({ where: { id: staleJob.id }, data: { status: 'PROCESSING', lockedAt: new Date(Date.now() - 10 * 60_000) } });
    await runWorkerOnce(10);
    const staleAfter = await prisma.eventJob.findUniqueOrThrow({ where: { id: staleJob.id } });
    assert.equal(staleAfter.status, 'FAILED', 'El lease antiguo debe recuperarse y procesarse');

    console.log('V22 E2E: OK');
    console.log('✓ concurrencia de reservas');
    console.log('✓ disponibilidad unificada');
    console.log('✓ reserva externa');
    console.log('✓ bloqueo manual');
    console.log('✓ expiración de PENDING');
    console.log('✓ iCal');
    console.log('✓ idempotencia de jobs');
    console.log('✓ DLQ + EventJobRun');
    console.log('✓ recuperación de leases');
  } finally {
    const v22Jobs = await prisma.eventJob.findMany({ where: { dedupeKey: { startsWith: `v22-` } }, select: { id: true } });
    const v22JobIds = v22Jobs.map(x => x.id);
    await prisma.eventJobRun.deleteMany({ where: { jobId: { in: v22JobIds } } }).catch(() => null);
    await prisma.eventDeadLetter.deleteMany({ where: { jobId: { in: v22JobIds } } }).catch(() => null);
    await prisma.eventJob.deleteMany({ where: { id: { in: v22JobIds } } });
    await prisma.booking.deleteMany({ where: { listingId: listing.id } });
    await prisma.availabilityDay.deleteMany({ where: { listingId: listing.id } });
    await prisma.listingChannelConnection.deleteMany({ where: { listingId: listing.id } });
    await prisma.listing.delete({ where: { id: listing.id } });
    await prisma.user.deleteMany({ where: { id: { in: [host.id, guest1.id, guest2.id] } } });
  }
}

main().catch(error => { console.error('V22 E2E: FAILED', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
