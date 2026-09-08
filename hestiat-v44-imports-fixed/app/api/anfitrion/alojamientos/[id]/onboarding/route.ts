import { NextResponse } from "next/server";
import { geocodeAddress } from "@/src/server/modules/geocoding/geocoding";
import { prisma } from "@/src/server/lib/prisma";
import { getCurrentUser } from "@/src/server/lib/auth";

const fields = new Set([
  "title","description","address","city","postalCode","region","country",
  "latitude","longitude","maxGuests","bedrooms","beds","bathrooms",
  "amenities","houseRules","basePriceCents","currency","minNights",
  "advanceNoticeHours","checkInFromMinutes","checkInToMinutes",
  "cancellationPolicy"
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const owned = await prisma.listing.findFirst({ where: { id, hostId: user.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
    const body = await request.json();
    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (fields.has(key)) data[key] = value;
    }

    if (data.basePriceCents !== undefined) data.basePriceCents = Math.round(Number(data.basePriceCents));

    const listing = await prisma.listing.update({
      where: { id },
      data,
      select: { id: true, status: true, updatedAt: true, latitude: true, longitude: true }
    });


    if (listing.latitude != null && listing.longitude != null) {
      await prisma.$executeRaw`
        UPDATE "Listing"
        SET "location" = ST_SetSRID(
          ST_MakePoint(${Number(listing.longitude)}, ${Number(listing.latitude)}),
          4326
        )::geography
        WHERE "id" = ${listing.id};
      `;
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar el borrador." }, { status: 500 });
  }
}
