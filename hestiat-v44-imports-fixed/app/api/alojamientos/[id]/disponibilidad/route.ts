import { NextResponse } from "next/server";
import { prisma } from "@/src/server/lib/prisma";
import { activeBookingWhere } from "@/src/server/modules/availability/unified";

function parseDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function iso(d: Date) { return d.toISOString().slice(0, 10); }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));
  if (!from || !to || to <= from) return NextResponse.json({ error: "Rango de fechas no válido." }, { status: 400 });
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  if (days > 370) return NextResponse.json({ error: "El rango máximo es de 12 meses." }, { status: 400 });

  const listing = await prisma.listing.findFirst({ where: { id, status: "PUBLISHED" }, select: { id: true, basePriceCents: true, currency: true, minNights: true } });
  if (!listing) return NextResponse.json({ error: "Alojamiento no disponible." }, { status: 404 });

  const [manual, internal, external] = await Promise.all([
    prisma.availabilityDay.findMany({ where: { listingId: id, date: { gte: from, lt: to } }, select: { date: true, status: true, priceCents: true } }),
    prisma.booking.findMany({ where: { listingId: id, ...activeBookingWhere(), checkIn: { lt: to }, checkOut: { gt: from } }, select: { checkIn: true, checkOut: true } }),
    prisma.externalReservation.findMany({ where: { listingId: id, status: "ACTIVE", checkIn: { lt: to }, checkOut: { gt: from } }, select: { checkIn: true, checkOut: true } }),
  ]);

  const manualMap = new Map(manual.map(x => [iso(x.date), x]));
  const isOverlapNight = (day: Date, checkIn: Date, checkOut: Date) => day >= checkIn && day < checkOut;
  const data: Record<string, { available: boolean; priceCents: number | null; reason?: string }> = {};
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getTime() + i * 86400000);
    const key = iso(day);
    const internalHit = internal.some(b => isOverlapNight(day, b.checkIn, b.checkOut));
    const externalHit = external.some(b => isOverlapNight(day, b.checkIn, b.checkOut));
    const manualRow = manualMap.get(key);
    const manualHit = manualRow?.status === "BLOCKED";
    const price = manualRow?.priceCents ?? listing.basePriceCents ?? null;
    const reason = manualHit ? "BLOCKED" : internalHit && externalHit ? "CONFLICT" : internalHit ? "RESERVED_INTERNAL" : externalHit ? "RESERVED_EXTERNAL" : price == null || price <= 0 ? "NO_PRICE" : undefined;
    data[key] = { available: !reason, priceCents: price, ...(reason ? { reason } : {}) };
  }
  return NextResponse.json({ from: iso(from), to: iso(to), minNights: listing.minNights, currency: listing.currency, days: data });
}
