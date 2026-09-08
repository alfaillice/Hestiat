import { prisma } from '../../lib/prisma';

export async function getOperationsHealth() {
  const db = await prisma.$queryRaw`SELECT 1 as ok`;
  const [counts, deadLetters, recentRuns, circuits] = await Promise.all([
    prisma.eventJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.eventDeadLetter.count(),
    prisma.eventJobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20, select: { id: true, jobId: true, type: true, attempt: true, status: true, durationMs: true, error: true, startedAt: true, finishedAt: true } }),
    prisma.operationsCircuit.findMany({ orderBy: { provider: 'asc' } }),
  ]);
  return {
    ok: true,
    db: Array.isArray(db) && db.length > 0,
    jobs: Object.fromEntries(counts.map(c => [c.status, c._count._all])),
    deadLetters,
    circuits,
    recentRuns,
  };
}
