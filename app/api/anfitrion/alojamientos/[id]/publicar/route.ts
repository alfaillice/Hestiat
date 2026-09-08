import { NextResponse } from "next/server";
import { prisma } from "../../../../../../src/server/lib/prisma";
import { getCurrentUser } from "../../../../../../src/server/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const listing = await prisma.listing.findFirst({
      where: { id, hostId: user.id },
      include: { photos: true }
    });

    if (!listing) {
      return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
    }

    const missing: string[] = [];
    if (!listing.title) missing.push("title");
    if (!listing.description) missing.push("description");
    if (!listing.city || !listing.country) missing.push("location");
    if (!listing.maxGuests || !listing.bedrooms || !listing.beds || !listing.bathrooms) missing.push("capacity");
    if (!listing.basePriceCents || listing.basePriceCents <= 0) missing.push("price");
    if (listing.photos.length === 0) missing.push("photos");

    if (missing.length) {
      return NextResponse.json(
        { error: "El alojamiento no está listo para publicar.", missing },
        { status: 422 }
      );
    }

    const published = await prisma.listing.update({
      where: { id },
      data: { status: "PUBLISHED" },
      select: { id: true, status: true, updatedAt: true }
    });

    return NextResponse.json(published);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo publicar el alojamiento." },
      { status: 500 }
    );
  }
}
