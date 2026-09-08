CREATE TYPE "OperationsCircuitState" AS ENUM ('CLOSED','OPEN','HALF_OPEN');
ALTER TABLE "EventJob" ADD COLUMN "provider" TEXT;
CREATE TABLE "EventDeadLetter" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL,
  "lastError" TEXT NOT NULL,
  "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventDeadLetter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventDeadLetter_type_failedAt_idx" ON "EventDeadLetter"("type","failedAt");
CREATE INDEX "EventDeadLetter_jobId_idx" ON "EventDeadLetter"("jobId");
CREATE TABLE "OperationsCircuit" (
  "provider" TEXT NOT NULL,
  "state" "OperationsCircuitState" NOT NULL DEFAULT 'CLOSED',
  "failures" INTEGER NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMP(3),
  "halfOpenAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationsCircuit_pkey" PRIMARY KEY ("provider")
);
CREATE TABLE "EventJobRun" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "durationMs" INTEGER,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "EventJobRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventJobRun_jobId_startedAt_idx" ON "EventJobRun"("jobId","startedAt");
CREATE INDEX "EventJobRun_type_status_startedAt_idx" ON "EventJobRun"("type","status","startedAt");
