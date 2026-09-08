import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../../src/server/lib/auth";
import { prisma } from "../../../../../../../src/server/lib/prisma";

async function getOwnedListing(userId: string, id: string) {
  return prisma.listing.findFirst({
    where: { id, hostId: userId },
    select: { id: true, title: true, checkInFromMinutes: true, checkInToMinutes: true, checkInInstructions: true }
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const listing = await getOwnedListing(user.id, id);
  if (!listing) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
  return NextResponse.json({ listing });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const listing = await getOwnedListing(user.id, id);
  if (!listing) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });

  const body = await request.json();
  const checkInFromMinutes = Math.max(0, Math.min(1439, Number(body.checkInFromMinutes)));
  const checkInToMinutes = Math.max(0, Math.min(1439, Number(body.checkInToMinutes)));
  if (!Number.isFinite(checkInFromMinutes) || !Number.isFinite(checkInToMinutes) || checkInToMinutes <= checkInFromMinutes) {
    return NextResponse.json({ error: "El horario de check-in no es válido." }, { status: 400 });
  }

  const input = body.instructions ?? {};
  const clean = {
    accessMethod: String(input.accessMethod || "").trim().slice(0, 80),
    arrival: String(input.arrival || "").trim().slice(0, 2000),
    keyLocation: String(input.keyLocation || "").trim().slice(0, 1000),
    accessCode: String(input.accessCode || "").trim().slice(0, 200),
    contactNote: String(input.contactNote || "").trim().slice(0, 1000),
  };

  const updated = await prisma.listing.update({
    where: { id },
    data: { checkInFromMinutes, checkInToMinutes, checkInInstructions: clean },
    select: { id: true, title: true, checkInFromMinutes: true, checkInToMinutes: true, checkInInstructions: true, updatedAt: true }
  });
  return NextResponse.json({ listing: updated });
}
