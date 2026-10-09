import { NextResponse } from "next/server";
import { BASE, cuentasIndexables } from "@/lib/seo.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SITEMAP — ÍNDICE.
 *
 * Antes esto era un único fichero con un tope de 10.000 URLs: dejaba fuera a 7.609 alojamientos y a
 * TODAS las experiencias y servicios, y metía páginas sin contenido. Ahora es un índice que reparte el
 * trabajo por tipo, y cada sitemap hijo declara SOLO las URLs que cumplen los criterios de indexación.
 *
 * Nada que no deba indexarse entra aquí: ni paneles, ni administración, ni resultados de búsqueda con
 * parámetros, ni fichas sin contenido suficiente.
 */
export async function GET() {
  const cuentas = await cuentasIndexables();
  const hoy = new Date().toISOString().slice(0, 10);

  const hijos: Array<{ ruta: string; n: number; priority: string }> = [
    { ruta: "paginas", n: cuentas.paginas, priority: "0.8" },
    { ruta: "ciudades", n: cuentas.ciudades, priority: "0.9" },
    { ruta: "alojamientos", n: cuentas.alojamientos, priority: "0.7" },
    { ruta: "experiencias", n: cuentas.experiencias, priority: "0.6" },
    { ruta: "servicios", n: cuentas.servicios, priority: "0.6" },
  ];
  if (cuentas.guias > 0) hijos.push({ ruta: "guias", n: cuentas.guias, priority: "0.8" });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${hijos
  .filter((h) => h.n > 0)
  .map(
    (h) => `  <sitemap>
    <loc>${BASE}/sitemaps/${h.ruta}.xml</loc>
    <lastmod>${hoy}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
      // Se declaran los recuentos para poder comprobarlos sin abrir cada fichero.
      "x-sitemap-cuentas": hijos.map((h) => `${h.ruta}:${h.n}`).join(","),
    },
  });
}
