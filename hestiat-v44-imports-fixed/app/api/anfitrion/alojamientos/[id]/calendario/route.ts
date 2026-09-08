import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/server/lib/auth';
import { prisma } from '@/src/server/lib/prisma';

async function owned(userId: string, id: string) {
  return prisma.listing.findFirst({ where: { id, hostId: userId }, select: { id: true, title: true } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user || user.role !== 'HOST') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const listing = await owned(user.id, id);
  if (!listing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get('from') || new Date().toISOString());
  const to = new Date(url.searchParams.get('to') || new Date(Date.now()+90*86400000).toISOString());
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return NextResponse.json({ error: 'Rango no válido' }, { status: 400 });
  const [days, bookings, external] = await Promise.all([
    prisma.availabilityDay.findMany({ where: { listingId:id, date:{gte:from,lte:to} }, orderBy:{date:'asc'} }),
    prisma.booking.findMany({ where:{listingId:id,status:{in:['PENDING','CONFIRMED']},checkOut:{gte:from},checkIn:{lte:to}}, select:{id:true,checkIn:true,checkOut:true,status:true,guests:true,totalCents:true,currency:true} }),
    prisma.externalReservation.findMany({ where:{listingId:id,status:'ACTIVE',checkOut:{gte:from},checkIn:{lte:to}}, select:{id:true,provider:true,externalReservationId:true,checkIn:true,checkOut:true,guests:true,status:true} })
  ]);
  return NextResponse.json({ listing, days, bookings, externalReservations:external });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user || user.role !== 'HOST') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!(await owned(user.id, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const body = await request.json();
  const date = new Date(body.date);
  const status = body.status;
  if (!Number.isFinite(date.getTime()) || !['AVAILABLE','BLOCKED'].includes(status)) return NextResponse.json({ error:'Fecha o estado no válido' }, { status:400 });
  const day = await prisma.availabilityDay.upsert({ where:{ listingId_date:{listingId:id,date} }, create:{listingId:id,date,status}, update:{status} });
  return NextResponse.json({ day });
}
