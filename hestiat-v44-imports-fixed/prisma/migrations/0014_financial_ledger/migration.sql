CREATE TYPE "PaymentRecordStatus" AS ENUM ('PENDING','SUCCEEDED','FAILED','REFUNDED','PARTIALLY_REFUNDED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING','PAID','FAILED');
CREATE TABLE "PaymentRecord" (
 "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "userId" TEXT NOT NULL, "stripePaymentIntentId" TEXT NOT NULL,
 "amountCents" INTEGER NOT NULL, "platformFeeCents" INTEGER NOT NULL, "hostAmountCents" INTEGER NOT NULL, "currency" TEXT NOT NULL,
 "status" "PaymentRecordStatus" NOT NULL DEFAULT 'PENDING', "refundedCents" INTEGER NOT NULL DEFAULT 0, "stripeRefundId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id"));
CREATE TABLE "HostPayout" (
 "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "hostId" TEXT NOT NULL, "stripeTransferId" TEXT, "amountCents" INTEGER NOT NULL, "currency" TEXT NOT NULL,
 "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING', "availableAt" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "failureMessage" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "HostPayout_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PaymentRecord_bookingId_key" ON "PaymentRecord"("bookingId");
CREATE UNIQUE INDEX "PaymentRecord_stripePaymentIntentId_key" ON "PaymentRecord"("stripePaymentIntentId");
CREATE UNIQUE INDEX "PaymentRecord_stripeRefundId_key" ON "PaymentRecord"("stripeRefundId");
CREATE UNIQUE INDEX "HostPayout_bookingId_key" ON "HostPayout"("bookingId");
CREATE UNIQUE INDEX "HostPayout_stripeTransferId_key" ON "HostPayout"("stripeTransferId");
CREATE INDEX "PaymentRecord_userId_createdAt_idx" ON "PaymentRecord"("userId","createdAt");
CREATE INDEX "HostPayout_hostId_status_availableAt_idx" ON "HostPayout"("hostId","status","availableAt");
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HostPayout" ADD CONSTRAINT "HostPayout_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostPayout" ADD CONSTRAINT "HostPayout_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
