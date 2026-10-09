import Link from "next/link";
import { servicioIndexable } from "@/lib/seo.server";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import SeccionHome from "@/components/seccion-home";
import ImagenSegura from "@/components/imagen-segura";
import { textoDeImagen } from "@/components/tarjeta-catalogo";
import MapaFicha from "@/components/mapa-ficha";
import BotonEditarAdmin from "@/components/boton-editar-admin";
import { servicioPorSlug, serviciosSimilares, serviciosCercanosA, type ServTarjeta } from "@/lib/servicios.server";

export const dynamic = "force-dynamic";

/**
 * Ficha individual de un servicio.
 *
 * Las mismas reglas que en experiencias y alojamientos:
 *  · Ningún campo vacío se muestra. Si no hay horario, no hay sección de horario.
 *  · El precio se enseña como está y se marca si es orientativo; sin precio, «Consultar».
 *  · La fotografía va etiquetada como imagen de referencia con su fuente, nunca como foto propia.
 *  · El mapa solo aparece con coordenadas reales; nunca se dibuja una posición inventada.
 *  · No hay sección de proveedor porque el catálogo no tiene ese dato: no se finge ninguno.
 */
const cargar = cache(async (slug: string) => servicioPorSlug(slug));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await cargar(slug);
  if (!s) notFound();
  const lugar = [s.municipio, s.provincia].filter(Boolean).join(", ");
  const descripcion = (s.resumen ?? "").replace(/\s+/g, " ").slice(0, 155);
  return {
    title: `${s.nombre}${lugar ? ` — ${lugar}` : ""} — Servicios Hestiat`,
    description: descripcion || `${s.nombre} en Hestiat: ubicación, categoría y toda la información disponible.`,
    alternates: { canonical: `/servicios/${s.slug}` },
    robots: (await servicioIndexable(Number(s.id)))
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title: s.nombre,
      description: descripcion,
      url: `/servicios/${s.slug}`,
      images: s.imagen ? [{ url: s.imagen }] : undefined,
      type: "article",
    },
  };
}

function TarjetaServ({ s }: { s: ServTarjeta }) {
  const lugar = [s.municipio, s.provincia].filter(Boolean).join(", ");
  return (
    <Link className="serv-card" href={s.href}>
      <span className="serv-media">
        <ImagenSegura src={s.imagen} alt={`${s.nombre}: ${s.imagenOficial ? "imagen oficial del sitio" : "imagen de referencia"}`} />
      </span>
      <span className="serv-txt">
        <b>{s.nombre}</b>
        {lugar ? <span className="m">{lugar}</span> : null}
        <span className="serv-fuente">{s.precio}</span>
      </span>
    </Link>
  );
}

export default async function FichaServicio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await cargar(slug);
  if (!s) notFound();

  const lugar = [s.municipio, s.provincia].filter(Boolean).join(", ") || "España";
  const [similares, cercanos] = await Promise.all([
    serviciosSimilares({ id: s.id, categoriaSlug: s.categoriaSlug, provincia: s.provincia }, 8),
    serviciosCercanosA({ id: s.id, lat: s.lat, lng: s.lng }, 8),
  ]);

  const datos: [string, string][] = [];
  if (s.direccion) datos.push(["Dirección", s.direccion]);
  if (lugar) datos.push(["Dónde está", lugar]);
  if (s.horario) datos.push(["Horario", s.horario]);
  if (s.telefono) datos.push(["Teléfono", s.telefono]);
  // Cuando el motor de enriquecimiento completó algo, se dice: qué dato y de dónde salió.
  if (s.completadoDesdeWeb) {
    const deDonde = s.procedenciaWeb.map((p) => p.fuente ?? "web oficial").filter(Boolean);
    datos.push(["Datos completados desde", `${s.procedenciaWeb.map((p) => p.campo).join(", ")} · ${[...new Set(deDonde)].join(", ")}`]);
  }
  if (s.email) datos.push(["Correo", s.email]);
  if (s.verificado) datos.push(["Datos verificados", "Sí, comprobados en su fuente"]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: s.nombre,
    description: (s.resumen ?? "").slice(0, 400) || undefined,
    image: s.imagen ?? undefined,
    url: `https://hestiat.com/servicios/${s.slug}`,
    telephone: s.telefono ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: s.direccion ?? undefined, addressLocality: s.municipio ?? undefined, addressRegion: s.provincia ?? undefined, addressCountry: "ES" },
    geo: s.lat !== null && s.lng !== null ? { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } : undefined,
  };

  return (
    <main className="wrap" style={{ paddingBottom: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link>
        <span>/</span>
        <Link href="/servicios">Servicios</Link>
        {s.categoria ? (
          <>
            <span>/</span>
            <span>{s.categoria}</span>
          </>
        ) : null}
      </nav>

      <BotonEditarAdmin tipo="servicio" id={Number(s.id)} />

      <div className="exp-portada">
        <ImagenSegura src={s.imagen} alt={`${s.nombre}: ${textoDeImagen(s.imagenEtiqueta).toLowerCase()}`} fondo="exp-portada-vacia" />
        {s.imagen ? (
          <span className="exp-portada-pie">
            {textoDeImagen(s.imagenEtiqueta)}
            {s.imagenEtiqueta === "wikipedia"
              ? " · de un artículo, no del establecimiento"
              : s.imagenOficialFuente
                ? ` · ${s.imagenOficialFuente}`
                : s.imagenFuente
                  ? ` · ${s.imagenFuente}`
                  : ""}
          </span>
        ) : null}
      </div>

      <div className="exp-cols">
        <div>
          {s.categoria ? (
            <p className="exp-etiquetas">
              <Link href={`/servicios?categoria=${encodeURIComponent(s.categoriaSlug ?? "")}`}>{s.categoria}</Link>
              {s.subcategoria ? <span> · {s.subcategoria}</span> : null}
            </p>
          ) : null}

          <h1 style={{ fontSize: "clamp(24px,3.2vw,36px)", marginBottom: 8 }}>{s.nombre}</h1>
          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 14 }}>{lugar}</p>

          {s.resumen ? <p className="exp-resumen">{s.resumen}</p> : null}

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

          {s.servicios ? (
            <section style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Servicios ofrecidos</h2>
              <p style={{ whiteSpace: "pre-line" }}>{s.servicios.slice(0, 1500)}</p>
            </section>
          ) : null}

          <p style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {s.web ? (
              <a className="f-aplicar" href={s.web} target="_blank" rel="noreferrer noopener">
                Web oficial
              </a>
            ) : null}
            {s.telefono ? (
              <a className="f-aplicar" href={`tel:${s.telefono.replace(/\s+/g, "")}`}>
                Llamar
              </a>
            ) : null}
          </p>

          {s.lat !== null && s.lng !== null ? (
            <section style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 20, marginBottom: 10 }}>¿Dónde está?</h2>
              <MapaFicha lat={s.lat} lng={s.lng} titulo={s.nombre} lugar={lugar} />
            </section>
          ) : null}

          <section style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Información importante</h2>
            <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
              Los datos de esta ficha proceden de fuentes públicas
              {s.fuente ? ` (${s.fuente})` : ""} y figuran con su autoría.
              {s.fuenteUrl ? (
                <>
                  {" "}
                  <a href={s.fuenteUrl} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>
                    Ver la fuente
                  </a>
                  .
                </>
              ) : null}{" "}
              Hestiat no presta este servicio ni cobra por él: si el precio no está publicado, hay que
              consultarlo con el negocio. Esta ficha no permite contratar todavía.
            </p>
          </section>
        </div>

        <aside className="exp-caja" aria-label="Resumen">
          <p className="exp-precio">
            <strong>{s.precio}</strong>
            {s.precioOrientativo ? <span className="m"> · orientativo, confirmar con el negocio</span> : null}
          </p>
          <ul className="editor-datos" style={{ marginTop: 12 }}>
            <li><span>Categoría</span><span>{s.categoria ?? "Sin clasificar"}</span></li>
            {s.subcategoria ? <li><span>Subcategoría</span><span>{s.subcategoria}</span></li> : null}
            <li><span>Dónde</span><span>{lugar}</span></li>
            {s.horario ? <li><span>Horario</span><span>{s.horario}</span></li> : null}
          </ul>
          <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 10 }}>
            La contratación de servicios llegará más adelante. De momento esta ficha es informativa.
          </p>
        </aside>
      </div>

      {similares.length > 0 ? (
        <SeccionHome titulo="Servicios similares" sub={`Otros de ${s.categoria ?? "la misma categoría"}`} verTodos={s.categoriaSlug ? `/servicios?categoria=${encodeURIComponent(s.categoriaSlug)}` : "/servicios"}>
          {similares.map((x) => (
            <TarjetaServ key={x.id} s={x} />
          ))}
        </SeccionHome>
      ) : null}

      {cercanos.length > 0 ? (
        <SeccionHome titulo="Servicios cerca de aquí" sub="Ordenados por distancia real a este" verTodos="/servicios">
          {cercanos.map((x) => (
            <TarjetaServ key={x.id} s={x} />
          ))}
        </SeccionHome>
      ) : null}
    </main>
  );
}
