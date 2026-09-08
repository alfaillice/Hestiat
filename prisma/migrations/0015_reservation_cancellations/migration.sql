-- V27: immutable refund records for partial/full Stripe refunds.
CREATE TABLE "RefundRecord" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "stripeRefundId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUCCEEDED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefundRecord_stripeRefundId_key" ON "RefundRecord"("stripeRefundId");
CREATE INDEX "RefundRecord_bookingId_createdAt_idx" ON "RefundRecord"("bookingId", "createdAt");
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
