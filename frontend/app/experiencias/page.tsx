import Link from "next/link";
import type { Metadata } from "next";
import Carrusel from "@/components/carrusel";
import SeccionHome from "@/components/seccion-home";
import CercaDeTi from "@/components/cerca-de-ti";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import ListaCatalogo from "@/components/lista-catalogo";
import TarjetaCatalogo, { aItemCatalogo } from "@/components/tarjeta-catalogo";
import TarjetaCategoria from "@/components/tarjeta-categoria";
import { categoryImageMap } from "@/lib/imagenes-home";
import {
  buscarExperiencias,
  categoriasConDatos,
  destacadasExperiencias,
  provinciasConExperiencias,
  subcategoriasDe,
} from "@/lib/experiencias.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Experiencias — Hestiat",
  description:
    "Qué hacer y qué visitar en toda España: planes reales del catálogo de Hestiat, con su ubicación, su categoría y su precio cuando está publicado.",
  alternates: { canonical: "/experiencias" },
};

const POR_PAGINA = 24;

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
  // Los campos `family_friendly`, `accessible` y `parking` están VACÍOS en las 58.539 experiencias
  // (auditado antes de construir la página), así que NO se ofrecen como filtro: un filtro que no
  // puede devolver nada es una promesa falsa. El día que tengan datos, se activan en una línea.
  const familia = false;
  const accesible = false;
  // Cursor: si se llega con ?desde= (enlace sin JavaScript) la lista empieza por esa ficha.
  const desde = Math.max(0, Number(uno(sp.desde) ?? 0) || 0) || undefined;
  const filtrando = Boolean(q || categoria || subcategoria || provincia || familia || accesible);

  const [categorias, provincias, subcats, listado] = await Promise.all([
    categoriasConDatos(),
    provinciasConExperiencias(14),
    categoria ? subcategoriasDe(categoria) : Promise.resolve([]),
    buscarExperiencias({ q, categoria, subcategoria, provincia, familia, accesible, desde, porPagina: POR_PAGINA }),
  ]);
  const destacadas = filtrando ? [] : await destacadasExperiencias(13);

  /*
   * FAVORITOS. La sesión y qué elementos de esta pantalla están guardados, con el mismo ayudante y el
   * mismo corazón que usan los alojamientos. El tipo forma parte de la identificación.
   */
  const sesionLista = await getCurrentUser();
  const destacadosIds = destacadas.map((x) => Number(x.id));
  const idsPantalla = [...destacadosIds, ...listado.items.map((i) => Number(i.id))];
  const guardadosPantalla = sesionLista
    ? [...(await guardadosEntre(Number(sesionLista.id), "experiencia", idsPantalla))]
    : [];

  /* Los filtros actuales, sin el cursor: es la consulta que viaja en cada tanda del scroll infinito. */
  const consulta = (() => {
    const u = new URLSearchParams();
    const base = { q: q || undefined, categoria, subcategoria, provincia, familia: familia ? "1" : undefined, accesible: accesible ? "1" : undefined };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    return u.toString();
  })();
  const categoriasConDatosYFiltro = categorias;
  const catActual = categorias.find((c) => c.slug === categoria);
  const ultima = listado.items.length > 0 ? listado.items[listado.items.length - 1].id : null;

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
        <div className="f-acciones">
          <button type="submit" className="f-aplicar">Buscar</button>
          <Link className="f-limpiar" href="/experiencias">Quitar filtros</Link>
        </div>
      </form>

      {/* Categorías reales (solo las que tienen experiencias). */}
      <SeccionHome titulo="Explora por categoría" sub="Las categorías de Hestiat, con sus experiencias reales" verTodos="/experiencias" verTodosTexto="Ver todo">
        {/* Se usa el componente de tarjeta de categoría que ya existe: pinta la imagen real de la
            categoría, con su cadena de respaldo, y nunca deja un hueco roto. Antes se dibujaba aquí
            una tarjeta propia que mostraba un emoji en lugar de la imagen. */}
        {categoriasConDatosYFiltro.map((c) => (
          <TarjetaCategoria
            key={c.slug}
            pie="experiencias"
            categoria={{
              valor: c.slug,
              nombre: c.nombre,
              total: c.total,
              imagenes: categoryImageMap("experiencia", c.slug),
              href: `/experiencias?categoria=${encodeURIComponent(c.slug)}`,
            }}
          />
        ))}
      </SeccionHome>

      {destacadas.length > 0 ? (
        <SeccionHome titulo="Experiencias destacadas" sub="Las mejor valoradas del catálogo, con valoración real" verTodos="/experiencias">
          {destacadas.map((e) => (
            <TarjetaCatalogo
              key={e.id}
              item={aItemCatalogo(e)}
              tipo="experiencia"
              guardado={guardadosPantalla.includes(Number(e.id))}
              haySesion={Boolean(sesionLista)}
              volverA="/experiencias"
            />
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
          <ListaCatalogo
            key={consulta}
            iniciales={listado.items.map(aItemCatalogo)}
            haySesion={Boolean(sesionLista)}
            guardadosIniciales={guardadosPantalla}
            total={listado.total}
            consulta={consulta}
            cursor={listado.items.length === POR_PAGINA ? ultima : null}
            basePath="/experiencias"
            tipo="experience"
            etiqueta="experiencias"
            limite={POR_PAGINA}
          />
        )}
      </section>

      <p className="aviso" style={{ marginTop: 26 }}>
        Las {listado.total.toLocaleString("es-ES")} experiencias proceden de fuentes públicas (OpenStreetMap
        y otras) y figuran con su autoría. Las fotografías son imágenes de referencia de esas mismas
        fuentes, no fotos propias de cada actividad. Solo 48 experiencias del catálogo tienen precio
        publicado; el resto dice «Consultar» a propósito: no se inventa ninguno. Cuando el motor de
        enriquecimiento ha encontrado la imagen oficial del propio sitio, se muestra esa —rotulada
        como oficial— en lugar de la de referencia.
      </p>
    </main>
  );
}
