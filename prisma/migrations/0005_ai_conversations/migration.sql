CREATE TYPE "AIConversationStatus" AS ENUM ('OPEN','WAITING_FOR_GUEST','WAITING_FOR_HOST','WAITING_FOR_EXTERNAL_AI','ACTION_REQUIRED','RESOLVED','ESCALATED');
CREATE TABLE "AIConversation" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "status" "AIConversationStatus" NOT NULL DEFAULT 'OPEN',
  "intent" TEXT,
  "urgency" TEXT,
  "confidence" DOUBLE PRECISION,
  "lastSummary" TEXT,
  "lastAction" TEXT,
  "waitingSince" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIConversation_bookingId_guestId_key" ON "AIConversation"("bookingId","guestId");
CREATE INDEX "AIConversation_guestId_status_updatedAt_idx" ON "AIConversation"("guestId","status","updatedAt");
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
