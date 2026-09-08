# Hestiat V9 — Dynamic Listing IMPLEMENTED

Implemented over the V8 source.

## Real listing flow
- `/resultados` now fetches published listings from the public API and carries `listingId`, dates and guests into the detail page.
- `/alojamiento` now loads the selected published Listing from `/api/alojamientos/[id]`.
- The detail API exposes only public listing data and the host display name.
- Photos come from `ListingPhoto` ordering/cover data.
- Price, capacity, amenities, rules/policy and location are read from the database.
- Date parameters are preserved into checkout.
- The booking CTA points to the real reservation flow.

## Public API
`GET /api/alojamientos/[id]?from=YYYY-MM-DD&to=YYYY-MM-DD`

Only `PUBLISHED` listings are returned.

## Note
A full production build should still be run in the deployment environment after installing dependencies and applying Prisma migrations. The local build attempt was time-limited in this environment.
