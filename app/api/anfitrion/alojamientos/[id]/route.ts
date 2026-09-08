import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/server/lib/prisma";
import { getCurrentUser } from "../../../../../src/server/lib/auth";

const allowedFields = new Set([
  "title", "description", "address", "city", "postalCode", "region",
  "country", "latitude", "longitude", "maxGuests", "bedrooms", "beds",
  "bathrooms", "amenities", "houseRules", "basePriceCents", "currency",
  "minNights", "advanceNoticeHours", "checkInFromMinutes",
  "checkInToMinutes", "cancellationPolicy"
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const listing = await prisma.listing.findFirst({
    where: { id, hostId: user.id },
    include: { photos: { orderBy: { sortOrder: "asc" } } }
  });
  if (!listing) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
  return NextResponse.json({ listing });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.has(key)) data[key] = value;
    }

    if (data.basePriceCents !== undefined) {
      data.basePriceCents = Math.round(Number(data.basePriceCents));
    }

    const owned = await prisma.listing.findFirst({ where: { id, hostId: user.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });

    const listing = await prisma.listing.update({
      where: { id },
      data,
      select: { id: true, status: true, updatedAt: true }
    });

    return NextResponse.json(listing);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo guardar el alojamiento." },
      { status: 500 }
    );
  }
}
