# Hestiat 2.0

Marketplace de alojamiento con carácter — rural, natural, singular y de experiencias.
Dominio final: **https://hestiat.com**

Repositorio limpio, reconstruible y **sin secretos**. Este es el punto de partida:
`HESTIAT 2.0 — INITIAL FOUNDATION`.

## Estado

Fase de **fundación**, sin tocar producción. Contiene:

```
docs/HESTIAT-MASTER-SPEC.md    visión, arquitectura, diseño, datos, seguridad y despliegue
docs/HESTIAT-OPERATIONS.md     bloqueos actuales, estado de copias y procedimiento de borrado
db/migrations/001_init.sql     esquema inicial (usuarios, alojamientos, fotos, reservas,
                               reseñas, calendarios, auditoría y control de migraciones)
src/                           aplicación (se construye en la siguiente fase)
scripts/                       migrador y utilidades de operación
```

## Principios que gobiernan el proyecto

1. Seguridad e integridad de datos **antes** que velocidad de desarrollo.
2. Sin valoraciones inventadas: sin reseñas se muestra «Nuevo».
3. Precio real y orientativo siempre distinguidos, con su fuente.
4. Los medios son infraestructura crítica: R2 propio, nunca URLs de terceros.
5. Nada privado en el bucket público.
6. Autorización siempre comprobada en servidor.
7. Una función no está terminada hasta que está probada en real.

## Puesta en marcha (local)

```bash
git clone <repo> && cd hestiat2
cp .env.example .env        # rellenar con valores locales; NUNCA con los de producción
npm install
npm run db:migrate          # aplica db/migrations en orden
npm run dev
```

El esquema se aplica con migraciones versionadas. **Nunca se modifica producción a mano sin registrar la migración.**

## Documentación

Toda la documentación técnica vive en `docs/`. Los detalles operativos, los bloqueos pendientes
y el procedimiento para retomar el borrado del sistema anterior están en
`docs/HESTIAT-OPERATIONS.md`.
