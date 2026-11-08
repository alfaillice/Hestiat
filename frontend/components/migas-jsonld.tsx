/**
 * MIGAS DE PAN ESTRUCTURADAS (schema.org / BreadcrumbList).
 *
 * ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────────────────────────
 * Las páginas de listado —/destinos, /experiencias y /servicios— se servían SIN ningún dato
 * estructurado: cero bloques JSON-LD. Las fichas sí llevaban el suyo, pero los listados no, así que
 * Google no tenía migas que mostrar bajo el título en los resultados ni una jerarquía que entender.
 *
 * ── POR QUÉ UN COMPONENTE Y NO TRES COPIAS ──────────────────────────────────────────────────────
 * La estructura es idéntica en las tres páginas: cambia solo la lista de migas. Duplicar el objeto
 * JSON tres veces garantiza que dentro de dos meses dos estén bien y una mal.
 *
 * ── NADA INVENTADO ──────────────────────────────────────────────────────────────────────────────
 * Los nombres y las rutas se pasan desde la propia página, que es la que conoce sus datos reales.
 * Aquí no hay ni un texto fijo: solo se da formato a lo que recibe.
 */

export interface Miga {
  nombre: string;
  ruta: string;
}

const BASE = "https://hestiat.com";

export default function MigasJsonLd({ items }: { items: Miga[] }) {
  if (!items.length) return null;

  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((miga, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: miga.nombre,
      item: `${BASE}${miga.ruta}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
