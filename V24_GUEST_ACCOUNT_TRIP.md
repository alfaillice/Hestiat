# Hestiat V24 — Guest Account & Trip

V24 connects the guest journey to the authenticated user and closes authorization gaps in host listing mutation endpoints.

## Included
- Account profile read/update (`GET/PATCH /api/auth/me`).
- Real guest trip list (`GET /api/auth/bookings`) scoped by `guestId`.
- Real trip detail (`GET /api/auth/bookings/:id`) scoped by `guestId`.
- Dedicated `/mi-viaje/:id` detail view.
- Guest support request scoped to the booking owner.
- IA actions remain booking-scoped.
- Host listing PATCH/onboarding/publish now require a HOST session and ownership.
- No guest can read another guest's booking by changing an ID.

## Production notes
- Add CSRF strategy for state-changing browser endpoints if deployment architecture requires cross-site credentialed requests.
- Add rate limiting to profile/support mutations.
- Run Prisma migration/deploy and full typecheck/build with production dependencies before release.
