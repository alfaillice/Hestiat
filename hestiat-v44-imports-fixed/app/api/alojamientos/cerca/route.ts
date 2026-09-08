import { NextResponse } from "next/server";
import { prisma } from "@/src/server/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radiusKm") ?? 25), 1), 100);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat y lng son obligatorios." }, { status: 400 });
  }

  const meters = radiusKm * 1000;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string | null;
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceMeters: number;
  }>>`
    SELECT
      "id",
      "title",
      "city",
      "country",
      "latitude"::double precision AS "latitude",
      "longitude"::double precision AS "longitude",
      "basePriceCents",
      (SELECT "url" FROM "ListingPhoto" p WHERE p."listingId" = "Listing"."id" AND p."isCover" = true ORDER BY p."sortOrder" ASC LIMIT 1) AS "coverUrl",
      ST_Distance(
        "location",
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS "distanceMeters"
    FROM "Listing"
    WHERE "status" = 'PUBLISHED'
      AND "location" IS NOT NULL
      AND ST_DWithin(
        "location",
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${meters}
      )
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit};
  `;

  return NextResponse.json({ center: { lat, lng }, radiusKm, results: rows });
}
