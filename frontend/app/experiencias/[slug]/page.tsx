import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import SeccionHome from "@/components/seccion-home";
import ImagenSegura from "@/components/imagen-segura";
import { textoDeImagen } from "@/components/tarjeta-catalogo";
import MapaFicha from "@/components/mapa-ficha";
import { experienciaPorSlug, experienciasSimilares, experienciasCercanasA, type ExpTarjeta } from "@/lib/experiencias.server";

export const dynamic = "force-dynamic";

/**
 * Ficha individual de una experiencia.
 *
 * Reglas que se respetan en toda la página:
 *  · NO se enseña ningún campo vacío. Si no hay duración, no aparece la duración; si no hay
 *    organizador, no aparece la sección. Nada de guiones ni de «no disponible».
 *  · El precio se enseña como está en la base y, cuando es orientativo, se dice.
 *  · La fotografía es una IMAGEN DE REFERENCIA de una fuente pública, con su autoría al lado: no se
 *    presenta como foto propia de la actividad, porque no lo es.
 *  · El mapa solo aparece con coordenadas reales. Sin coordenadas no se dibuja nada.
 */
const cargar = cache(async (slug: string) => experienciaPorSlug(slug));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await cargar(slug);
  // El 404 se decide aquí: dentro de la página el estado ya se habría enviado.
  if (!e) notFound();
  const lugar = [e.municipio, e.provincia].filter(Boolean).join(", ");
  const descripcion = (e.resumen ?? e.descripcion ?? "").replace(/\s+/g, " ").slice(0, 155);
  return {
    title: `${e.nombre}${lugar ? ` — ${lugar}` : ""} — Experiencias Hestiat`,
    description: descripcion || `${e.nombre} en Hestiat: ubicación, categoría y toda la información disponible.`,
    alternates: { canonical: `/experiencias/${e.slug}` },
    openGraph: {
      title: e.nombre,
      description: descripcion,
      url: `/experiencias/${e.slug}`,
      images: e.imagen ? [{ url: e.imagen }] : undefined,
      type: "article",
    },
  };
}

function TarjetaExp({ e }: { e: ExpTarjeta }) {
  const lugar = [e.municipio, e.provincia].filter(Boolean).join(", ");
  return (
    <Link className="serv-card" href={e.href}>
      <span className="serv-media">
        <ImagenSegura src={e.imagen} alt={`${e.nombre}: ${e.imagenOficial ? "imagen oficial del sitio" : "imagen de referencia"}`} />
      </span>
      <span className="serv-txt">
        <b>{e.nombre}</b>
        {lugar ? <span className="m">{lugar}</span> : null}
        <span className="serv-fuente">{e.precio}</span>
      </span>
    </Link>
  );
}

export default async function FichaExperiencia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await cargar(slug);
  if (!e) notFound();

  const lugar = [e.municipio, e.provincia].filter(Boolean).join(", ") || "España";
  const [similares, cercanas] = await Promise.all([
    experienciasSimilares({ id: e.id, categoria: e.categoria, provincia: e.provincia }, 8),
    experienciasCercanasA({ id: e.id, lat: e.lat, lng: e.lng }, 8),
  ]);

  const datos: [string, string][] = [];
  if (e.direccion) datos.push(["Dirección", e.direccion]);
  if (lugar) datos.push(["Dónde está", lugar]);
  if (e.horario) datos.push(["Horario", e.horario]);
  if (e.duracionMin || e.duracionMax) {
    const d = e.duracionMin && e.duracionMax ? `${e.duracionMin}–${e.duracionMax} minutos` : `${e.duracionMin ?? e.duracionMax} minutos`;
    datos.push(["Duración", d]);
  }
  if (e.edadMin) datos.push(["Edad mínima", `${e.edadMin} años`]);
  if (e.familia) datos.push(["Para familias", "Sí, es una actividad familiar"]);
  if (e.accesible) datos.push(["Accesibilidad", "Accesible"]);
  if (e.parking) datos.push(["Aparcamiento", "Tiene aparcamiento"]);
  if (e.transporte) datos.push(["Transporte público", "Se puede llegar en transporte público"]);
  if (e.telefono) datos.push(["Teléfono", e.telefono]);
  // Cuando el motor de enriquecimiento completó algo, se dice: qué dato y de dónde salió.
  if (e.completadoDesdeWeb) {
    const deDonde = e.procedenciaWeb.map((p) => p.fuente ?? "web oficial").filter(Boolean);
    datos.push(["Datos completados desde", `${e.procedenciaWeb.map((p) => p.campo).join(", ")} · ${[...new Set(deDonde)].join(", ")}`]);
  }
  if (e.servicios) datos.push(["Servicios", e.servicios.slice(0, 300)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: e.nombre,
    description: (e.resumen ?? e.descripcion ?? "").slice(0, 400) || undefined,
    image: e.imagen ?? undefined,
    url: `https://hestiat.com/experiencias/${e.slug}`,
    address: { "@type": "PostalAddress", addressLocality: e.municipio ?? undefined, addressRegion: e.provincia ?? undefined, addressCountry: "ES" },
    geo: e.lat !== null && e.lng !== null ? { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng } : undefined,
  };

  return (
    <main className="wrap" style={{ paddingBottom: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link>
        <span>/</span>
        <Link href="/experiencias">Experiencias</Link>
        {e.categoria ? (
          <>
            <span>/</span>
            <span>{e.categoria}</span>
          </>
        ) : null}
      </nav>

      {/* Imagen de cabecera: de referencia, y se dice. */}
      <div className="exp-portada">
        <ImagenSegura src={e.imagen} alt={`${e.nombre}: ${textoDeImagen(e.imagenEtiqueta).toLowerCase()}`} fondo="exp-portada-vacia" />
        {e.imagen ? (
          <span className="exp-portada-pie">
            {textoDeImagen(e.imagenEtiqueta)}
            {e.imagenEtiqueta === "wikipedia"
              ? " · de un artículo, no del establecimiento"
              : e.imagenOficialFuente
                ? ` · ${e.imagenOficialFuente}`
                : e.imagenFuente
                  ? ` · ${e.imagenFuente}`
                  : ""}
          </span>
        ) : null}
      </div>

      <div className="exp-cols">
        <div>
          {e.categoria ? (
            <p className="exp-etiquetas">
              <Link href={`/experiencias?categoria=${encodeURIComponent(e.categoriaSlug ?? "")}`}>{e.categoria}</Link>
              {e.subcategoria ? <span> · {e.subcategoria}</span> : null}
            </p>
          ) : null}

          <BotonEditarAdmin tipo="experiencia" id={Number(e.id)} />
          <h1 style={{ fontSize: "clamp(24px,3.2vw,36px)", marginBottom: 8 }}>{e.nombre}</h1>
          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 14 }}>{lugar}</p>

          {e.resumen ? <p className="exp-resumen">{e.resumen}</p> : null}

          {e.descripcion && e.descripcion !== e.resumen ? (
            <section style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Sobre esta experiencia</h2>
              <p style={{ whiteSpace: "pre-line" }}>{e.descripcion.slice(0, 4000)}</p>
            </section>
          ) : null}

          {datos.length > 0 ? (
            <section style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20, marginBottom: 10 }}>Información básica</h2>
              <ul className="editor-datos">
                {datos.map(([k, v]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {e.web ? (
            <p style={{ marginTop: 16 }}>
              <a className="f-aplicar" href={e.web} target="_blank" rel="noreferrer noopener">
                Web oficial
              </a>
            </p>
          ) : null}

          {e.lat !== null && e.lng !== null ? (
            <section style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 20, marginBottom: 10 }}>¿Dónde está?</h2>
              <MapaFicha lat={e.lat} lng={e.lng} titulo={e.nombre} lugar={lugar} />
            </section>
          ) : null}

          <section style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Información importante</h2>
            <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
              Los datos de esta ficha proceden de fuentes públicas
              {e.fuente ? ` (${e.fuente})` : ""} y figuran con su autoría.
              {e.fuenteUrl ? (
                <>
                  {" "}
                  <a href={e.fuenteUrl} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>
                    Ver la fuente
                  </a>
                  .
                </>
              ) : null}{" "}
              Hestiat no organiza esta actividad: si el precio no está publicado, hay que consultarlo con
              el organizador. Esta ficha no vende entradas todavía.
            </p>
          </section>
        </div>

        {/* Caja lateral: precio y datos de un vistazo, sin inventar nada. */}
        <aside className="exp-caja" aria-label="Resumen">
          <p className="exp-precio">
            <strong>{e.precio}</strong>
            {e.precioOrientativo ? <span className="m"> · orientativo, confirmar con el organizador</span> : null}
          </p>
          {e.rating ? (
            <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
              ★ {e.rating.toFixed(1).replace(".", ",")} · {e.ratingCount} valoraciones
            </p>
          ) : null}
          <ul className="editor-datos" style={{ marginTop: 12 }}>
            <li><span>Categoría</span><span>{e.categoria ?? "Sin clasificar"}</span></li>
            {e.subcategoria ? <li><span>Subcategoría</span><span>{e.subcategoria}</span></li> : null}
            <li><span>Dónde</span><span>{lugar}</span></li>
            {e.familia ? <li><span>Para familias</span><span>Sí</span></li> : null}
            {e.accesible ? <li><span>Accesible</span><span>Sí</span></li> : null}
          </ul>
          <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 10 }}>
            La reserva de experiencias llegará más adelante. De momento esta ficha es informativa.
          </p>
        </aside>
      </div>

      {similares.length > 0 ? (
        <SeccionHome titulo="Experiencias similares" sub={`Otras de ${e.categoria ?? "la misma categoría"}`} verTodos={`/experiencias?provincia=${encodeURIComponent(e.provincia ?? "")}`}>
          {similares.map((s) => (
            <TarjetaExp key={s.id} e={s} />
          ))}
        </SeccionHome>
      ) : null}

      {cercanas.length > 0 ? (
        <SeccionHome titulo="Experiencias cerca de aquí" sub="Ordenadas por distancia real a esta" verTodos="/experiencias">
          {cercanas.map((s) => (
            <TarjetaExp key={s.id} e={s} />
          ))}
        </SeccionHome>
      ) : null}
    </main>
  );
}
