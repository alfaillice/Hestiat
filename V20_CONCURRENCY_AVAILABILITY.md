# Hestiat V20 — disponibilidad y concurrencia

## Implementado

- Autoridad única de disponibilidad en `src/server/modules/availability/unified.ts`.
- Combina bloqueos manuales, reservas internas PENDING/CONFIRMED y reservas externas ACTIVE.
- Detecta explícitamente `CONFLICT` cuando existen reservas internas y externas solapadas.
- Checkout serializa por alojamiento mediante `pg_advisory_xact_lock` dentro de la transacción.
- El quote y el checkout consultan la misma autoridad de disponibilidad.
- Los PENDING expirados dejan de bloquear disponibilidad aunque el worker todavía no haya ejecutado su limpieza.
- Reintento de hasta 3 veces ante `P2034` (conflicto de serialización).
- Test de carrera: dos reservas simultáneas para las mismas fechas; exactamente una debe ganar.

## Ejecutar

```bash
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:push
pnpm test:v20
```

La prueba V20 crea datos temporales y los elimina al terminar correctamente.

## Nota de producción

El lock advisory protege los caminos de checkout que usan este servicio. Las futuras escrituras administrativas de reservas deben pasar también por este servicio o por una capa equivalente para mantener una única autoridad de concurrencia.
