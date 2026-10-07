import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { datosDeFicha } from "@/lib/ficha.server";
import { getCurrentUser, ownsListing } from "@/lib/auth.server";
import Galeria from "@/components/galeria";
import ReservaCaja from "@/components/reserva-caja";
import MapaFicha from "@/components/mapa-ficha";

export const dynamic = "force-dynamic";

const BASE = "https://hestiat.com";

/** Metadatos por ficha: SEO real, sin contenido duplicado, con canónica. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const datos = await datosDeFicha(decodeURIComponent(slug));
  if (!datos) return { title: "Alojamiento no encontrado — Hestiat" };
  const a = datos.alojamiento;
  const lugar = [a.city, a.province].filter(Boolean).join(", ");
  return {
    title: `${a.title}${lugar ? ` — ${lugar}` : ""} — Hestiat`,
    description:
      a.description?.slice(0, 155) ??
      `${a.title} en ${lugar}. Consulta precios, servicios y disponibilidad en Hestiat.`,
    alternates: { canonical: `/alojamiento/${a.slug}` },
    openGraph: {
      type: "website",
      title: `${a.title}${lugar ? ` — ${lugar}` : ""}`,
      description: a.description?.slice(0, 155) ?? undefined,
      images: datos.fotos[0]?.url ? [datos.fotos[0].url] : [],
    },
  };
}

/**
 * Ficha de alojamiento.
 *
 * Estructura: galería → información → reserva (sticky en escritorio, barra inferior en móvil) →
 * descripción → servicios → distribución → disponibilidad → ubicación y mapa → anfitrión →
 * valoraciones → qué hay cerca → similares.
 *
 * Dos reglas que se aplican en TODO lo que se ve:
 *  · **Nada inventado.** La auditoría dice que solo 732 alojamientos tienen capacidad, 3 tienen
 *    baños, 4 tienen precio real y ninguno tiene reseñas. Cada dato ausente se **oculta**, nunca se
 *    rellena con un guion repetido.
 *  · **Las fotos se cualifican.** 17.616 de 17.619 vienen de Wikimedia: se muestran etiquetadas como
 *    referencia, no como fotografía propia de la propiedad.
 */
export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const datos = await datosDeFicha(decodeURIComponent(slug));
  if (!datos) notFound();

  const { alojamiento: a, fotos, servicios, nochesBloqueadas, anfitrion, similares, resenas } = datos;

  /*
   * Solo se muestra lo publicado. Los estados «borrador», «oculto» o «bloqueado» no se enseñan al
   * público —eso es exactamente lo que significan—, pero el anfitrión o un administrador pueden
   * verlos con «Vista previa», que es la misma página con los mismos datos, sin copias ni maquetas.
   */
  const publicado = String(a.status ?? "") === "published";
  let esPrevia = false;
  if (!publicado) {
    const vista = String(Array.isArray(sp.vista) ? sp.vista[0] : (sp.vista ?? ""));
    const sesion = await getCurrentUser();
    const legacyId = a.legacy_id ? Number(a.legacy_id) : 0;
    const puedeVerlo =
      vista === "previa" &&
      Boolean(sesion) &&
      (sesion!.rol === "admin" || (legacyId > 0 && (await ownsListing(Number(sesion!.id), legacyId))));
    if (!puedeVerlo) notFound();
    esPrevia = true;
  }

  const lugar = [a.city, a.province, a.country && a.country !== "ES" ? a.country : null].filter(Boolean).join(", ");
  const precio = Number(a.price_per_night) > 0 ? Number(a.price_per_night) : null;
  const orientativo = precio === null && Number(a.indicative_price) > 0 ? Number(a.indicative_price) : null;
  const precioMostrado = precio ?? orientativo;
  const esOrientativo = precio === null && orientativo !== null;
  const capacidad = Number(a.capacity) || 0;
  const media = Number(a.review_count) > 0 ? Number(a.review_score) : null;

  /*
   * Reglas del alojamiento: solo se muestra lo que está definido. Si el anfitrión no ha dicho si se
   * admiten mascotas, no se afirma nada — ni un «no» por defecto ni una suposición.
   */
  const tri = (v: unknown, si: string, no: string) => (v === null || v === undefined ? null : Number(v) === 1 ? si : no);
  const reglas = [
    a.check_in_time ? { etiqueta: "Entrada", valor: `a partir de las ${String(a.check_in_time)}` } : null,
    a.check_out_time ? { etiqueta: "Salida", valor: `antes de las ${String(a.check_out_time)}` } : null,
    Number(a.min_nights) > 0 ? { etiqueta: "Estancia mínima", valor: `${Number(a.min_nights)} ${Number(a.min_nights) === 1 ? "noche" : "noches"}` } : null,
    Number(a.max_nights) > 0 ? { etiqueta: "Estancia máxima", valor: `${Number(a.max_nights)} ${Number(a.max_nights) === 1 ? "noche" : "noches"}` } : null,
    Number(a.min_age) > 0 ? { etiqueta: "Edad mínima", valor: `${Number(a.min_age)} años` } : null,
    a.pets_allowed !== null && a.pets_allowed !== undefined ? { etiqueta: "Mascotas", valor: Number(a.pets_allowed) === 1 ? "se admiten" : "no se admiten" } : null,
    a.smoking_allowed !== null && a.smoking_allowed !== undefined ? { etiqueta: "Fumar", valor: Number(a.smoking_allowed) === 1 ? "permitido" : "no permitido" } : null,
    a.parties_allowed !== null && a.parties_allowed !== undefined ? { etiqueta: "Fiestas y eventos", valor: Number(a.parties_allowed) === 1 ? "permitidos" : "no permitidos" } : null,
  ].filter(Boolean) as { etiqueta: string; valor: string }[];
  const reglasExtra = a.extra_rules ? String(a.extra_rules) : null;
  void tri;

  // Disponibilidad real de los próximos 60 días, en una rejilla legible con números de día. Antes
  // era una fila de 60 barras anónimas: mucho ruido y ninguna información utilizable.
  const ocupadas = new Set(nochesBloqueadas.map((n) => n.fecha));
  const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
  const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const mesDisponibilidad = (anio: number, mes: number) => {
    const primero = new Date(Date.UTC(anio, mes, 1));
    const huecos: (number | null)[] = Array((primero.getUTCDay() + 6) % 7).fill(null);
    const total = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    for (let d = 1; d <= total; d += 1) huecos.push(d);
    return {
      titulo: `${NOMBRES_MES[mes]} ${anio}`,
      huecos: huecos.map((d) =>
        d === null
          ? null
          : { dia: d, fecha: new Date(Date.UTC(anio, mes, d)).toISOString().slice(0, 10) },
      ),
    };
  };

  const hoyD = new Date();
  const mesesDisponibilidad = [
    mesDisponibilidad(hoyD.getUTCFullYear(), hoyD.getUTCMonth()),
    mesDisponibilidad(...(() => {
      const n = new Date(Date.UTC(hoyD.getUTCFullYear(), hoyD.getUTCMonth() + 1, 1));
      return [n.getUTCFullYear(), n.getUTCMonth()] as [number, number];
    })()),
  ];

  let libres = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (!ocupadas.has(d.toISOString().slice(0, 10))) libres += 1;
  }

  // Datos estructurados schema.org para alojamiento turístico (texto en el HTML: sin coste en el
  // navegador). Solo campos reales.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: a.title,
    url: `${BASE}/alojamiento/${a.slug}`,
    ...(a.description ? { description: String(a.description).slice(0, 500) } : {}),
    ...(fotos.length > 0 ? { image: fotos.slice(0, 6).map((f) => f.url) } : {}),
    address: {
      "@type": "PostalAddress",
      ...(a.address ? { streetAddress: String(a.address) } : {}),
      ...(a.city ? { addressLocality: String(a.city) } : {}),
      ...(a.province ? { addressRegion: String(a.province) } : {}),
      ...(a.postal_code ? { postalCode: String(a.postal_code) } : {}),
      addressCountry: a.country ?? "ES",
    },
    ...(a.lat && a.lng ? { geo: { "@type": "GeoCoordinates", latitude: Number(a.lat), longitude: Number(a.lng) } } : {}),
    ...(precioMostrado ? { priceRange: `${esOrientativo ? "desde " : ""}${precioMostrado} ${a.currency ?? "EUR"}` } : {}),
    ...(capacidad ? { occupancy: { "@type": "QuantitativeValue", maxValue: capacidad } } : {}),
    ...(Number(a.bedrooms) ? { numberOfRooms: Number(a.bedrooms) } : {}),
    ...(media ? { aggregateRating: { "@type": "AggregateRating", ratingValue: media, reviewCount: Number(a.review_count), bestRating: 5 } } : {}),
    ...(servicios.length > 0
      ? { amenityFeature: servicios.slice(0, 20).map((s) => ({ "@type": "LocationFeatureSpecification", name: s, value: true })) }
      : {}),
  };

  const caracteristicas = [
    capacidad ? { n: capacidad, t: capacidad === 1 ? "huésped" : "huéspedes" } : null,
    Number(a.bedrooms) ? { n: Number(a.bedrooms), t: Number(a.bedrooms) === 1 ? "dormitorio" : "dormitorios" } : null,
    Number(a.beds) ? { n: Number(a.beds), t: Number(a.beds) === 1 ? "cama" : "camas" } : null,
    Number(a.baths) ? { n: Number(a.baths), t: Number(a.baths) === 1 ? "baño" : "baños" } : null,
  ].filter(Boolean) as { n: number; t: string }[];

  return (
    <main className="wrap ficha">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {esPrevia && (
        <p className="aviso" style={{ margin: "14px 0 0", borderColor: "var(--accent)", background: "var(--primary-soft)" }}>
          <strong>Vista previa.</strong> Este alojamiento no está publicado, así que solo lo ves tú. Es
          la misma página que verá el huésped, con los datos reales que hay guardados.
        </p>
      )}

      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link> <span>/</span> <Link href="/search">Alojamientos</Link>
        {a.province ? <> <span>/</span> <Link href={`/search?provincia=${encodeURIComponent(a.province)}`}>{a.province}</Link></> : null}
      </nav>

      <Galeria fotos={fotos} titulo={a.title} todasReferenciales={datos.todasReferenciales} />

      <div className="ficha-cols">
        <div className="ficha-principal">
          <header>
            <h1>{a.title}</h1>
            <p className="meta">
              {lugar || "Ubicación no indicada"}
              {media !== null ? ` · ${media.toFixed(1).replace(".", ",")} sobre 5 (${a.review_count} ${Number(a.review_count) === 1 ? "reseña" : "reseñas"})` : ""}
            </p>
            {(a.type || a.category || Number(a.stars) > 0) && (
              <p className="meta">
                {[a.type, a.category, Number(a.stars) > 0 ? `${Number(a.stars)} estrellas` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </header>

          {caracteristicas.length > 0 && (
            <ul className="ficha-hechos">
              {caracteristicas.map((c) => (
                <li key={c.t}>
                  <strong>{c.n}</strong> {c.t}
                </li>
              ))}
            </ul>
          )}

          {a.description && (
            <section className="ficha-seccion">
              <h2>Sobre este alojamiento</h2>
              {/* `<details>` da el «mostrar más» sin JavaScript y sin estado que perder. */}
              <details open={String(a.description).length <= 420}>
                <summary className="ficha-resumen">Leer descripción</summary>
                <p className="ficha-texto" style={{ whiteSpace: "pre-line" }}>{String(a.description).slice(0, 4000)}</p>
              </details>
            </section>
          )}

          {servicios.length > 0 && (
            <section className="ficha-seccion">
              <h2>Lo que ofrece este alojamiento</h2>
              <ul className="servicios-grid">
                {servicios.slice(0, 12).map((s) => <li key={s}>{s}</li>)}
              </ul>
              {servicios.length > 12 && (
                <details>
                  <summary className="ficha-resumen">Ver los {servicios.length} servicios</summary>
                  <ul className="servicios-grid" style={{ marginTop: 10 }}>
                    {servicios.map((s) => <li key={`t-${s}`}>{s}</li>)}
                  </ul>
                </details>
              )}
            </section>
          )}

          {(Number(a.bedrooms) > 0 || Number(a.beds) > 0) && (
            <section className="ficha-seccion">
              <h2>Dónde vas a dormir</h2>
              <p className="ficha-texto">
                {Number(a.bedrooms) > 0 ? `${Number(a.bedrooms)} ${Number(a.bedrooms) === 1 ? "dormitorio" : "dormitorios"}` : ""}
                {Number(a.bedrooms) > 0 && Number(a.beds) > 0 ? " · " : ""}
                {Number(a.beds) > 0 ? `${Number(a.beds)} ${Number(a.beds) === 1 ? "cama" : "camas"}` : ""}
              </p>
              <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                El reparto concreto de camas lo confirma el anfitrión al responder tu solicitud.
              </p>
            </section>
          )}

          <section className="ficha-seccion">
            <h2>Disponibilidad</h2>
            <p className="ficha-texto">
              {libres} de los próximos 60 días están libres. Los días marcados ya están ocupados por una
              reserva o bloqueados por el anfitrión.
            </p>
            <div className="dispo-cols" aria-label="Disponibilidad de este y el próximo mes">
              {mesesDisponibilidad.map((m) => (
                <div key={m.titulo}>
                  <p className="mes-titulo">{m.titulo}</p>
                  <div className="mes-grid">
                    {DIAS_SEMANA.map((d) => <span key={d} className="mes-dia-semana">{d}</span>)}
                    {m.huecos.map((h, i) =>
                      h === null ? (
                        <span key={`h${i}`} />
                      ) : (
                        <span
                          key={h.fecha}
                          className={ocupadas.has(h.fecha) ? "dia-ocupado-num" : "dia-libre-num"}
                          title={`${h.fecha}${ocupadas.has(h.fecha) ? " · no disponible" : " · libre"}`}
                        >
                          {h.dia}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="leyenda">
              <span><i className="dia-libre-num" style={{ padding: 0 }} aria-hidden="true" /> Libre</span>
              <span><i className="dia-ocupado-num" style={{ padding: 0 }} aria-hidden="true" /> Ocupado o bloqueado</span>
            </p>
            <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12 }}>
              Calendario calculado con las reservas y los bloqueos reales de este alojamiento.
            </p>
          </section>

          <section className="ficha-seccion" id="mapa">
            <h2>¿Dónde te vas a alojar?</h2>
            <p className="ficha-texto">{[a.city, a.province, a.country ?? "España"].filter(Boolean).join(", ")}</p>
            {a.lat && a.lng ? (
              <MapaFicha
                lat={Number(a.lat)}
                lng={Number(a.lng)}
                titulo={a.title}
                lugar={lugar}
                aproximada={String(a.location_visibility ?? "exacta") === "aproximada"}
              />
            ) : (
              <p className="aviso">Este alojamiento no tiene coordenadas, así que no se puede situar en el mapa.</p>
            )}
            {String(a.location_visibility ?? "exacta") === "aproximada" && (
              <p className="m" style={{ fontSize: 13, color: "var(--muted-fg)", marginTop: 8 }}>
                La ubicación es aproximada: se muestra la zona, no la dirección exacta. La dirección
                completa se facilita al confirmar la reserva.
              </p>
            )}
          </section>

          {anfitrion && (
            <section className="ficha-seccion">
              <h2>Conoce a tu anfitrión</h2>
              <div className="anfitrion">
                {anfitrion.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={anfitrion.avatar} alt={anfitrion.nombre} className="anfitrion-foto" />
                ) : (
                  <span className="anfitrion-inicial" aria-hidden="true">{anfitrion.nombre.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <p className="anfitrion-nombre">{anfitrion.nombre}</p>
                  <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                    {anfitrion.desde ? `Anfitrión desde ${anfitrion.desde.slice(0, 4)}` : "Anfitrión"}
                    {anfitrion.alojamientos > 0 ? ` · ${anfitrion.alojamientos} ${anfitrion.alojamientos === 1 ? "alojamiento" : "alojamientos"}` : ""}
                  </p>
                  {anfitrion.bio && <p className="ficha-texto" style={{ marginTop: 6 }}>{anfitrion.bio}</p>}
                  <p style={{ marginTop: 8 }}>
                    <Link className="f-limpiar" href={`/anfitrion/${anfitrion.id}`}>Ver perfil</Link>
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="ficha-seccion">
            <h2>Valoraciones</h2>
            {resenas.length === 0 ? (
              <p className="ficha-texto">Aún no hay valoraciones de este alojamiento.</p>
            ) : (
              <>
                {media !== null && (
                  <p className="ficha-texto"><strong>{media.toFixed(1).replace(".", ",")}</strong> sobre 5 · {a.review_count} {Number(a.review_count) === 1 ? "reseña" : "reseñas"}</p>
                )}
                <ul className="resenas">
                  {resenas.map((r) => (
                    <li key={r.id}>
                      <p className="resena-cab">
                        <strong>{r.autor}</strong>
                        {r.puntuacion !== null ? ` · ${r.puntuacion} sobre 5` : ""}
                        {r.fecha ? ` · ${r.fecha}` : ""}
                      </p>
                      {r.comentario && <p className="ficha-texto">{r.comentario}</p>}
                      {r.respuesta && <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>Respuesta del anfitrión: {r.respuesta}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {(reglas.length > 0 || reglasExtra) && (
            <section className="ficha-seccion">
              <h2>Información importante</h2>
              {reglas.length > 0 && (
                <ul className="reglas-lista">
                  {reglas.map((r) => (
                    <li key={r.etiqueta}>
                      <span>{r.etiqueta}</span>
                      <strong>{r.valor}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {reglasExtra && <p className="ficha-texto" style={{ marginTop: 10 }}>{reglasExtra}</p>}
            </section>
          )}

          {(datos.experiencias.length > 0 || datos.serviciosTuristicos.length > 0) && (
            <section className="ficha-seccion">
              <h2>Qué hacer cerca</h2>
              {datos.experiencias.length > 0 && (
                <ul className="chips">
                  {datos.experiencias.map((x) => (
                    <li className="chip" key={`e-${x.id}`}>
                      {x.web ? <a href={x.web} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>{x.nombre.slice(0, 48)}</a> : x.nombre.slice(0, 48)}
                      {x.categoria ? ` · ${x.categoria}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {datos.serviciosTuristicos.length > 0 && (
                <ul className="chips" style={{ marginTop: 10 }}>
                  {datos.serviciosTuristicos.map((x) => (
                    <li className="chip" key={`s-${x.id}`}>{x.nombre.slice(0, 48)}{x.categoria ? ` · ${x.categoria}` : ""}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <ReservaCaja
          slug={String(a.slug)}
          precioNoche={precioMostrado}
          moneda={String(a.currency ?? "EUR")}
          orientativo={esOrientativo}
          capacidad={capacidad}
          nochesBloqueadas={nochesBloqueadas.map((n) => n.fecha)}
          tieneFechas
        />
      </div>

      {similares.length > 0 && (
        <section className="ficha-seccion" style={{ marginTop: 34 }}>
          <h2>También te puede interesar</h2>
          <div className="grid3">
            {similares.map((s) => (
              <Link key={s.id} href={`/alojamiento/${s.slug}`} className="tarjeta tarjeta-enlace">
                {s.portada ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.portada} alt={s.titulo} loading="lazy" className="tarjeta-foto" />
                    {/* Muchas fotos del catálogo vienen de fuera y son de OTRO sitio: la del Parador
                        de Gredos aparecía como si fuera «La City Hotel». Se marca. */}
                    {s.externa && <span className="img-ref">Referencia</span>}
                  </>
                ) : (
                  <span className="tarjeta-sinfoto" aria-hidden="true" />
                )}
                <p className="tarjeta-titulo">{s.titulo.slice(0, 46)}</p>
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>{[s.ciudad, s.provincia].filter(Boolean).join(", ") || "—"}</p>
                <p className="m" style={{ fontSize: 13 }}>
                  {s.precio ? `${s.orientativo ? "desde " : ""}${s.precio.toLocaleString("es-ES")} € / noche` : "Precio a consultar"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
