CREATE TABLE "AIInteraction" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "urgency" TEXT NOT NULL,
  "autonomous" BOOLEAN NOT NULL DEFAULT true,
  "externalAIUsed" BOOLEAN NOT NULL DEFAULT false,
  "decision" TEXT NOT NULL,
  "response" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIInteraction_bookingId_createdAt_idx" ON "AIInteraction"("bookingId", "createdAt");
CREATE INDEX "AIInteraction_guestId_createdAt_idx" ON "AIInteraction"("guestId", "createdAt");
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
