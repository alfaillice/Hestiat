import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { esTituloDeSeccion, fechaISO, trozosDelCuerpo } from "@/lib/guia-render";

export const dynamic = "force-dynamic";

/**
 * UNA GUÍA DE DESTINO.
 *
 * Solo se muestran guías con estado `publicada`: un borrador o una guía en revisión no se sirven al
 * público (responden 404, no una página a medias). La guía que sí se publica pide indexación; la que
 * está en revisión, no.
 *
 * El contenido va firmado por quien lo revisó, para que se pueda ver que ha pasado por una persona.
 */
async function cargar(slug: string) {
  const [filas] = await pool.query<any[]>(`SELECT * FROM guia WHERE slug = ? LIMIT 1`, [slug]);
  return filas[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await cargar(slug);
  if (!g || String(g.estado) !== "publicada") notFound();
  return {
    title: `${g.titulo} — Guía de Hestiat`,
    description: (g.resumen ?? "").slice(0, 160) || `${g.titulo}: guía de destino de Hestiat.`,
    alternates: { canonical: `/guia/${g.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title: g.titulo, type: "article" },
  };
}

export default async function PaginaGuia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await cargar(slug);
  if (!g || String(g.estado) !== "publicada") notFound();

  // Cabecera: la imagen de referencia de la LOCALIDAD, y solo si el catálogo la tiene.
  // Se busca por el nombre exacto del destino (no se usa la cadena de respaldo de
  // provincia ni de país: una imagen de España no es una imagen de Santiago). Si no
  // existe, no se muestra ninguna fotografía y no se genera nada que lo sustituya.
  let referencia: { url: string; fuente: string | null } | null = null;
  if (g.destino) {
    try {
      const [filas] = await pool.query<any[]>(
        `SELECT url, fuente FROM localidad_imagen
          WHERE tipo = 'ciudad' AND clave = ? AND url IS NOT NULL LIMIT 1`,
        [String(g.destino).toLowerCase()],
      );
      referencia = filas[0]?.url
        ? { url: String(filas[0].url), fuente: filas[0].fuente ? String(filas[0].fuente) : null }
        : null;
    } catch {
      referencia = null;
    }
  }

  // El cuerpo se sirve como trozos: las direcciones, como enlaces; el texto, intacto.
  const partes = trozosDelCuerpo(String(g.cuerpo ?? ""));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Hestiat", item: "https://hestiat.com/" },
          { "@type": "ListItem", position: 2, name: "Guías", item: "https://hestiat.com/guia" },
          { "@type": "ListItem", position: 3, name: g.titulo, item: `https://hestiat.com/guia/${g.slug}` },
        ],
      },
      {
        "@type": "Article",
        headline: g.titulo,
        description: g.resumen ?? undefined,
        // Fecha real de publicación, en ISO 8601 (el servidor y la base de datos van en UTC).
        datePublished: fechaISO(g.publicado_en),
        dateModified: fechaISO(g.revisado_en ?? g.publicado_en),
        // Solo se declara imagen si existe una imagen de referencia real, y se dice qué es.
        ...(referencia?.url
          ? {
              image: referencia.url,
              creditText: "Imagen de referencia de la localidad (no es una fotografía del establecimiento)",
            }
          : {}),
        author: { "@type": "Organization", name: "Hestiat" },
        publisher: { "@type": "Organization", name: "Hestiat", url: "https://hestiat.com" },
      },
    ],
  };

  return (
    <main className="wrap" style={{ paddingTop: 20 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Migas de pan" className="migas">
        <Link href="/">Hestiat</Link> / <Link href="/guia">Guías</Link> / <span>{g.titulo}</span>
      </nav>
      {referencia?.url ? (
        <figure style={{ margin: "12px 0 0", maxWidth: "70ch" }}>
          <img
            src={referencia.url}
            alt={`Imagen de referencia de ${g.destino}: no es una fotografía del establecimiento`}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }}
          />
          <figcaption style={{ fontSize: 13, color: "var(--muted-fg)", marginTop: 6 }}>
            Imagen de referencia. No es una fotografía del establecimiento.
            {referencia.fuente ? (
              <>
                {" "}Procedencia: <a href={referencia.fuente} rel="noopener">{referencia.fuente}</a>.
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
      <h1>{g.titulo}</h1>
      {g.resumen ? <p style={{ color: "var(--muted-fg)", maxWidth: "70ch" }}>{g.resumen}</p> : null}
      <article style={{ maxWidth: "70ch", lineHeight: 1.65, whiteSpace: "pre-wrap", marginTop: 16 }}>
        {/* Las direcciones van como enlaces; los títulos de sección, como encabezados <h2> reales
            (un solo <h1> en la página, que es el título de la guía). El aspecto no cambia: el
            encabezado hereda el tamaño y el peso del texto. */}
        {partes.flatMap((t, i) => {
          if (t.tipo === "enlace") {
            return [<a key={`e${i}`} href={t.href} rel={t.interno ? undefined : "noopener"}>{t.valor}</a>];
          }
          const lineas = t.valor.split("\n");
          return lineas.flatMap((linea, j) => {
            if (esTituloDeSeccion(linea)) {
              return [
                <h2 key={`h${i}-${j}`} style={{ fontSize: "inherit", fontWeight: "inherit", margin: 0 }}>
                  {linea}
                </h2>,
              ];
            }
            return j < lineas.length - 1
              ? [<span key={`t${i}-${j}`}>{linea}</span>, <span key={`n${i}-${j}`}>{"\n"}</span>]
              : [<span key={`t${i}-${j}`}>{linea}</span>];
          });
        })}
      </article>
      <p className="aviso" style={{ marginTop: 20, fontSize: 13 }}>
        Guía revisada por {g.revisor ?? "el equipo de Hestiat"} y publicada el{" "}
        {String(g.publicado_en ?? "").slice(0, 10)}. En este texto, los datos comprobados se distinguen de
        las recomendaciones. Si algo no cuadra, <Link href="/contacto">cuéntanoslo</Link>.
        {g.destino ? (
          <>
            {" "}Ver el catálogo real de <Link href={`/destino/${String(g.destino).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>{g.destino}</Link>.
          </>
        ) : null}
      </p>
    </main>
  );
}
