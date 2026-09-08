import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/server/lib/auth";
import { prisma } from "@/src/server/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findFirst({ where: { id, guestId: user.id }, select: { id: true } });
  if (!booking) return NextResponse.json({ error: "Viaje no encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim().slice(0, 4000);
  const category = String(body.category || "GENERAL").trim().slice(0, 80);
  if (!message) return NextResponse.json({ error: "Escribe el motivo de la solicitud." }, { status: 400 });
  const support = await prisma.supportRequest.create({ data: { bookingId: booking.id, guestId: user.id, category, message } });
  return NextResponse.json({ support }, { status: 201 });
}
