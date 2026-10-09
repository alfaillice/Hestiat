import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";

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
        datePublished: g.publicado_en ?? undefined,
        dateModified: g.revisado_en ?? g.publicado_en ?? undefined,
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
      <h1>{g.titulo}</h1>
      {g.resumen ? <p style={{ color: "var(--muted-fg)", maxWidth: "70ch" }}>{g.resumen}</p> : null}
      <article style={{ maxWidth: "70ch", lineHeight: 1.65, whiteSpace: "pre-wrap", marginTop: 16 }}>
        {g.cuerpo}
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
