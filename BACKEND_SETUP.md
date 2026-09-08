# Hestiat V1 — puesta en marcha del backend

1. Copia `.env.example` a `.env`.
2. Ejecuta `docker compose up -d`.
3. Instala dependencias: `pnpm install` (o npm/yarn si se decide otro gestor).
4. Ejecuta `pnpm db:generate`.
5. Ejecuta `pnpm db:push`.
6. Para desarrollo: `pnpm dev`.

## Flujo probado conceptualmente
Tipo de alojamiento → POST crea `Listing(DRAFT)` → cada paso hace PATCH al mismo `listing.id`.

## Pendiente antes de producción
- Autenticación real y autorización por `hostId`.
- Migraciones versionadas.
- Geocodificación y columna PostGIS real.
- Upload firmado a R2.
- Disponibilidad transaccional.
- Stripe Connect.
- Rate limiting, validación de schemas y auditoría.
