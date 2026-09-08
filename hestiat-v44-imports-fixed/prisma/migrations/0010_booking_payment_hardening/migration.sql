ALTER TABLE "Booking" ADD COLUMN "paymentFailureMessage" TEXT;
ALTER TABLE "Booking" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");
