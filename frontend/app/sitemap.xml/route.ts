import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * sitemap.xml con caché en dos capas.
 *
 * Por qué no uso la convención `app/sitemap.ts`: esa ruta la genera Next y responde
 * `Cache-Control: no-store`, así que **nginx no puede cachearla** y el sitemap (10.000 URLs,
 * 1,4 MB) se regeneraba en cada petición, con su consulta a la base incluida.
 *
 * Aquí lo hago como ruta propia para poder hacer dos cosas:
 *   1. Cachear el XML en memoria una hora (no se repite la consulta ni el montaje).
 *   2. Declarar `Cache-Control: public, max-age=3600`, con lo que **nginx también lo cachea** y ni
 *      siquiera llega a la aplicación.
 *
 * Se regenera cada hora, así que las altas nuevas entran solas sin volver a desplegar.
 */
const BASE = "https://hestiat.com";
const UNA_HORA = 3600 * 1000;

let cache: { xml: string; expira: number } | null = null;

async function generar(): Promise<string> {
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${BASE}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${BASE}/search`, changefreq: "daily", priority: "0.8" },
    { loc: `${BASE}/experiencias`, changefreq: "weekly", priority: "0.6" },
    { loc: `${BASE}/reclamar`, changefreq: "monthly", priority: "0.3" },
    { loc: `${BASE}/servicios`, changefreq: "weekly", priority: "0.6" },
    { loc: `${BASE}/sobre`, changefreq: "monthly", priority: "0.4" },
    { loc: `${BASE}/como-funciona`, changefreq: "monthly", priority: "0.4" },
    { loc: `${BASE}/preguntas-frecuentes`, changefreq: "monthly", priority: "0.4" },
    { loc: `${BASE}/contacto`, changefreq: "monthly", priority: "0.3" },
    { loc: `${BASE}/aviso-legal`, changefreq: "yearly", priority: "0.2" },
    { loc: `${BASE}/privacidad`, changefreq: "yearly", priority: "0.2" },
    { loc: `${BASE}/cookies`, changefreq: "yearly", priority: "0.2" },
    { loc: `${BASE}/condiciones-uso`, changefreq: "yearly", priority: "0.2" },
  ];

  try {
    // Solo alojamientos publicados y con slug: una URL que no existe no se declara nunca.
    const [filas] = await pool.query<any[]>(
      `SELECT slug FROM accommodation
        WHERE status = 'published' AND slug IS NOT NULL AND slug <> ''
        ORDER BY id ASC LIMIT 10000`,
    );
    for (const f of filas) {
      urls.push({ loc: `${BASE}/alojamiento/${f.slug}`, changefreq: "weekly", priority: "0.7" });
    }
  } catch (error) {
    // Si la consulta falla, el sitemap sigue siendo válido con las rutas fijas: nunca un 500.
    console.error("[hestiat] sitemap: no se pudieron leer las fichas", error);
  }

  const partes = urls.map(
    (u) => `  <url>\n    <loc>${u.loc.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${partes.join("\n")}\n</urlset>\n`;
}

export async function GET() {
  const ahora = Date.now();
  let xml: string;
  let capa: string;

  if (cache && ahora < cache.expira) {
    xml = cache.xml;
    capa = "app-hit";
  } else {
    xml = await generar();
    cache = { xml, expira: ahora + UNA_HORA };
    capa = "app-miss";
  }

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Cacheable a propósito: es lo que permite que nginx lo guarde una hora.
      "cache-control": "public, max-age=3600",
      "x-cache-app": capa,
    },
  });
}
