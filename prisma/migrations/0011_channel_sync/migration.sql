CREATE TYPE "ChannelProvider" AS ENUM ('ICAL','AIRBNB','BOOKING_COM','CHANNEL_MANAGER');
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('CONNECTED','SYNCING','ATTENTION','DISCONNECTED');

CREATE TABLE "ListingChannelConnection" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "provider" "ChannelProvider" NOT NULL,
  "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "externalListingId" TEXT,
  "externalCalendarUrl" TEXT,
  "feedToken" TEXT,
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingChannelConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingChannelConnection_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ListingChannelConnection_feedToken_key" ON "ListingChannelConnection"("feedToken");
CREATE UNIQUE INDEX "ListingChannelConnection_listingId_provider_key" ON "ListingChannelConnection"("listingId","provider");
CREATE INDEX "ListingChannelConnection_listingId_status_idx" ON "ListingChannelConnection"("listingId","status");

CREATE TABLE "ExternalReservation" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "ChannelProvider" NOT NULL,
  "externalReservationId" TEXT NOT NULL,
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "guests" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalReservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalReservation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ListingChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExternalReservation_provider_externalReservationId_listingId_key" ON "ExternalReservation"("provider","externalReservationId","listingId");
CREATE INDEX "ExternalReservation_listingId_checkIn_checkOut_idx" ON "ExternalReservation"("listingId","checkIn","checkOut");
CREATE INDEX "ExternalReservation_connectionId_lastSeenAt_idx" ON "ExternalReservation"("connectionId","lastSeenAt");

CREATE TABLE "ChannelSyncEvent" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "ChannelProvider" NOT NULL,
  "eventType" TEXT NOT NULL,
  "externalEventId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "payloadHash" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelSyncEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannelSyncEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ListingChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChannelSyncEvent_provider_externalEventId_key" ON "ChannelSyncEvent"("provider","externalEventId");
CREATE INDEX "ChannelSyncEvent_connectionId_createdAt_idx" ON "ChannelSyncEvent"("connectionId","createdAt");
CREATE INDEX "ChannelSyncEvent_status_nextAttemptAt_idx" ON "ChannelSyncEvent"("status","nextAttemptAt");
