import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "../../../../src/server/lib/prisma";
import { createSession } from "../../../../src/server/lib/auth";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length < 32) return NextResponse.redirect(new URL("/login?error=token", request.url));

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= now) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  // Consume atomically so a link cannot create two sessions when opened twice concurrently.
  const consumed = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    return NextResponse.redirect(new URL("/login?error=used", request.url));
  }

  await createSession(record.userId);
  return NextResponse.redirect(new URL("/mi-viaje", request.url));
}
