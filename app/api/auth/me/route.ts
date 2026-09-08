import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/server/lib/auth";
import { prisma } from "../../../../src/server/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role } : null });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; phone?: string | null } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "El nombre no es válido." }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone && (phone.length < 7 || phone.length > 30)) return NextResponse.json({ error: "El teléfono no es válido." }, { status: 400 });
    data.phone = phone || null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "No hay cambios." }, { status: 400 });

  const updated = await prisma.user.update({ where: { id: user.id }, data, select: { id: true, email: true, name: true, phone: true, role: true } });
  return NextResponse.json({ user: updated });
}
