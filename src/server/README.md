# Hestiat backend foundation

Base V1 para pasar del prototipo a datos reales.

## Módulos
- users
- listings
- availability
- bookings

## Infraestructura
- PostgreSQL + PostGIS
- Redis
- Prisma

## Regla importante
La publicación y las reservas deben validarse en servidor. La interfaz nunca será la fuente de verdad para disponibilidad o precios.

## Siguiente implementación
1. Auth real
2. Crear/editar borrador desde el onboarding
3. Geocodificación + PostGIS `geography(Point, 4326)`
4. Disponibilidad transaccional
5. Stripe Connect
6. Publicación real y buscador
