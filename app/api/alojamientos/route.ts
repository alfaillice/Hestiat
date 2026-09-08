import { NextResponse } from "next/server";
import { prisma } from "../../../../src/server/lib/prisma";
import { activeBookingWhere } from "../../../../src/server/modules/availability/unified";

function parseDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = (url.searchParams.get("destination") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 100);
  const type = (url.searchParams.get("type") || "").trim();
  const minPrice = Number(url.searchParams.get("minPrice") || "");
  const maxPrice = Number(url.searchParams.get("maxPrice") || "");
  const guests = Math.max(1, Number(url.searchParams.get("guests") || 1));
  const checkIn = parseDate(url.searchParams.get("checkIn"));
  const checkOut = parseDate(url.searchParams.get("checkOut"));
  const hasDates = !!checkIn && !!checkOut && checkOut > checkIn;
  const now = new Date();

  if ((url.searchParams.has("checkIn") || url.searchParams.has("checkOut")) && !hasDates) {
    return NextResponse.json({ error: "Fechas no válidas" }, { status: 400 });
  }

  const nights = hasDates ? Math.ceil((checkOut!.getTime() - checkIn!.getTime()) / 86400000) : 0;

  const listings = await prisma.listing.findMany({
    where: {
      status: "PUBLISHED",
      maxGuests: { gte: guests },
      ...(type ? { type: type as any } : {}),
      ...(Number.isFinite(minPrice) && minPrice > 0 ? { basePriceCents: { gte: Math.round(minPrice * 100) } } : {}),
      ...(Number.isFinite(maxPrice) && maxPrice > 0 ? { basePriceCents: { lte: Math.round(maxPrice * 100) } } : {}),
      ...(destination ? { OR: [
        { city: { contains: destination, mode: "insensitive" } },
        { region: { contains: destination, mode: "insensitive" } },
        { country: { contains: destination, mode: "insensitive" } },
      ] } : {}),
      ...(hasDates ? {
        minNights: { lte: nights },
        OR: [
          { advanceNoticeHours: { lte: Math.floor((checkIn!.getTime() - now.getTime()) / 3600000) } },
          { advanceNoticeHours: 0 },
        ],
        availability: { none: { date: { gte: checkIn!, lt: checkOut! }, status: "BLOCKED" } },
        bookings: { none: { ...activeBookingWhere(now), checkIn: { lt: checkOut! }, checkOut: { gt: checkIn! } } },
        externalReservations: { none: { status: "ACTIVE", checkIn: { lt: checkOut! }, checkOut: { gt: checkIn! } } },
      } : {}),
    },
    include: { photos: { where: { isCover: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id, title: l.title, city: l.city, country: l.country,
      basePriceCents: l.basePriceCents, latitude: l.latitude, longitude: l.longitude,
      maxGuests: l.maxGuests, minNights: l.minNights, type: l.type,
      coverUrl: l.photos[0]?.url ?? null,
    })),
    search: { destination, guests, checkIn: url.searchParams.get("checkIn"), checkOut: url.searchParams.get("checkOut"), nights },
  });
}
