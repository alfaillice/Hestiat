import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../../../../src/server/lib/auth';
import { cancelHostBooking } from '../../../../../../../../src/server/modules/cancellations/service';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user || user.role !== 'HOST') return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try { return NextResponse.json(await cancelHostBooking((await params).id, user.id)); }
  catch (e) { const code = e instanceof Error ? e.message : 'UNKNOWN'; return NextResponse.json({ error: code }, { status: code === 'BOOKING_NOT_FOUND' ? 404 : 409 }); }
}
