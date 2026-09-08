# Hestiat V43 — Staging DB Validation

## Objetivo
Validar la cadena Prisma 0001–0015 contra una base PostgreSQL + PostGIS limpia y Redis real.

## Ejecución
1. Copiar `.env.staging.example` a `.env` y ajustar secretos.
2. Ejecutar `docker compose up -d postgres redis`.
3. Comprobar `docker compose ps` y healthchecks.
4. Ejecutar `npx prisma validate`.
5. Ejecutar `npx prisma migrate deploy`.
6. Ejecutar `npx prisma generate`.
7. Ejecutar `npm run typecheck`.
8. Ejecutar los tests V20/V22/V27/V28/V32/V35.
9. Ejecutar `npm run test:v43`.

## Criterio de aprobación
No se considera staging validado hasta que `prisma migrate deploy`, `prisma generate`, `typecheck` y los tests críticos terminen correctamente contra infraestructura real.

## Nota
En el entorno donde se preparó este release no hay Docker disponible y la instalación de Prisma por `npx` no terminó dentro del tiempo permitido. Por ello la validación de infraestructura queda explícitamente PENDIENTE, no PASS.
