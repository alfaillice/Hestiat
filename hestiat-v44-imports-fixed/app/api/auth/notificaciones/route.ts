import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/server/lib/auth";
import { prisma } from "@/src/server/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id, all } = await request.json();
  if (all) {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (!id) return NextResponse.json({ error: "Notificación incompleta." }, { status: 400 });
  const notification = await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: notification.count === 1 });
}
