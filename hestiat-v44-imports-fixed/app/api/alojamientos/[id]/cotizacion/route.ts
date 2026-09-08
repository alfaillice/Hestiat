import { NextResponse } from "next/server";
import { prisma } from "@/src/server/lib/prisma";
import { calculateBookingPrice } from "@/src/server/modules/bookings/pricing";
import { getListingAvailability } from "@/src/server/modules/availability/unified";

function dayUtc(value: string) {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const checkIn = dayUtc(url.searchParams.get("checkIn") || "");
  const checkOut = dayUtc(url.searchParams.get("checkOut") || "");
  const guests = Number(url.searchParams.get("guests") || 1);

  if (!checkIn || !checkOut || checkOut <= checkIn || !Number.isInteger(guests) || guests < 1) {
    return NextResponse.json({ error: "Fechas o huéspedes no válidos." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Alojamiento no disponible." }, { status: 404 });
  }
  if (listing.maxGuests && guests > listing.maxGuests) {
    return NextResponse.json({ error: `Máximo ${listing.maxGuests} huéspedes.` }, { status: 422 });
  }

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000);
  if (nights < listing.minNights) {
    return NextResponse.json({ error: `La estancia mínima es de ${listing.minNights} noches.` }, { status: 422 });
  }

  const days = await prisma.availabilityDay.findMany({
    where: { listingId: id, date: { gte: checkIn, lt: checkOut } },
    orderBy: { date: "asc" },
  });

  const prices: number[] = [];
  const unavailable: string[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkIn.getTime() + i * 86400000);
    const row = days.find(x => x.date.getTime() === d.getTime());
    if (row?.status === "BLOCKED") unavailable.push(d.toISOString().slice(0,10));
    const price = row?.priceCents ?? listing.basePriceCents;
    if (price == null || price <= 0) unavailable.push(d.toISOString().slice(0,10));
    else prices.push(price);
  }

  const availability = await getListingAvailability(id, checkIn, checkOut);
  if (!availability.available) {
    if (availability.state === "BLOCKED") unavailable.push(...availability.blockedDates);
    else unavailable.push(availability.state.toLowerCase());
  }

  if (unavailable.length) {
    return NextResponse.json({ available: false, unavailable, nights, currency: listing.currency }, { status: 200 });
  }

  return NextResponse.json({
    available: true,
    ...calculateBookingPrice({ nightlyPricesCents: prices, currency: listing.currency }),
    nightlyPricesCents: prices,
  });
}
