# Plan de cutover — Hestiat 2.0

Cómo sustituir la aplicación anterior por Hestiat 2.0 y completar el borrado controlado,
**sin dejar producción fuera de servicio ni un solo momento sin vuelta atrás**.
Última actualización: 2026-10-03.

---

## 1. Objetivo y principio

Sustituir el código en marcha (`.output`, `app.cjs`, `package.json`) por Hestiat 2.0, y
eliminar después el código antiguo. El principio que gobierna todo el plan:

> **Primero existe el sustituto validado. Solo después se borra lo anterior.**

Ese es el motivo por el que el borrado del código en marcha **no se ha ejecutado todavía**:
borrarlo ahora dejaría el sitio sin aplicación y sin nada que lo sustituya.

---

## 2. Estado de partida y prerrequisitos

| Prerrequisito | Estado |
|---|---|
| Copia de datos verificada por restauración | **HECHO** · 33/33 tablas, 0 diferencias persistentes · `docs/ACTA-COPIA-VERIFICADA.md` |
| Copia de la aplicación con hash y extracción | **HECHO** · 3.106.370 B · 314 ficheros · entry idéntico |
| Auditoría fresca | **HECHA** · `docs/AUDITORIA-2026-10-03.md` |
| Datos migrados al esquema nuevo | **HECHO** · 27.359 alojamientos, 17.619 fotos, 12.185 servicios · `docs/ACTA-MIGRACION.md` |
| Copia fuera del servidor (bucket privado) | **PENDIENTE** · falta el token de R2 operativo |
| Hestiat 2.0 construido y validado | **PENDIENTE** · es el gran bloque pendiente |
| Acceso operativo estable | **PENDIENTE** · la IP del entorno se bloquea; conviene lista blanca permanente o SSH |

**No se inicia el cutover hasta que los cuatro últimos estén cerrados.**

---

## 3. Fases

### Fase A · Congelación y copia final
1. Anunciar ventana de mantenimiento (tráfico bajo: madrugada).
2. **Copia de datos final** inmediatamente antes del corte (la actual es de las 11:02).
3. Verificarla por restauración, igual que la primera.
4. Copia del código en marcha con hash.
> Sin copia final verificada, no se sigue.

### Fase B · Preparación del sustituto
5. Build de Hestiat 2.0 con `NITRO_PRESET=node-server`.
6. Empaquetar el `.output` completo en un ZIP **con verificación de nombres y tamaños**.
7. Desplegar en `.output.nuevo` **sin tocar** el `.output` en servicio.
8. Arrancar el nuevo build en pruebas y ejecutar la batería de humo contra él.

### Fase C · Corte (atómico)
9. `.output` → `.output.antes-del-cutover` (queda como vuelta atrás inmediata).
10. `.output.nuevo` → `.output`.
11. Vaciar el pool (`pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'`); LiteSpeed relanza.
12. **Comprobación inmediata**: `/` 200, `/search` 200, ficha real 200, 404 correcto sin 500.

### Fase D · Verificación completa (batería de humo)
13. Páginas: portada, búsqueda, filtros, ficha, experiencias, servicios, login.
14. Datos: alojamiento concreto con sus fotos y servicios; recuentos contra la base.
15. Autenticación: `/admin` y `/host` → 307 a login; sesión correcta tras entrar.
16. Autorización: propietario A no ve lo de B (batería de casos negativos).
17. Medios: una foto real se sirve por HTTP 200 con su hash.
18. Reservas y calendarios: consulta y estados.
19. Rendimiento: portada < 2 s, buscador < 500 ms.
20. SEO: `robots.txt`, sitemap nuevo, canónicas y metadatos.

### Fase E · Borrado controlado del código anterior
Solo con la Fase D superada y **al menos 24 h de observación sin incidencias**.

| Orden | Elemento | Acción |
|---|---|---|
| 1 | `.output.old` (build antiguo previo) | Borrar |
| 2 | `app.js` | Borrar (respaldo de arranque ya innecesario) |
| 3 | `package.json` antiguo | Reemplazar por el de Hestiat 2.0 |
| 4 | `app.cjs` | Borrar cuando el nuevo arranque esté confirmado |
| 5 | `.output.antes-del-cutover` | Borrar tras 7 días sin incidencias |
| 6 | `sitemap-*.xml` antiguos | Reemplazar por los que genere Hestiat 2.0 |

**Nunca se borra en esta fase**: backups, la base original `ppxgfdyc_hestiat`, objetos de R2,
`hestiat-media/`, `.env` y sus copias, `mse_config.php`, `amc/`, `cat/`, ni nada de otros dominios.

### Fase F · Cierre
21. Registrar el borrado (ver `docs/REGISTRO-BORRADO.md` como plantilla).
22. Actualizar la documentación y la versión.
23. **No activar Cloudflare Proxy** hasta que el cliente lo autorice expresamente.

---

## 4. Vuelta atrás

Disponible en **cada** fase, con estos elementos ya existentes o preparados:

| Elemento | Para qué | Dónde |
|---|---|---|
| `.output.old` | Volver al build anterior a la última intervención | docroot |
| `.output.antes-del-cutover` | Volver a la aplicación antigua completa | docroot |
| Volcado verificado de datos | Restaurar la base | `/home/ppxgfdyc/backups/` (0600) |
| Copia de la aplicación | Reconstruir el código antiguo | `/home/ppxgfdyc/backups/app/` |
| Base original `ppxgfdyc_hestiat` | **Intacta**: es el respaldo definitivo de los datos | servidor |

**Procedimiento de vuelta atrás** (dos comandos):
```
cd /home/ppxgfdyc/hestiat.com
mv .output .output.fallido && mv .output.antes-del-cutover .output
pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
```
Y si hubiera que revertir datos: restaurar el volcado verificado sobre la base correspondiente,
nunca sobre producción sin haberlo probado antes en una copia.

---

## 5. Criterio para dar el cutover por bueno

No basta con que compile ni con que abra la portada. Debe cumplirse:

- aplicación, base de datos y R2 funcionando
- autenticación y autorización verificadas, con casos negativos
- aislamiento entre propietarios probado
- alta, edición, fotos, mapa, precios y búsqueda funcionando
- disponibilidad, iCal y reservas funcionando
- móvil y escritorio correctos
- auditoría de seguridad y de rendimiento hechas
- SEO implementado y accesibilidad comprobada
- copias verificadas y vuelta atrás probada
- despliegue reproducible y monitorización activa
- documentación completa

---

## 6. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| El nuevo build falla al arrancar | Corte atómico: `.output` se cambia en un renombrado |
| Pérdida de datos recientes | Copia final inmediatamente antes del corte |
| Datos duplicados en la migración | ETL idempotente con `legacy_id`; recuentos en el acta (ya detectó y corrigió una duplicación) |
| Un propietario ve datos de otro | Batería de casos negativos en la Fase D |
| Se sirve una página rota | Verificación de coherencia ya construida: el HTML debe pedir un asset que responda 200 |
| Pérdida de posicionamiento SEO | Mantener las rutas actuales y regenerar los sitemaps antes de retirar los antiguos |

---

## 7. Lo que falta para poder ejecutarlo

1. **Construir Hestiat 2.0** sobre el esquema ya migrado (los datos están listos).
2. **Cerrar el token de R2** para que las copias salgan del servidor.
3. **Acceso operativo estable**: lista blanca permanente de la IP del entorno o SSH.
