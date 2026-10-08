import { NextResponse } from "next/server";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * BUSCADOR GENERAL DE LA CABECERA: decide a dónde lleva lo que se ha escrito.
 *
 * La cabecera solo tiene un campo y una lupa, así que la decisión se toma aquí: se mira qué es eso
 * —una ciudad, una provincia, una zona, el nombre de un alojamiento, de una experiencia o de un
 * servicio— y se manda a la página que corresponde, con la búsqueda ya aplicada.
 *
 * Vive en /descubrir a propósito: /buscar es una dirección antigua que ya redirige a /search desde
 * la configuración del sitio (y debe seguir haciéndolo, porque hay enlaces y marcadores con ella).
 *
 * Cómo decide, sin inventar nada:
 *  1. Si lo escrito es EL NOMBRE EXACTO de un alojamiento y de uno solo (y no es una palabra suelta
 *     corta), se va directo a su ficha.
 *  2. Si no, se cuentan las coincidencias reales en los tres catálogos.
 *  3. Y se dan más puntos a las señales fuertes: que sea un municipio o una provincia, o que empiece
 *     por una categoría o subcategoría del catálogo (por eso «Museo» lleva a experiencias y
 *     «Masajes» a servicios).
 *  4. Si no hay nada, se va a alojamientos con la búsqueda puesta: allí se ve el estado de «sin
 *     resultados» y las alternativas.
 *
 * Es un GET normal y corriente, así que funciona igual sin JavaScript.
 */
async function contar(sql: string, valores: unknown[]): Promise<number> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(sql, valores);
  return Number(filas[0]?.n ?? 0);
}

/**
 * Redirección TEMPORAL (307): conserva el método y no se queda cacheada ni en el navegador ni en los
 * intermediarios. Importa: si mañana cambia la forma de decidir, nadie se queda con la vieja.
 *
 * La dirección va RELATIVA a propósito: detrás de un proxy, la dirección absoluta que ve la
 * aplicación por dentro es la interna (localhost:3000) y mandar al navegador ahí lo rompería.
 */
function temporal(destino: URL) {
  return new NextResponse(null, { status: 307, headers: { Location: `${destino.pathname}${destino.search}` } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim();

  const irA = (ruta: string) => {
    const destino = new URL(ruta, url.origin);
    if (q) destino.searchParams.set("q", q);
    return temporal(destino);
  };

  // Menos de dos letras no es una búsqueda: al catálogo de alojamientos, sin ensuciar la dirección.
  if (q.length < 2) return temporal(new URL("/search", url.origin));

  const like = `%${q}%`;
  const empieza = `${q}%`;

  try {
    // 1) Nombre exacto de un alojamiento, y de uno solo. La tabla pública del catálogo es
    //    `accommodation` (la de los anfitriones, `alojamiento`, se escribe desde el editor y se
    //    vuelca también aquí, así que buscando en esta se encuentra todo lo publicado).
    const [exactos] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT slug FROM accommodation WHERE status = 'published' AND title = ? LIMIT 2`,
      [q],
    );
    const palabras = q.split(" ").filter(Boolean).length;
    if (exactos.length === 1 && (palabras >= 2 || q.length >= 8)) {
      return temporal(new URL(`/alojamiento/${encodeURIComponent(String(exactos[0].slug))}`, url.origin));
    }

    // 2) Cuánto hay de esto en cada catálogo.
    const [alojamiento, experiencia, servicio] = await Promise.all([
      contar(
        `SELECT COUNT(*) AS n FROM accommodation
          WHERE status = 'published' AND (title LIKE ? OR city LIKE ? OR province LIKE ?)`,
        [like, like, like],
      ),
      contar(
        `SELECT COUNT(*) AS n FROM experiencia
          WHERE is_active = 1 AND (name LIKE ? OR municipality LIKE ? OR province LIKE ? OR category LIKE ? OR subcategory LIKE ?)`,
        [like, like, like, like, like],
      ),
      contar(
        `SELECT COUNT(*) AS n FROM servicio_turistico
          WHERE is_active = 1 AND (name LIKE ? OR municipality LIKE ? OR province LIKE ? OR category LIKE ? OR subcategory LIKE ?)`,
        [like, like, like, like, like],
      ),
    ]);

    // 3) Señales fuertes: es un lugar, o empieza por una categoría del catálogo.
    const [lugar, categoriaExperiencia, categoriaServicio] = await Promise.all([
      contar(
        `SELECT COUNT(*) AS n FROM accommodation WHERE status = 'published' AND (city = ? OR province = ?)`,
        [q, q],
      ),
      contar(
        `SELECT COUNT(*) AS n FROM experiencia WHERE is_active = 1 AND (category LIKE ? OR subcategory LIKE ?)`,
        [empieza, empieza],
      ),
      contar(
        `SELECT COUNT(*) AS n FROM servicio_turistico WHERE is_active = 1 AND (category LIKE ? OR subcategory LIKE ?)`,
        [empieza, empieza],
      ),
    ]);

    const puntos: [string, number][] = [
      ["alojamiento", alojamiento + lugar * 3000],
      ["experiencia", experiencia + categoriaExperiencia * 2500],
      ["servicio", servicio + categoriaServicio * 2500],
    ];
    puntos.sort((a, b) => b[1] - a[1]);
    const [ganador, puntuacion] = puntos[0];
    if (puntuacion <= 0) return irA("/search");
    if (ganador === "experiencia") return irA("/experiencias");
    if (ganador === "servicio") return irA("/servicios");
    return irA("/search");
  } catch (error) {
    console.error("[hestiat] /descubrir", error instanceof Error ? error.message.slice(0, 160) : error);
    // Ante un fallo, la búsqueda general de alojamientos: es la que nunca deja a nadie sin salida.
    return irA("/search");
  }
}
