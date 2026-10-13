import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  BASE,
  PAGINAS_FIJAS,
  urlsAlojamientos,
  urlsCiudades,
  urlsExperiencias,
  urlsServicios,
} from "@/lib/seo.server";
import { categoriasConDatos } from "@/lib/experiencias.server";
import { categoriasServicioConDatos } from "@/lib/servicios.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SITEMAPS POR TIPO: /sitemaps/<tipo>.xml
 *
 * Cada uno declara únicamente URLs canónicas que deben indexarse. Los datos privados no salen nunca de
 * aquí: solo rutas públicas y comprobadas. Si un tipo no tiene URLs, responde 404 en vez de un fichero
 * vacío (un sitemap vacío es ruido para el buscador).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo: crudo } = await params;
  const tipo = String(crudo).replace(/\.xml$/i, "").toLowerCase();

  let urls: string[] = [];
  let changefreq = "weekly";
  let priority = "0.6";

  if (tipo === "paginas") {
    urls = PAGINAS_FIJAS.map((p) => `${BASE}${p}`);
    changefreq = "monthly";
    priority = "0.8";
  } else if (tipo === "ciudades") {
    urls = await urlsCiudades();
    priority = "0.9";
  } else if (tipo === "alojamientos") {
    urls = await urlsAlojamientos();
    priority = "0.7";
  } else if (tipo === "experiencias") {
    urls = await urlsExperiencias();
    // PÁGINAS DE CATEGORÍA (12-10-2026): tienen canónica propia, título propio con el nombre y el
    // recuento REALES de su categoría, y están permitidas en robots.txt. Se declaran aquí para que
    // Google las descubra sin esperar a que las encuentre rastreando. La lista sale de la MISMA
    // función que usa la propia página.
    //
    // Va en su propio try/catch a propósito: si algún día la lectura de categorías falla, el sitemap
    // tiene que seguir sirviendo las fichas en vez de devolver un error al buscador.
    try {
      const cats = await categoriasConDatos();
      console.log(`[sitemap] experiencias: ${urls.length} fichas + ${cats.length} categorias`);
      urls = [...urls, ...cats.map((c) => `${BASE}/experiencias?categoria=${encodeURIComponent(String(c.slug))}`)];
    } catch (error) {
      console.error("[sitemap] categorias de experiencias:", error instanceof Error ? error.message : error);
    }
  } else if (tipo === "servicios") {
    urls = await urlsServicios();
    try {
      const cats = await categoriasServicioConDatos();
      console.log(`[sitemap] servicios: ${urls.length} fichas + ${cats.length} categorias`);
      urls = [...urls, ...cats.map((c) => `${BASE}/servicios?categoria=${encodeURIComponent(String(c.slug))}`)];
    } catch (error) {
      console.error("[sitemap] categorias de servicios:", error instanceof Error ? error.message : error);
    }
  } else if (tipo === "guias") {
    try {
      const [filas] = await pool.query<any[]>(
        `SELECT slug FROM guia WHERE estado = 'publicada' ORDER BY id ASC`,
      );
      urls = filas.map((f) => `${BASE}/guia/${f.slug}`);
      changefreq = "monthly";
      priority = "0.8";
    } catch {
      urls = [];
    }
  } else {
    return new NextResponse("Sitemap no reconocido.", { status: 404 });
  }

  if (urls.length === 0) return new NextResponse("Sin URLs que declarar.", { status: 404 });

  // Solo URLs canónicas de nuestro dominio. La regla original descartaba CUALQUIER dirección con
  // parámetros («nada de filtros»), y eso es lo que hacía desaparecer las páginas de categoría: se
  // añadían a la lista y se borraban aquí mismo. Ahora se admite UNA excepción, la categoría, que es
  // la única que tiene canónica propia, título propio y permiso en robots.txt. Cualquier otra
  // combinación de parámetros (provincia, búsqueda, paginación, o categoría con algo más) sigue
  // quedándose fuera: el sitemap no declara páginas que no deben indexarse.
  const esCategoria = (u: string) => /[?&]categoria=[^&]+$/.test(u);
  const limpias = [...new Set(urls.filter((u) => u.startsWith(`${BASE}/`) && (!u.includes("?") || esCategoria(u))))];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${limpias
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-sitemap-urls": String(limpias.length),
    },
  });
}
