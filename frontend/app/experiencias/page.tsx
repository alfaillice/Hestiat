import Link from "next/link";
import type { Metadata } from "next";
import Carrusel from "@/components/carrusel";
import SeccionHome from "@/components/seccion-home";
import ImagenSegura from "@/components/imagen-segura";
import CercaDeTi from "@/components/cerca-de-ti";
import {
  buscarExperiencias,
  categoriasConDatos,
  destacadasExperiencias,
  provinciasConExperiencias,
  subcategoriasDe,
  type ExpTarjeta,
} from "@/lib/experiencias.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Experiencias — Hestiat",
  description:
    "Qué hacer y qué visitar en toda España: planes reales del catálogo de Hestiat, con su ubicación, su categoría y su precio cuando está publicado.",
  alternates: { canonical: "/experiencias" },
};

const POR_PAGINA = 24;

/** Una tarjeta de experiencia. La MISMA forma en las filas y en la rejilla: una sola pieza. */
function TarjetaExp({ e }: { e: ExpTarjeta }) {
  const lugar = [e.municipio, e.provincia].filter(Boolean).join(", ");
  return (
    <Link className="serv-card" href={e.href}>
      <span className="serv-media">
        <ImagenSegura src={e.imagen} alt={`${e.nombre}: imagen de referencia`} />
      </span>
      <span className="serv-txt">
        <b>{e.nombre}</b>
        {lugar ? <span className="m">{lugar}</span> : null}
        <span className="m">{e.categoria ?? "Sin categoría"}{e.subcategoria ? ` · ${e.subcategoria}` : ""}</span>
        <span className="serv-fuente">
          {e.precio}
          {e.precioOrientativo ? " · orientativo" : ""}
          {e.rating ? ` · ${e.rating.toFixed(1).replace(".", ",")} (${e.ratingCount})` : ""}
        </span>
      </span>
    </Link>
  );
}

/**
 * Catálogo público de EXPERIENCIAS.
 *
 * Todo lo que se ve sale de la base: las 58.539 experiencias activas, clasificadas en las categorías
 * de Hestiat. El buscador y los filtros solo ofrecen lo que existe de verdad: hay filtro de
 * categoría, subcategoría, destino, familia y accesibilidad, y NO hay filtro de precio ni de
 * duración, porque solo 48 experiencias tienen precio y ninguna tiene duración: un filtro que no
 * puede funcionar es una promesa falsa.
 *
 * El precio, cuando existe, se enseña tal cual («Gratis», «Desde 12 €») y se marca si es
 * orientativo; cuando no, dice «Consultar». Nunca se inventa.
 */
export default async function Experiencias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (uno(sp.q) ?? "").trim();
  const categoria = (uno(sp.categoria) ?? "").trim() || undefined;
  const subcategoria = (uno(sp.subcategoria) ?? "").trim() || undefined;
  const provincia = (uno(sp.provincia) ?? "").trim() || undefined;
  const familia = uno(sp.familia) === "1";
  const accesible = uno(sp.accesible) === "1";
  const pagina = Math.max(1, Number(uno(sp.p) ?? 1) || 1);
  const filtrando = Boolean(q || categoria || subcategoria || provincia || familia || accesible);

  const [categorias, provincias, subcats, listado] = await Promise.all([
    categoriasConDatos(),
    provinciasConExperiencias(14),
    categoria ? subcategoriasDe(categoria) : Promise.resolve([]),
    buscarExperiencias({ q, categoria, subcategoria, provincia, familia, accesible, pagina, porPagina: POR_PAGINA }),
  ]);
  const destacadas = filtrando ? [] : await destacadasExperiencias(13);

  const enlaces = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const base = { q: q || undefined, categoria, subcategoria, provincia, familia: familia ? "1" : undefined, accesible: accesible ? "1" : undefined, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    const s = u.toString();
    return `/experiencias${s ? `?${s}` : ""}`;
  };
  const categoriasConDatosYFiltro = categorias;
  const catActual = categorias.find((c) => c.slug === categoria);
  const paginas = Math.max(1, Math.ceil(listado.total / listado.porPagina));

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 6 }}>Experiencias</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 18 }}>
        {listado.total.toLocaleString("es-ES")} planes reales
        {catActual ? ` en «${catActual.nombre}»` : ""}
        {subcategoria ? ` › ${subcategoria}` : ""}
        {provincia ? ` en ${provincia}` : ""}
        {q ? ` que coinciden con «${q}»` : ""}. Con su ubicación y su precio cuando está publicado.
      </p>

      {/* Buscador y filtros: solo lo que tiene datos reales. */}
      <form className="filtros" method="get" action="/experiencias" style={{ marginBottom: 20 }}>
        <label className="f-campo">
          <span className="etq">Buscar</span>
          <input name="q" defaultValue={q} placeholder="Nombre, ciudad o provincia" />
        </label>
        <label className="f-campo">
          <span className="etq">Categoría</span>
          <select name="categoria" defaultValue={categoria ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icono ? `${c.icono} ` : ""}{c.nombre} ({c.total.toLocaleString("es-ES")})
              </option>
            ))}
          </select>
        </label>
        {subcats.length > 0 ? (
          <label className="f-campo">
            <span className="etq">Subcategoría</span>
            <select name="subcategoria" defaultValue={subcategoria ?? ""}>
              <option value="">Todas</option>
              {subcats.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.nombre} ({s.total.toLocaleString("es-ES")})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="f-campo">
          <span className="etq">Destino</span>
          <select name="provincia" defaultValue={provincia ?? ""}>
            <option value="">Toda España</option>
            {provincias.map((p) => (
              <option key={p.provincia} value={p.provincia}>
                {p.provincia} ({p.total.toLocaleString("es-ES")})
              </option>
            ))}
          </select>
        </label>
        <fieldset className="f-servicios">
          <legend className="etq">Solo mostrar</legend>
          <div className="f-chips">
            <label className="f-chip">
              <input type="checkbox" name="familia" value="1" defaultChecked={familia} />
              <span>Para familias</span>
            </label>
            <label className="f-chip">
              <input type="checkbox" name="accesible" value="1" defaultChecked={accesible} />
              <span>Accesible</span>
            </label>
          </div>
        </fieldset>
        <div className="f-acciones">
          <button type="submit" className="f-aplicar">Buscar</button>
          <Link className="f-limpiar" href="/experiencias">Quitar filtros</Link>
        </div>
      </form>

      {/* Categorías reales (solo las que tienen experiencias). */}
      <SeccionHome titulo="Explora por categoría" sub="Las categorías de Hestiat, con sus experiencias reales" verTodos="/experiencias" verTodosTexto="Ver todo">
        {categoriasConDatosYFiltro.map((c) => (
          <Link className="tcat" key={c.slug} href={`/experiencias?categoria=${encodeURIComponent(c.slug)}`}>
            <span className="tcat-media" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, background: "var(--fucsia-soft)" }}>
              <span aria-hidden="true">{c.icono ?? "🎫"}</span>
            </span>
            <span className="tcat-txt">
              <b>{c.nombre}</b>
              <span>{c.total.toLocaleString("es-ES")} experiencias</span>
            </span>
          </Link>
        ))}
      </SeccionHome>

      {destacadas.length > 0 ? (
        <SeccionHome titulo="Experiencias destacadas" sub="Las mejor valoradas del catálogo, con valoración real" verTodos="/experiencias">
          {destacadas.map((e) => (
            <TarjetaExp key={e.id} e={e} />
          ))}
        </SeccionHome>
      ) : null}

      <section className="seccion-home">
        <div className="seccion-home-cab">
          <div>
            <h2>Por destino</h2>
            <p className="seccion-home-sub">Provincias con más experiencias, con su recuento real</p>
          </div>
          <Link className="ver-todos" href="/experiencias">Ver todos <span aria-hidden="true">→</span></Link>
        </div>
        <div className="f-chips">
          {provincias.map((p) => (
            <Link className="f-chip" key={p.provincia} href={`/experiencias?provincia=${encodeURIComponent(p.provincia)}`}>
              <span>{p.provincia} <em>({p.total.toLocaleString("es-ES")})</em></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Cerca de ti: usa la ubicación si está autorizada y, si no, lo dice con otro nombre. */}
      <CercaDeTi soloExperiencias />

      <section className="seccion-home">
        <div className="seccion-home-cab">
          <div>
            <h2>{filtrando ? "Resultados" : "Todas las experiencias"}</h2>
            <p className="seccion-home-sub">
              {filtrando
                ? `${listado.total.toLocaleString("es-ES")} coinciden con lo que has elegido`
                : "Recorriendo el catálogo completo, por orden de identificador"}
            </p>
          </div>
        </div>
        {listado.items.length === 0 ? (
          <p className="aviso">
            No hay experiencias con esos criterios. Prueba con otra categoría, otro destino o menos palabras.
          </p>
        ) : (
          <>
            <div className="serv-grid">
              {listado.items.map((e) => (
                <TarjetaExp key={e.id} e={e} />
              ))}
            </div>
            {pagina < paginas ? (
              <p style={{ marginTop: 22, textAlign: "center" }}>
                <Link className="f-aplicar" href={enlaces({ p: String(pagina + 1) })}>
                  Cargar más experiencias
                </Link>
                <span className="m" style={{ display: "block", marginTop: 8, color: "var(--muted-fg)", fontSize: 13 }}>
                  Página {pagina.toLocaleString("es-ES")} de {paginas.toLocaleString("es-ES")}
                </span>
              </p>
            ) : null}
          </>
        )}
      </section>

      <p className="aviso" style={{ marginTop: 26 }}>
        Las {listado.total.toLocaleString("es-ES")} experiencias proceden de fuentes públicas (OpenStreetMap
        y otras) y figuran con su autoría. Las fotografías son imágenes de referencia de esas mismas
        fuentes, no fotos propias de cada actividad. Solo 48 experiencias del catálogo tienen precio
        publicado; el resto dice «Consultar» a propósito: no se inventa ninguno.
      </p>
    </main>
  );
}
