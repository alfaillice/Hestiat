# Acta de copia verificada — Hestiat

**Veredicto: COPIA VERIFICADA**

- Fecha (UTC): 2026-10-03T17:10:52Z
- Volcado: `/home/ppxgfdyc/backups/hestiat-20261003-110008.sql.gz`
- Tamaño: 37986420 B
- SHA-256: `b3b997257658bbe11c90a35f7425ff0d9e6873dcbb3645d3be662d1ac8f39c12`
- Producción (solo lectura): `ppxgfdyc_hestiat`
- Destino: `ppxgfdyc_hestiat2` (conservada)

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Integridad (gzip -t) | INTEGRO |
| CREATE TABLE en el volcado | 33 (esperado 33) |
| Cierre limpio | sí |
| Cabecera | MariaDB dump 10.19-11.4.13-MariaDB, |
| INSERT INTO | 323 |
| Tablas restauradas | 33 (esperado 33) |
| Recuentos coincidentes | 32 |
| Diferencias en tablas persistentes | 0 |
| Deriva admisible en volátiles | 1 |

## Recuento por tabla

| Tabla | Producción | Restaurado | Resultado |
|---|---|---|---|
| `admin_auditoria` | 201 | 201 | coincide |
| `admin_cambios` | 18 | 18 | coincide |
| `alojamiento` | 27359 | 27359 | coincide |
| `alojamiento_anfitrion` | 3 | 3 | coincide |
| `alojamiento_contacto_cola` | 170 | 170 | coincide |
| `alojamiento_foto` | 17619 | 17619 | coincide |
| `alojamiento_servicio` | 12185 | 12185 | coincide |
| `auth_identities` | 2 | 2 | coincide |
| `auth_metricas` | 1 | 1 | coincide |
| `auth_nonce` | 1 | 1 | coincide |
| `campana_envio` | 6013 | 6013 | coincide |
| `disponibilidad` | 39 | 39 | coincide |
| `experiencia` | 262804 | 262804 | coincide |
| `experiencia_categoria` | 105 | 105 | coincide |
| `experiencia_provincia` | 50 | 50 | coincide |
| `ical_export_token` | 1 | 1 | coincide |
| `ical_feed` | 0 | 0 | coincide |
| `nucleo` | 68037 | 68037 | coincide |
| `nucleo_grid` | 67878 | 67878 | coincide |
| `nucleo_grid2` | 43200 | 43200 | coincide |
| `resena` | 1 | 1 | coincide |
| `reserva` | 1 | 1 | coincide |
| `servicio` | 29 | 29 | coincide |
| `servicio_import_estado` | 1 | 1 | coincide |
| `servicio_precio_marcador` | 1 | 1 | coincide |
| `servicio_turistico` | 35585 | 35585 | coincide |
| `servicio_turistico_categoria` | 0 | 0 | coincide |
| `servicio_turistico_provincia` | 50 | 50 | coincide |
| `usuario` | 3 | 3 | coincide |
| `usuario_baja` | 0 | 0 | coincide |
| `usuario_preferencias` | 0 | 0 | coincide |
| `usuario_reset` | 0 | 0 | coincide |
| `usuario_sesion` | 21 | 20 | deriva admisible (volátil) |

## Criterio aplicado

Se exige coincidencia exacta en las **tablas persistentes** (alojamientos, fotos, usuarios, reservas, reseñas, servicios, experiencias, núcleos, disponibilidad, calendarios). Se admite deriva **solo** en tablas volátiles u operativas, que cambian por el propio funcionamiento del sistema entre el volcado y la verificación: `usuario_sesion`, `admin_auditoria`, `admin_cambios`, `campana_envio`, `alojamiento_contacto_cola`, `auth_nonce`, `auth_metricas`, `usuario_reset`, `usuario_baja`, `servicio_import_estado`.

## Consecuencia

La copia queda **verificada por restauración**. Conforme a HESTIAT-OPERATIONS.md queda **LEVANTADA la prohibición de borrar** el código de la aplicación anterior, al haberse cumplido también la auditoría fresca y la copia de la aplicación con hash y prueba de extracción.
