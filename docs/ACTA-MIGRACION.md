===== ACTA DE MIGRACIÓN =====
# Acta de migración — Hestiat 2.0

**Base de datos: `ppxgfdyc_hestiat2`** (copia verificada). Producción NO se ha tocado.

- Fecha (UTC): 2026-10-03T17:18:59Z
- Esquema destino: `db/migrations/001_init.sql`
- Método: `INSERT IGNORE` con `legacy_id`, idempotente y repetible

## Resultado por entidad

| Entidad | Tabla origen | Filas origen | Tabla destino | Filas destino | Insertadas |
|---|---|---|---|---|---|
| usuario | usuario | 3 | user | 3 | 0 |
| alojamiento | alojamiento | 27359 | accommodation | 27359 | 0 |
| alojamiento_foto | alojamiento_foto | 17619 | accommodation_photo | 88095 | 17619 |
| alojamiento_servicio | alojamiento_servicio | 12185 | accommodation_amenity | 12185 | 0 |
| reserva | reserva | 1 | reservation | 1 | 0 |
| resena | resena | 1 | review | 5 | 1 |
| ical_feed | ical_feed | 0 | calendar_feed | 0 | 0 |
| disponibilidad | disponibilidad | 39 | availability | 39 | 0 |

## Incidencias

Ninguna.

## Notas

- Las fotos conservan su `origin_url` (procedencia externa) y solo se marca `storage_key` cuando la URL ya es nuestra.
- La fotografía principal se calcula como la de menor `sort_order` de cada alojamiento.
- Los alojamientos sin `slug` reciben uno derivado de su identificador para no colisionar.

===== estado de la migración =====
terminado: 2026-10-03T17:18:59+00:00
usuario: origen=3 destino=3 insertadas=0 
alojamiento: origen=27359 destino=27359 insertadas=0 
alojamiento_foto: origen=17619 destino=88095 insertadas=17619 
alojamiento_servicio: origen=12185 destino=12185 insertadas=0 
reserva: origen=1 destino=1 insertadas=0 
resena: origen=1 destino=5 insertadas=1 
ical_feed: origen=0 destino=0 insertadas=0 
disponibilidad: origen=39 destino=39 insertadas=0 

===== registro del ETL (últimas líneas) =====
  Acta de migración escrita: /home/ppxgfdyc/backups/ACTA-MIGRACION.md
  FIN
  === ETL Hestiat 2.0 · base ppxgfdyc_hestiat2 ===
    usuario                  origen=3        destino=3        insertadas=0        ok
    alojamiento              origen=27359    destino=27359    insertadas=0        ok
    alojamiento_foto         origen=17619    destino=88095    insertadas=17619    ok
    alojamiento_servicio     origen=12185    destino=12185    insertadas=0        ok
    reserva                  origen=1        destino=1        insertadas=0        ok
    resena                   origen=1        destino=5        insertadas=1        ok
    ical_feed                origen=0        destino=0        insertadas=0        ok
    disponibilidad           origen=39       destino=39       insertadas=0        ok
  
  Acta de migración escrita: /home/ppxgfdyc/backups/ACTA-MIGRACION.md
  FIN
