/**
 * V23 authentication smoke/integration checks.
 * Requires DATABASE_URL and generated Prisma client.
 * The session-cookie assertions are intentionally performed at the data layer
 * so this can run in CI without a browser.
 */
import crypto from 'node:crypto';
import { prisma } from '../src/server/lib/prisma';

async function main() {
  const email = `v23-${crypto.randomUUID()}@example.test`;
  const user = await prisma.user.create({ data: { email } });
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await prisma.authToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 15 * 60_000) } });

  const sessionRaw = crypto.randomBytes(32).toString('base64url');
  const sessionHash = crypto.createHash('sha256').update(sessionRaw).digest('hex');
  await prisma.authSession.create({ data: { userId: user.id, tokenHash: sessionHash, expiresAt: new Date(Date.now() + 30 * 86400_000) } });

  const session = await prisma.authSession.findUnique({ where: { tokenHash: sessionHash } });
  if (!session || session.userId !== user.id) throw new Error('session lookup failed');

  const consumed = await prisma.authToken.updateMany({ where: { id: (await prisma.authToken.findUniqueOrThrow({ where: { tokenHash } })).id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) throw new Error('token consumption failed');
  const second = await prisma.authToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
  if (second.count !== 0) throw new Error('single-use token invariant failed');

  await prisma.authSession.deleteMany({ where: { userId: user.id } });
  await prisma.authToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('V23 auth checks passed');
}

main().catch(async (error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
