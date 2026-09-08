import { prisma } from '../../lib/prisma';

export async function enqueueEvent(input: { type: string; payload: Record<string, unknown>; dedupeKey: string; availableAt?: Date; maxAttempts?: number; provider?: string }) {
  const provider = input.provider ?? (input.type.startsWith('CHANNEL_') ? 'ICAL' : input.type.startsWith('WHATSAPP_') ? 'WHATSAPP' : input.type.startsWith('NOTIFICATION_') ? 'NOTIFICATIONS' : undefined);
  return prisma.eventJob.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: { type: input.type, payload: input.payload, dedupeKey: input.dedupeKey, availableAt: input.availableAt ?? new Date(), maxAttempts: input.maxAttempts ?? 6, provider },
    update: {},
  });
}

const RETRY_MINUTES = [1, 2, 5, 15, 30, 60];
export function retryAt(attempt: number) {
  const minutes = RETRY_MINUTES[Math.min(Math.max(attempt - 1, 0), RETRY_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000);
}

export async function claimJobs(limit = 10, leaseMinutes = 5) {
  const now = new Date();
  const stale = new Date(now.getTime() - leaseMinutes * 60_000);
  return prisma.$transaction(async tx => {
    await tx.eventJob.updateMany({
      where: { status: 'PROCESSING', lockedAt: { lt: stale } },
      data: { status: 'PENDING', lockedAt: null, availableAt: now },
    });
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "EventJob"
      WHERE status IN ('PENDING','RETRY_WAIT') AND "availableAt" <= ${now}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (!rows.length) return [];
    await tx.eventJob.updateMany({ where: { id: { in: rows.map(r => r.id) } }, data: { status: 'PROCESSING', lockedAt: now, attempts: { increment: 1 } } });
    return tx.eventJob.findMany({ where: { id: { in: rows.map(r => r.id) } }, orderBy: { createdAt: 'asc' } });
  });
}
