CREATE TYPE "MessageSender" AS ENUM ('GUEST','HOST','HESTIAT');
CREATE TYPE "MessageStatus" AS ENUM ('UNREAD','READ');
CREATE TABLE "HostMessage" (
 "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "listingId" TEXT NOT NULL, "guestId" TEXT NOT NULL,
 "hostId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "senderRole" "MessageSender" NOT NULL,
 "body" TEXT NOT NULL, "status" "MessageStatus" NOT NULL DEFAULT 'UNREAD',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "HostMessage_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "HostMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HostMessage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HostMessage_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HostMessage_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HostMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HostMessage_hostId_status_createdAt_idx" ON "HostMessage"("hostId","status","createdAt");
CREATE INDEX "HostMessage_bookingId_createdAt_idx" ON "HostMessage"("bookingId","createdAt");
