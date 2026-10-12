import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import { ciudadesDestacadas, datosCiudad, imagenDeReferencia, localidadPorSlug, slugCiudad } from "@/lib/seo.server";
import EspacioPublicidad from "@/components/espacio-publicidad";

export const dynamic = "force-dynamic";

/**
 * PÁGINA LOCAL DE CIUDAD — /destino/<ciudad>
 *
 * Es la pieza del SEO local: una página por ciudad con contenido REAL (los alojamientos, experiencias
 * y servicios que de verdad están en el catálogo), enlaces internos a los otros módulos y datos
 * estructurados que describen lo que hay en la página.
 *
 * DOS REGLAS QUE NO SE ROMPEN
 *   1. Si la ciudad no reúne contenido suficiente, la página se marca `noindex,follow`: no se pide que
 *      se indexe una página vacía. Se sigue pudiendo visitar y no se rompe ningún enlace.
 *   2. No se inventa nada: ni servicios, ni valoraciones, ni precios, ni descripciones. Lo que se ve es
 *      lo que hay en la ficha.
 */

/* El slug se resuelve contra la tabla precalculada `localidad_slug`: es una consulta por
   clave primaria, así que la página responde al instante. */
async function alojamientosDeCiudad(ciudad: string, limite = 24) {
  const [filas] = await pool.query<any[]>(
    `SELECT a.id, a.legacy_id, a.slug, a.title, a.city, a.province, a.country,
            a.price_per_night, a.indicative_price, a.price_type,
            a.capacity, a.bedrooms, a.beds, a.review_score, a.review_count,
            COALESCE(
              (SELECT COALESCE(p.origin_url, p.storage_key) FROM accommodation_photo p
                WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
                ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1),
              li.url, lp.url, lg.url) AS portada,
            ((SELECT COUNT(*) FROM accommodation_photo p WHERE p.accommodation_id = a.id) = 0) AS portada_referencial
       FROM accommodation a
       LEFT JOIN localidad_imagen li ON li.tipo='ciudad' AND li.clave = LOWER(a.city)
       LEFT JOIN localidad_imagen lp ON lp.tipo='provincia' AND lp.clave = LOWER(a.province)
       LEFT JOIN localidad_imagen lg ON lg.tipo='pais' AND lg.clave = 'espana'
      WHERE a.status='published' AND a.city = ? COLLATE utf8mb4_general_ci
      ORDER BY (a.review_count IS NULL), a.review_count DESC, a.id ASC LIMIT ?`,
    [ciudad, limite],
  );
  return filas as unknown as Record<string, unknown>[];
}

/* La guía de viaje de esta ciudad, y SOLO si está publicada: un borrador no se enlaza nunca. */
async function guiaDeCiudad(ciudad: string): Promise<string | null> {
  try {
    const [f] = await pool.query<any[]>(
      `SELECT slug FROM guia WHERE estado = 'publicada' AND BINARY destino = BINARY ? LIMIT 1`,
      [ciudad],
    );
    return f[0]?.slug ? String(f[0].slug) : null;
  } catch {
    return null; // si la tabla todavía no existe, la página funciona igual
  }
}

export async function generateMetadata({ params }: { params: Promise<{ ciudad: string }> }): Promise<Metadata> {
  const { ciudad: slug } = await params;
  const loc = await localidadPorSlug(slug);
  if (!loc) notFound();
  const d = await datosCiudad(slug);
  if (!d) notFound();
  const ciudad = d.ciudad;
  const total = d.alojamientos + d.experiencias + d.servicios;
  const partes = [
    d.alojamientos > 0 ? `${d.alojamientos} alojamientos` : "",
    d.experiencias > 0 ? `${d.experiencias} experiencias` : "",
    d.servicios > 0 ? `${d.servicios} servicios` : "",
  ].filter(Boolean);
  return {
    title: `${ciudad}: alojamientos, experiencias y servicios — Hestiat`,
    description:
      total > 0
        ? `Qué hay en ${ciudad} según el catálogo de Hestiat: ${partes.join(", ")}. Publicar en Hestiat es gratis, sin cuotas ni comisiones.`
        : `${ciudad} en Hestiat: todavía no hay fichas suficientes del catálogo en esta localidad.`,
    alternates: { canonical: `/destino/${slugCiudad(ciudad)}` },
    // Si no reúne contenido suficiente, no se pide la indexación.
    robots: d.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${ciudad} — Hestiat`,
      type: "website",
      // La imagen de referencia de la propia localidad: la página nunca se comparte sin imagen.
      images: (await imagenDeReferencia(ciudad, null))?.url ? [(await imagenDeReferencia(ciudad, null))!.url] : [],
    },
  };
}

export default async function PaginaCiudad({ params }: { params: Promise<{ ciudad: string }> }) {
  const { ciudad: slug } = await params;
  // Primero la localidad (consulta por clave primaria), y solo después las fichas de esa ciudad.
  const d = await datosCiudad(slug);
  if (!d) notFound();
  const ciudad = d.ciudad;
  const [tarjetas, cercanas] = await Promise.all([
    alojamientosDeCiudad(ciudad),
    ciudadesDestacadas(12),
  ]);
  const total = d.alojamientos + d.experiencias + d.servicios;
  const tarjetasMapeadas = tarjetas.map(aTarjeta);
  const guia = await guiaDeCiudad(ciudad);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Hestiat", item: "https://hestiat.com/" },
          { "@type": "ListItem", position: 2, name: "Destinos", item: "https://hestiat.com/destinos" },
          { "@type": "ListItem", position: 3, name: ciudad, item: `https://hestiat.com/destino/${slugCiudad(ciudad)}` },
        ],
      },
      {
        "@type": "ItemList",
        name: `Alojamientos en ${ciudad}`,
        numberOfItems: d.alojamientos,
        itemListElement: tarjetasMapeadas.slice(0, 10).map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.titulo,
          url: `https://hestiat.com/alojamiento/${t.slug ?? ""}`,
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="wrap" style={{ paddingTop: 18 }}>
        <nav aria-label="Migas de pan" className="migas">
          <Link href="/">Hestiat</Link> / <Link href="/destinos">Destinos</Link> / <span>{ciudad}</span>
        </nav>

        <h1>{ciudad}</h1>
        <p style={{ maxWidth: "70ch", color: "var(--muted-fg)" }}>
          {total > 0
            ? `Esto es lo que el catálogo de Hestiat tiene hoy en ${ciudad}: ${d.alojamientos} alojamientos, ${d.experiencias} experiencias y ${d.servicios} servicios. Los datos salen de la fichas reales; lo que no está publicado, no se muestra.`
            : `Todavía no hay fichas suficientes del catálogo en ${ciudad}. Esta página se queda fuera del índice de buscadores hasta que haya contenido útil.`}
        </p>

        <section className="seccion-home" style={{ marginTop: 22 }}>
          <div className="seccion-cab">
            <h2>Alojamientos en {ciudad}</h2>
            {d.alojamientos > tarjetasMapeadas.length ? (
              <Link className="mas" href={`/search?q=${encodeURIComponent(ciudad)}`}>
                Ver los {d.alojamientos}
              </Link>
            ) : null}
          </div>
          {tarjetasMapeadas.length === 0 ? (
            <p style={{ color: "var(--muted-fg)" }}>No hay alojamientos publicados en esta localidad.</p>
          ) : (
            <div className="galeria">
              {tarjetasMapeadas.map((t) => (
                <TarjetaAlojamiento key={String(t.id)} a={t} guardado={false} haySesion={false} volverA={`/destino/${slugCiudad(ciudad)}`} />
              ))}
            </div>
          )}
        </section>

        <section className="seccion-home">
          <div className="seccion-cab"><h2>Experiencias y servicios en {ciudad}</h2></div>
          <ul className="ia-lista">
            <li>
              <Link href={`/experiencias?q=${encodeURIComponent(ciudad)}`}>
                Experiencias en {ciudad}
              </Link>{" "}
              — {d.experiencias === 0 ? "todavía sin fichas en el catálogo" : `${d.experiencias} en el catálogo`}
            </li>
            <li>
              <Link href={`/servicios?q=${encodeURIComponent(ciudad)}`}>
                Servicios en {ciudad}
              </Link>{" "}
              — {d.servicios === 0 ? "todavía sin fichas en el catálogo" : `${d.servicios} en el catálogo`}
            </li>
            <li><Link href="/destinos">Ver todos los destinos</Link> · <Link href="/search">Buscar alojamiento</Link></li>
            {guia ? (
              <li>
                <Link href={`/guia/${guia}`}>Guía de viaje de {ciudad}</Link>{" "}
                — qué mirar antes de reservar, con los datos del catálogo
              </li>
            ) : null}
          </ul>
        </section>

        <section className="seccion-home">
          <div className="seccion-cab"><h2>Otros destinos con contenido</h2></div>
          <ul className="ia-lista">
            {cercanas
              .filter((c) => slugCiudad(c.ciudad) !== slugCiudad(ciudad))
              .slice(0, 10)
              .map((c) => (
                <li key={c.slug}>
                  <Link href={`/destino/${c.slug}`}>{c.ciudad}</Link> — {c.total} fichas en el catálogo
                </li>
              ))}
          </ul>
        </section>

        <p className="aviso" style={{ marginTop: 18 }}>
          Publicar en Hestiat es gratis: sin cuota de publicación y sin comisión de Hestiat.
          Si tienes un negocio aquí, puedes <Link href="/hazte-anfitrion">publicarlo gratis</Link> o{" "}
          <Link href="/reclamar">reclamar tu ficha</Link> si ya aparece.
        </p>
        <EspacioPublicidad hueco="destino-final" />
      </main>
    </>
  );
}
