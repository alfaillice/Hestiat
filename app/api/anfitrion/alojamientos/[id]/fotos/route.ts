import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../../src/server/lib/auth";
import { prisma } from "../../../../../../../src/server/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const owned = await prisma.listing.findFirst({ where: { id, hostId: user.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
    const { url, altText, sortOrder, isCover } = await request.json();
    if (!url || typeof url !== "string" || url.length > 2000) return NextResponse.json({ error: "url es obligatoria." }, { status: 400 });
    const photo = await prisma.$transaction(async (tx) => {
      if (isCover) await tx.listingPhoto.updateMany({ where: { listingId: id }, data: { isCover: false } });
      return tx.listingPhoto.create({ data: { listingId: id, url, altText: typeof altText === "string" ? altText.slice(0, 300) : null, sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : 0, isCover: Boolean(isCover) } });
    });
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar la foto." }, { status: 500 });
  }
}
