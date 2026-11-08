<!-- EJEMPLO: generado con un banco de pruebas y los recuentos reales de la auditoría.
     NO es un acta de verificación real. La real la produce restaurar-verificado.sh. -->

# Acta de copia verificada — Hestiat

**Veredicto: COPIA VERIFICADA**

- Fecha (UTC): 2026-10-03T16:26:49Z
- Volcado: `/tmp/t3/bk/hestiat-20261003-110008.sql.gz`
- Tamaño: 243 B
- SHA-256: `3de90c9769491cdbe21a113a9e04e5e85aba188b351457b305eaa41195f951c7`
- Base de producción (solo lectura, para comparar): `ppxgfdyc_hestiat`
- Base destino de la restauración: `hestiat2` (conservada)

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Integridad del archivo (`gzip -t`) | INTEGRO |
| Sentencias `CREATE TABLE` en el volcado | 33 (esperado 33) |
| Cierre limpio del volcado | sí |
| Cabecera | MariaDB dump 10.19-11.4.13-MariaDB, |
| Sentencias `INSERT INTO` | 1 |
| Código de la restauración | 0 |
| Tablas restauradas | 33 (esperado 33) |
| Recuentos coincidentes | 12 |
| Recuentos diferentes | 0 |

## Recuento de filas por tabla (producción vs restaurado)

| Tabla | Producción | Restaurado | Resultado |
|---|---|---|---|
| `alojamiento` | 27359 | 27359 | coincide |
| `alojamiento_foto` | 17619 | 17619 | coincide |
| `alojamiento_servicio` | 12185 | 12185 | coincide |
| `usuario` | 3 | 3 | coincide |
| `reserva` | 1 | 1 | coincide |
| `resena` | 1 | 1 | coincide |
| `experiencia` | 262804 | 262804 | coincide |
| `servicio_turistico` | 35585 | 35585 | coincide |
| `nucleo` | 68037 | 68037 | coincide |
| `ical_feed` | 0 | 0 | coincide |
| `admin_auditoria` | 152 | 152 | coincide |
| `disponibilidad` | 39 | 39 | coincide |

## Consecuencia

La copia queda **verificada por restauración**. Conforme a HESTIAT-OPERATIONS.md,
queda **levantada la prohibición de borrar** el código de la aplicación anterior,
siempre que se cumplan también el resto de pasos previos (auditoría fresca y copia
de la aplicación con hash y prueba de extracción).
