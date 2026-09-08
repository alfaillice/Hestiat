-- Hestiat: real PostGIS location point
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

CREATE INDEX IF NOT EXISTS "Listing_location_gix"
  ON "Listing" USING GIST ("location");

UPDATE "Listing"
SET "location" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
WHERE "longitude" IS NOT NULL
  AND "latitude" IS NOT NULL
  AND "location" IS NULL;
