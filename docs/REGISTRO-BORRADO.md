# Registro de borrado controlado — Hestiat

Fecha: 2026-10-03 (UTC)

## Eliminado

| Elemento | Tipo | Tamaño | Resultado |
|---|---|---|---|
| (nada que eliminar) | | | |

## Conservado, con motivo

| Elemento | Motivo |
|---|---|
| .output | aplicación en marcha: borrarlo dejaría el sitio fuera de servicio |
| .output.old | red de seguridad y vuelta atrás del build actual |
| app.cjs | arranque de la aplicación en funcionamiento |
| app.js | posible respaldo de arranque: ante la duda, no se toca |
| package.json | descriptor del despliegue actual |
| scripts | herramientas de operación (desplegador atómico, verificadores) |
| db | utilidades de base de datos aún sin evaluar |
| vendor | dependencias del build en marcha |
| tmp | directorio de trabajo del proceso |
| sitemap.xml | SEO en producción: se reemplaza cuando Hestiat 2.0 los genere |
| sitemap-1.xml | SEO en producción |
| sitemap-2.xml | SEO en producción |
| sitemap-3.xml | SEO en producción |
| sitemap-4.xml | SEO en producción |

## No tocado

| Elemento | Motivo |
|---|---|
| mse_config.php | fichero ajeno al proyecto |
| amc | pertenencia sin confirmar |
| cat | pertenencia sin confirmar |

## Producción tras el borrado

  / → HTTP 200 · /search → HTTP 200

Registro escrito: /home/ppxgfdyc/backups/REGISTRO-BORRADO.md
