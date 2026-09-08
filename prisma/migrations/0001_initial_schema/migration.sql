-- Hestiat V42: initial schema baseline reconstructed from the original V1 Prisma schema.

CREATE TYPE "UserRole" AS ENUM ('GUEST','HOST','ADMIN');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT','PENDING_REVIEW','PUBLISHED','PAUSED','ARCHIVED');
CREATE TYPE "ListingType" AS ENUM ('HOUSE','APARTMENT','VILLA','PRIVATE_ROOM','SHARED_ROOM','OTHER');
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE','BLOCKED');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING','CONFIRMED','CANCELLED','COMPLETED','EXPIRED');
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE','MODERATE','FIRM');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "phone" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'GUEST',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Listing" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "type" "ListingType" NOT NULL,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "address" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "region" TEXT,
  "country" TEXT NOT NULL DEFAULT 'España',
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "maxGuests" INTEGER,
  "bedrooms" INTEGER,
  "beds" INTEGER,
  "bathrooms" INTEGER,
  "amenities" TEXT[] NOT NULL,
  "houseRules" JSONB,
  "basePriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "minNights" INTEGER NOT NULL DEFAULT 1,
  "advanceNoticeHours" INTEGER NOT NULL DEFAULT 24,
  "checkInFromMinutes" INTEGER NOT NULL DEFAULT 900,
  "checkInToMinutes" INTEGER NOT NULL DEFAULT 1320,
  "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'FLEXIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Listing_hostId_idx" ON "Listing"("hostId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ListingPhoto" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "altText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ListingPhoto_listingId_idx" ON "ListingPhoto"("listingId");
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AvailabilityDay" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  "priceCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AvailabilityDay_listingId_date_key" ON "AvailabilityDay"("listingId","date");
CREATE INDEX "AvailabilityDay_listingId_date_idx" ON "AvailabilityDay"("listingId","date");
ALTER TABLE "AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "guests" INTEGER NOT NULL,
  "nights" INTEGER NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "cleaningCents" INTEGER NOT NULL DEFAULT 0,
  "taxesCents" INTEGER NOT NULL DEFAULT 0,
  "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "paymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Booking_paymentIntentId_key" ON "Booking"("paymentIntentId");
CREATE INDEX "Booking_listingId_checkIn_checkOut_idx" ON "Booking"("listingId","checkIn","checkOut");
CREATE INDEX "Booking_guestId_createdAt_idx" ON "Booking"("guestId","createdAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
