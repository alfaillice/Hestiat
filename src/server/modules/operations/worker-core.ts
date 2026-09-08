import { prisma } from '../../lib/prisma';
import { claimJobs, retryAt } from './events';
import { dispatchEvent } from './dispatcher';

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 5 * 60_000;

async function circuitAllows(provider?: string | null) {
  if (!provider) return true;
  const c = await prisma.operationsCircuit.findUnique({ where: { provider } });
  if (!c || c.state === 'CLOSED') return true;
  if (c.state === 'OPEN' && c.openedAt && Date.now() - c.openedAt.getTime() >= CIRCUIT_COOLDOWN_MS) {
    await prisma.operationsCircuit.update({ where: { provider }, data: { state: 'HALF_OPEN', halfOpenAt: new Date() } });
    return true;
  }
  return c.state === 'HALF_OPEN';
}

async function circuitSuccess(provider?: string | null) {
  if (!provider) return;
  await prisma.operationsCircuit.upsert({
    where: { provider },
    create: { provider, state: 'CLOSED', failures: 0 },
    update: { state: 'CLOSED', failures: 0, openedAt: null, halfOpenAt: null },
  });
}

async function circuitFailure(provider?: string | null) {
  if (!provider) return;
  const c = await prisma.operationsCircuit.upsert({ where: { provider }, create: { provider }, update: {} });
  const failures = c.failures + 1;
  await prisma.operationsCircuit.update({
    where: { provider },
    data: { failures, state: failures >= CIRCUIT_THRESHOLD ? 'OPEN' : c.state, openedAt: failures >= CIRCUIT_THRESHOLD ? new Date() : c.openedAt },
  });
}

export async function runWorkerOnce(batchSize = 10) {
  const jobs = await claimJobs(batchSize);
  for (const job of jobs) {
    if (!(await circuitAllows(job.provider))) {
      await prisma.eventJob.update({ where: { id: job.id }, data: { status: 'RETRY_WAIT', availableAt: new Date(Date.now() + 60_000), lockedAt: null } });
      continue;
    }
    const started = Date.now();
    const run = await prisma.eventJobRun.create({ data: { jobId: job.id, type: job.type, attempt: job.attempts, status: 'STARTED' } });
    try {
      await dispatchEvent(job.type, job.payload as Record<string, unknown>);
      await prisma.$transaction([
        prisma.eventJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lastError: null } }),
        prisma.eventJobRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', durationMs: Date.now() - started, finishedAt: new Date() } }),
      ]);
      await circuitSuccess(job.provider);
    } catch (error) {
      const message = String(error).slice(0, 2000);
      const exhausted = job.attempts >= job.maxAttempts;
      if (exhausted) {
        await prisma.$transaction([
          prisma.eventJob.update({ where: { id: job.id }, data: { status: 'FAILED', availableAt: new Date(), lockedAt: null, lastError: message } }),
          prisma.eventDeadLetter.create({ data: { jobId: job.id, type: job.type, payload: job.payload, attempts: job.attempts, lastError: message } }),
          prisma.eventJobRun.update({ where: { id: run.id }, data: { status: 'FAILED', durationMs: Date.now() - started, error: message, finishedAt: new Date() } }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.eventJob.update({ where: { id: job.id }, data: { status: 'RETRY_WAIT', availableAt: retryAt(job.attempts), lockedAt: null, lastError: message } }),
          prisma.eventJobRun.update({ where: { id: run.id }, data: { status: 'RETRY_WAIT', durationMs: Date.now() - started, error: message, finishedAt: new Date() } }),
        ]);
      }
      await circuitFailure(job.provider);
    }
  }
  return jobs.length;
}
