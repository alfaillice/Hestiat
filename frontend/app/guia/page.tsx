import type { Metadata } from "next";
import Link from "next/link";
import { pool } from "@/lib/db";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadatosInformativos({
  titulo: "Guías de destino — Hestiat",
  descripcion:
    "Guías útiles para preparar una visita: qué hay en cada destino, actividades y recomendaciones prácticas. Se publican solo después de una revisión humana.",
  ruta: "/guia",
});

/**
 * GUÍAS DE DESTINO.
 *
 * ARQUITECTURA PREPARADA, CONTENIDO SIN PUBLICAR TODAVÍA.
 *   · Una guía nace como borrador (`borrador`), pasa a `en_revision` y solo se publica cuando una
 *     persona la revisa y la firma. La IA puede preparar borradores; no puede publicar.
 *   · Aquí solo aparece lo que tiene estado `publicada`. Si no hay ninguna, se dice: no se rellena con
 *     contenido de mentira ni con textos repetidos para aparentar.
 *   · La página se marca `noindex` mientras no haya guías publicadas: una página vacía no debe pedir
 *     que se indexe.
 */
export default async function IndiceGuias() {
  let guias: Array<{ slug: string; titulo: string; resumen: string | null; destino: string | null; publicado_en: string | null }> = [];
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT slug, titulo, resumen, destino, publicado_en FROM guia
        WHERE estado = 'publicada' ORDER BY publicado_en DESC LIMIT 60`,
    );
    guias = filas as never;
  } catch {
    guias = [];
  }

  return (
    <main className="wrap" style={{ paddingTop: 20 }}>
      <h1>Guías de destino</h1>
      <p style={{ maxWidth: "70ch", color: "var(--muted-fg)" }}>
        Guías para preparar una visita con información útil y comprobada. Cada guía se revisa a mano
        antes de publicarse, y en ella se distingue lo que es un dato comprobado de lo que es una
        recomendación.
      </p>

      {guias.length === 0 ? (
        <>
          {/* Una página sin guías no debe pedir indexación. */}
          <meta name="robots" content="noindex,follow" />
          <p className="aviso" style={{ marginTop: 18 }}>
            Todavía no hay ninguna guía publicada. Estamos preparándolas con revisión humana antes de
            publicar. Mientras tanto, puedes explorar el catálogo real:
          </p>
          <ul className="ia-lista" style={{ marginTop: 10 }}>
            <li><Link href="/destinos">Destinos con contenido real del catálogo</Link></li>
            <li><Link href="/experiencias">Experiencias</Link> · <Link href="/servicios">Servicios</Link> · <Link href="/search">Alojamientos</Link></li>
            <li><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link> · <Link href="/como-reservar">Cómo reservar</Link></li>
          </ul>
        </>
      ) : (
        <ul className="ia-lista" style={{ marginTop: 18 }}>
          {guias.map((g) => (
            <li key={g.slug}>
              <Link href={`/guia/${g.slug}`}><b>{g.titulo}</b></Link>
              {g.destino ? ` — ${g.destino}` : ""}
              {g.resumen ? <p style={{ color: "var(--muted-fg)" }}>{g.resumen}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
