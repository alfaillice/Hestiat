import { NextResponse } from "next/server";
import { prisma } from "../../../../src/server/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const listing = await prisma.listing.findFirst({
    where: { id, status: "PUBLISHED" },
    include: {
      photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      host: { select: { name: true } },
      availability: from || to ? {
        where: {
          ...(from ? { date: { gte: new Date(`${from}T00:00:00.000Z`) } } : {}),
          ...(to ? { date: { lte: new Date(`${to}T00:00:00.000Z`) } } : {}),
        },
        orderBy: { date: "asc" },
      } : undefined,
    },
  });

  if (!listing) return NextResponse.json({ error: "Alojamiento no disponible." }, { status: 404 });

  return NextResponse.json({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    type: listing.type,
    address: listing.address,
    city: listing.city,
    region: listing.region,
    country: listing.country,
    maxGuests: listing.maxGuests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    amenities: listing.amenities,
    houseRules: listing.houseRules,
    basePriceCents: listing.basePriceCents,
    currency: listing.currency,
    minNights: listing.minNights,
    cancellationPolicy: listing.cancellationPolicy,
    hostName: listing.host.name,
    photos: listing.photos.map(p => ({ url: p.url, altText: p.altText, isCover: p.isCover, sortOrder: p.sortOrder })),
    availability: (listing.availability ?? []).map(a => ({ date: a.date.toISOString().slice(0, 10), status: a.status, priceCents: a.priceCents })),
  });
}
