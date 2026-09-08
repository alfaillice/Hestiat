# Hestiat V42 — Safe Prisma Migration Rebuild

## What changed

The migration history is now deterministic and ordered from `0001` through `0015`.

- `0001_initial_schema` restores the original V1 database foundation (User, Listing, ListingPhoto, AvailabilityDay, Booking and their enums/indexes/foreign keys).
- The three former `0005_*` migrations are now ordered as `0005_ai_conversations`, `0006_ai_interactions`, and `0007_notifications`.
- Communication preferences moves to `0008` and the former event-jobs migration to `0009`; later migrations retain their chronological order through `0015`.

## Safety rule

Do **not** run this migration chain blindly against an existing production database. First establish whether the target database is empty or already contains the Hestiat schema.

### Fresh staging database

```bash
npm ci
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npx prisma migrate status
```

### Existing database

Take a backup and inspect `_prisma_migrations` before changing anything. If the database was created from the old, incomplete history, reconcile it deliberately (usually by baselining/marking migrations as applied after comparing the actual schema). Never drop production data to make migration history look clean.

## V42 gate

Run:

```bash
npm run test:v42
```

This checks the repository migration sequence and baseline presence. It does not claim database execution without a live PostgreSQL instance.
