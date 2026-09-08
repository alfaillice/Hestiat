import { NextResponse } from 'next/server';
import { getOperationsHealth } from '@/src/server/modules/operations/health';

export async function GET(request: Request) {
  const secret = process.env.OPERATIONS_HEALTH_SECRET;
  if (secret && request.headers.get('x-operations-health-secret') !== secret) return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  try { return NextResponse.json(await getOperationsHealth()); }
  catch (error) { return NextResponse.json({ ok: false, error: String(error).slice(0, 300) }, { status: 503 }); }
}
