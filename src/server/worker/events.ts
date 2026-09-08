import { runWorkerOnce } from '../modules/operations/worker-core';
import { prisma } from '../lib/prisma';

const sleep = (ms:number) => new Promise(r => setTimeout(r, ms));
const once = process.argv.includes('--once');

async function main() {
  console.log('Hestiat Operations Worker V3 iniciado');
  do {
    const count = await runWorkerOnce(Number(process.env.WORKER_BATCH_SIZE || 10));
    if (once || count === 0) break;
    await sleep(Number(process.env.WORKER_POLL_MS || 1000));
  } while (true);
  await prisma.$disconnect();
}
main().catch(async error => { console.error(error); await prisma.$disconnect(); process.exit(1); });
