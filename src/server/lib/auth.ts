import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "hestiat_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function getCurrentUser() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw || raw.length < 32) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hash(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding session: refresh activity without extending beyond a new 30-day window too aggressively.
  const now = Date.now();
  if (now - session.lastSeenAt.getTime() > 15 * 60 * 1000) {
    await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
}

export async function createSession(userId: string) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hash(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await prisma.authSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  await prisma.authSession.create({ data: { userId, tokenHash, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await prisma.authSession.deleteMany({ where: { tokenHash: hash(raw) } }).catch(() => {});
  jar.delete(SESSION_COOKIE);
}
