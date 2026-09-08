# Hestiat V38 — Testing & Bug Fix / Release Hardening

## Cambios
- Unificado el origen público de URLs transaccionales: `APP_URL` → `NEXT_PUBLIC_APP_URL` → origen de la petición.
- Eliminada la duplicación de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` en `.env.example`.
- Añadido `test:release` para validar esquema Prisma, TypeScript y pruebas invariantes disponibles.
- Mantiene V37 como base y no altera la autoridad de disponibilidad, pagos, cancelaciones ni canales.

## Validación ejecutada en este entorno
- Revisión estática de rutas y configuración: OK.
- No se ejecutó `npm run typecheck`/`build` porque el ZIP no incluye `node_modules` ni lockfile y este entorno no tiene las dependencias instaladas.
- Las pruebas que requieren PostgreSQL/PostGIS, Redis o Stripe deben ejecutarse con la infraestructura real.

## Checklist de release
1. `npm install` / `pnpm install` con lockfile generado y fijado.
2. `npx prisma validate`.
3. `npx prisma generate`.
4. `npm run typecheck`.
5. `npm run build`.
6. Levantar PostgreSQL/PostGIS + Redis.
7. Ejecutar pruebas V20/V22/V23/V27/V28/V32/V35.
8. Configurar `APP_URL` con `https://hestiat.com` en producción.
9. Configurar Stripe, Resend, WhatsApp y secretos de operaciones.
10. Revisar y consolidar numeración de migraciones antes del primer despliegue productivo.
