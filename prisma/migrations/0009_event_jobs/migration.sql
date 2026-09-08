-- Hestiat Operations Core V2
CREATE TYPE "MessageChannel" AS ENUM ('WEB','WHATSAPP','EMAIL');
ALTER TABLE "HostMessage" ADD COLUMN "channel" "MessageChannel" NOT NULL DEFAULT 'WEB';
ALTER TABLE "HostMessage" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "HostMessage" ADD COLUMN "aiProcessedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "HostMessage_providerMessageId_key" ON "HostMessage"("providerMessageId");

CREATE TYPE "EventJobStatus" AS ENUM ('PENDING','PROCESSING','RETRY_WAIT','COMPLETED','FAILED');
CREATE TABLE "EventJob" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EventJobStatus" NOT NULL DEFAULT 'PENDING',
  "dedupeKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventJob_dedupeKey_key" ON "EventJob"("dedupeKey");
CREATE INDEX "EventJob_status_availableAt_idx" ON "EventJob"("status","availableAt");
CREATE INDEX "EventJob_status_lockedAt_idx" ON "EventJob"("status","lockedAt");
CREATE INDEX "EventJob_type_status_availableAt_idx" ON "EventJob"("type","status","availableAt");
