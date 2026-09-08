import { NextResponse } from 'next/server';
import { createSession, getCurrentUser } from '../../../src/server/lib/auth';
import { createPendingBooking } from '../../../src/server/modules/bookings/create';

function dateUtc(value: string) {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSerializationConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2034';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const listingId = String(body.listingId || '');
    const checkIn = dateUtc(body.checkIn);
    const checkOut = dateUtc(body.checkOut);
    const guests = Number(body.guests || 1);
    const currentUser = await getCurrentUser();
    const email = String(body.email || currentUser?.email || '').trim().toLowerCase();
    const name = String(body.name || currentUser?.name || '').trim();

    if (!listingId || !checkIn || !checkOut || checkOut <= checkIn || !email || !name || guests < 1 || !Number.isInteger(guests)) {
      return NextResponse.json({ error: 'Datos de reserva incompletos o no válidos.' }, { status: 400 });
    }

    let result: Awaited<ReturnType<typeof createPendingBooking>> | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await createPendingBooking({
          listingId,
          checkIn,
          checkOut,
          guests,
          email,
          name,
          guestId: currentUser?.id,
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isSerializationConflict(error) || attempt === 2) throw error;
      }
    }
    if (!result) throw lastError ?? new Error('BOOKING_CREATE_FAILED');

    if (!currentUser) await createSession(result.booking.guestId);

    return NextResponse.json({
      bookingId: result.booking.id,
      status: result.booking.status,
      paymentRequired: true,
      ...result.pricing,
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const map: Record<string, [string, number]> = {
      LISTING_UNAVAILABLE: ['Alojamiento no disponible.', 404],
      GUEST_LIMIT: ['Número de huéspedes no permitido.', 422],
      MIN_NIGHTS: ['La estancia mínima no se cumple.', 422],
      DATES_TAKEN: ['Las fechas acaban de ser reservadas.', 409],
      DATES_BLOCKED: ['Hay días bloqueados en la estancia.', 409],
      PRICE_MISSING: ['No hay precio para todas las noches.', 422],
    };
    const [message, status] = map[code] ?? ['No se pudo crear la reserva.', 500];
    console.error(error);
    return NextResponse.json({ error: message }, { status });
  }
}
