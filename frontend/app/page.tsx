import Resultados from "@/components/resultados";
import { destacados, destinosDestacados, estilosDeViaje } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Portada de Hestiat 2.0, replicando la estructura que el cliente ya aprobó
 * (foto grande + buscador de tres partes, «Busca como viajas», destinos con foto
 * y contador, y alojamientos populares), pero servida desde el esquema NUEVO con
 * los 27.359 alojamientos migrados.
 */
export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);
  const buscarActivo = q !== "" || pagina > 1;

  const [destacadosLista, provincias, estilos] = await Promise.all([
    destacados(8),
    destinosDestacados(12),
    estilosDeViaje(),
  ]);
  const portada = destacadosLista.find((d) => d.portada)?.portada ?? null;

  return (
    <main>
      {/* ---------------------------------------------------------- hero -- */}
      <section className="hero">
        {portada && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portada} alt="Alojamiento real del catálogo de Hestiat" />
        )}
        <div className="velo" />
        <div className="cont">
          <p className="eyebrow">Alojamientos con carácter</p>
          <h1>Encuentra donde quedarte, sin sorpresas y sin comisiones.</h1>
          <p className="sub">
            Busca por ciudad, provincia, código postal o punto de interés. Comparamos precios
            publicados y comprobamos la disponibilidad de verdad.
          </p>
          <form className="buscador" method="get" action="/search">
            <span className="campo">
              <span className="etq">Destino</span>
              <input name="q" defaultValue={q} placeholder="¿A dónde vas?" aria-label="Destino" />
            </span>
            <span className="sep" />
            <span className="campo" style={{ flex: "0 0 130px" }}>
              <span className="etq">Fechas</span>
              <input placeholder="¿Cuándo?" aria-label="Fechas" />
            </span>
            <span className="sep" />
            <span className="campo" style={{ flex: "0 0 130px" }}>
              <span className="etq">Viajeros</span>
              <input placeholder="2 huéspedes" aria-label="Viajeros" />
            </span>
            <button type="submit">Buscar</button>
          </form>
        </div>
        {portada && <span className="credito">Foto de un alojamiento del catálogo</span>}
      </section>

      {buscarActivo ? (
        <section className="seccion wrap">
          <Resultados q={q} pagina={pagina} basePath="/" />
        </section>
      ) : (
        <>
          {/* ------------------------------------ busca como viajas -- */}
          <section className="seccion wrap">
            <div className="seccion-cab">
              <h2>Busca como viajas</h2>
              <a className="mas" href="/search">
                Explorar todo el catálogo
              </a>
            </div>
            <p className="seccion-sub">Atajos por forma de escapada</p>
            <div className="carrusel">
              {estilos.map((e) => (
                <a className="estilo" key={e.clave} href={`/search?q=${encodeURIComponent(e.etiqueta)}`}>
                  {e.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.portada} alt={e.etiqueta} loading="lazy" />
                  ) : (
                    <div style={{ height: "100%", background: "var(--surface-strong)" }} />
                  )}
                  <span className="velo" />
                  <span className="txt">
                    <b>{e.etiqueta}</b>
                    <span>
                      {e.descripcion} · {e.total.toLocaleString("es-ES")} alojamientos
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* --------------------------------------- destinos para ti -- */}
          <section className="seccion wrap">
            <div className="seccion-cab">
              <h2>Destinos para ti</h2>
              <a className="mas" href="/search">
                Ver todos
              </a>
            </div>
            <p className="seccion-sub">Provincias con alojamientos publicados, por número de plazas</p>
            <div className="destinos">
              {provincias.map((p) => (
                <a className="destino" key={p.province} href={`/search?q=${encodeURIComponent(p.province)}`}>
                  {p.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.portada} alt={p.province} loading="lazy" />
                  ) : (
                    <div style={{ height: 96, background: "var(--surface-strong)" }} />
                  )}
                  <div className="d">
                    <b>{p.province}</b>
                    <span>{p.total.toLocaleString("es-ES")} alojamientos</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* --------------------------------- alojamientos populares -- */}
          <section className="seccion wrap">
            <div className="seccion-cab">
              <h2>Alojamientos populares</h2>
              <a className="mas" href="/search">
                Ver todos
              </a>
            </div>
            <p className="seccion-sub">Del catálogo real de Hestiat, con sus precios publicados</p>
            <div className="rejilla">
              {destacadosLista.map((a) => (
                <a className="aloj" key={a.id} href={`/alojamiento/${a.slug}`}>
                  <span className="foto">
                    {a.portada ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.portada} alt={a.title} loading="lazy" />
                    ) : null}
                    <button className="fav" aria-label="Guardar en favoritos">
                      ♡
                    </button>
                  </span>
                  <span className="d">
                    <span className="t">{a.title}</span>
                    <span className="m">{[a.city, a.province].filter(Boolean).join(", ")}</span>
                    <span className="p">
                      {a.price_per_night
                        ? `${Number(a.price_per_night).toLocaleString("es-ES")} € / noche`
                        : "Consultar"}
                      {a.price_type !== "real" && <span className="ref"> · orientativo</span>}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="seccion wrap">
        <p className="aviso">
          Datos del esquema nuevo ya migrado: <strong>27.359 alojamientos</strong>, 17.619 fotografías y
          12.185 servicios, procedentes de la base original. Los precios se distinguen siempre entre
          publicados y orientativos, con su fuente.
        </p>
      </section>
    </main>
  );
}
