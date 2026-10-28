import Link from "next/link";
import EspacioPublicidad from "@/components/espacio-publicidad";
import type { Metadata } from "next";
import SeccionHome from "@/components/seccion-home";
import CercaDeTi from "@/components/cerca-de-ti";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import ListaCatalogo from "@/components/lista-catalogo";
import TarjetaCatalogo, { aItemCatalogo } from "@/components/tarjeta-catalogo";
import TarjetaCategoria from "@/components/tarjeta-categoria";
import { categoryImageMap } from "@/lib/imagenes-home";
import MigasJsonLd from "@/components/migas-jsonld";
import {
  buscarServicios,
  categoriasServicioConDatos,
  destacadosServicios,
  provinciasConServicios,
} from "@/lib/servicios.server";

export const dynamic = "force-dynamic";

/**
 * TÍTULO Y CANÓNICA DE CADA PÁGINA, SEGÚN SU CATEGORÍA.
 *
 * Una página de categoría no es un duplicado del listado: tiene su propio contenido (solo esa
 * categoría), su propio título y su propio enlace. Por eso se declara CANÓNICA A SÍ MISMA, con su
 * parámetro incluido. Antes declaraba `/servicios` como canónica, así que Google la habría tratado
 * como duplicado del listado y no la habría indexado nunca, aunque se le permitiera rastrearla.
 *
 * Los demás filtros (provincia, búsqueda, paginación) siguen declarando el listado: no se indexan.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const categoria = typeof sp.categoria === "string" ? sp.categoria : "";
  if (!categoria) {
    return {
      title: "Servicios turísticos y locales en España — Hestiat",
      description:
        "Servicios reales en toda España: peluquerías, bienestar, gimnasios, veterinarios, transporte, lavanderías, fotografía y más, con su ubicación y su precio cuando está publicado.",
      alternates: { canonical: "/servicios" },
    };
  }

  // El nombre y el recuento salen del catálogo real: nada inventado.
  const categorias = await categoriasServicioConDatos();
  const c = categorias.find((x) => x.slug === categoria);
  const nombre = c?.nombre ?? categoria.replace(/-/g, " ");
  const total = c?.total ?? 0;
  const ruta = `/servicios?categoria=${encodeURIComponent(categoria)}`;

  return {
    title: total
      ? `${nombre}: ${total.toLocaleString("es-ES")} servicios en Hestiat`
      : `${nombre}: servicios en Hestiat`,
    description: `Servicios de ${nombre.toLowerCase()} publicados en Hestiat, con su ubicación real y su contacto cuando está disponible.`,
    alternates: { canonical: ruta },
    robots: { index: true, follow: true },
  };
}

const POR_PAGINA = 24;

/**
 * Catálogo público de SERVICIOS (35.585, todos los del catálogo).
 *
 * Lo que NO se ofrece, y por qué:
 *  · No hay filtro de valoración: los 35.585 servicios tienen nota vacía.
 *  · No hay filtro de precio: solo 89 tienen importe publicado (142 con algún estado).
 *  · No hay filtro por familia, accesible ni parking: esos campos están vacíos.
 * Un filtro que no puede devolver nada es una promesa falsa, así que no se pone.
 *
 * El filtro de categoría acepta TANTO categoría como subcategoría, para que funcionen igual
 * /servicios?categoria=peluqueria y /servicios?categoria=masajes.
 */
export default async function Servicios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (uno(sp.q) ?? "").trim();
  const categoria = (uno(sp.categoria) ?? "").trim() || undefined;
  const provincia = (uno(sp.provincia) ?? "").trim() || undefined;
  // Cursor: si se llega con ?desde= (enlace sin JavaScript) la lista empieza por esa ficha.
  const desde = Math.max(0, Number(uno(sp.desde) ?? 0) || 0) || undefined;
  const filtrando = Boolean(q || categoria || provincia);

  const [categorias, provincias, listado] = await Promise.all([
    categoriasServicioConDatos(),
    provinciasConServicios(14),
    buscarServicios({ q, categoria, provincia, desde, porPagina: POR_PAGINA }),
  ]);
  const destacados = filtrando ? [] : await destacadosServicios(13);

  /*
   * FAVORITOS. La sesión y qué elementos de esta pantalla están guardados, con el mismo ayudante y el
   * mismo corazón que usan los alojamientos. El tipo forma parte de la identificación.
   */
  const sesionLista = await getCurrentUser();
  const destacadosIds = destacados.map((x) => Number(x.id));
  const idsPantalla = [...destacadosIds, ...listado.items.map((i) => Number(i.id))];
  const guardadosPantalla = sesionLista
    ? [...(await guardadosEntre(Number(sesionLista.id), "servicio", idsPantalla))]
    : [];
  const elegida = categorias.find((c) => c.slug === categoria) ?? categorias.find((c) => c.hijas.some((h) => h.slug === categoria));

  /* Los filtros actuales, sin el cursor: la consulta que viaja en cada tanda del scroll infinito. */
  const consulta = (() => {
    const u = new URLSearchParams();
    const base = { q: q || undefined, categoria, provincia };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    return u.toString();
  })();
  const ultimo = listado.items.length > 0 ? listado.items[listado.items.length - 1].id : null;

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <MigasJsonLd
        items={[
          { nombre: "Hestiat", ruta: "/" },
          { nombre: "Servicios", ruta: "/servicios" },
        ]}
      />
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 6 }}>Servicios</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 18 }}>
        {listado.total.toLocaleString("es-ES")} servicios reales
        {elegida ? ` en «${elegida.nombre}»` : ""}
        {provincia ? ` en ${provincia}` : ""}
        {q ? ` que coinciden con «${q}»` : ""}. Con su ubicación y su precio cuando está publicado.
      </p>

      <form className="filtros" method="get" action="/servicios" style={{ marginBottom: 20 }}>
        <label className="f-campo">
          <span className="etq">Buscar</span>
          <input name="q" defaultValue={q} placeholder="Nombre, ciudad o provincia" />
        </label>
        <label className="f-campo">
          <span className="etq">Categoría o subcategoría</span>
          <select name="categoria" defaultValue={categoria ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <optgroup key={c.slug} label={`${c.icono ? `${c.icono} ` : ""}${c.nombre} (${c.total.toLocaleString("es-ES")})`}>
                <option value={c.slug}>{c.nombre} · todo</option>
                {c.hijas.map((h) => (
                  <option key={h.slug} value={h.slug}>
                    {h.nombre} ({h.total.toLocaleString("es-ES")})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
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
          <Link className="f-limpiar" href="/servicios">Quitar filtros</Link>
        </div>
      </form>

      <SeccionHome titulo="Explora por categoría" sub="Las categorías de Hestiat, con sus servicios reales" verTodos="/servicios" verTodosTexto="Ver todo">
        {/* Mismo componente de tarjeta de categoría que en Experiencias: la imagen real de la
            categoría, no un emoji. */}
        {categorias.map((c) => (
          <TarjetaCategoria
            key={c.slug}
            pie="servicios"
            categoria={{
              valor: c.slug,
              nombre: c.nombre,
              total: c.total,
              imagenes: categoryImageMap("servicio", c.slug),
              href: `/servicios?categoria=${encodeURIComponent(c.slug)}`,
            }}
          />
        ))}
      </SeccionHome>

      {destacados.length > 0 ? (
        <SeccionHome titulo="Servicios destacados" sub="Los que tienen más información publicada: web, teléfono y horario reales" verTodos="/servicios">
          {destacados.map((s) => (
            <TarjetaCatalogo
              key={s.id}
              item={aItemCatalogo(s)}
              tipo="servicio"
              guardado={guardadosPantalla.includes(Number(s.id))}
              haySesion={Boolean(sesionLista)}
              volverA="/servicios"
            />
          ))}
        </SeccionHome>
      ) : null}

      <section className="seccion-home">
        <div className="seccion-home-cab">
          <div>
            <h2>Por destino</h2>
            <p className="seccion-home-sub">Provincias con más servicios, con su recuento real</p>
          </div>
          <Link className="ver-todos" href="/servicios">Ver todos <span aria-hidden="true">→</span></Link>
        </div>
        <div className="f-chips">
          {provincias.map((p) => (
            <Link className="f-chip" key={p.provincia} href={`/servicios?provincia=${encodeURIComponent(p.provincia)}`}>
              <span>{p.provincia} <em>({p.total.toLocaleString("es-ES")})</em></span>
            </Link>
          ))}
        </div>
      </section>

      <CercaDeTi soloServicios />

      <section className="seccion-home">
        <div className="seccion-home-cab">
          <div>
            <h2>{filtrando ? "Resultados" : "Todos los servicios"}</h2>
            <p className="seccion-home-sub">
              {filtrando ? `${listado.total.toLocaleString("es-ES")} coinciden con lo que has elegido` : "Recorriendo el catálogo completo, por orden de identificador"}
            </p>
          </div>
        </div>
        {listado.items.length === 0 ? (
          <p className="aviso">No hay servicios con esos criterios. Prueba con otra categoría, otro destino o menos palabras.</p>
        ) : (
          <ListaCatalogo
            key={consulta}
            iniciales={listado.items.map(aItemCatalogo)}
            haySesion={Boolean(sesionLista)}
            guardadosIniciales={guardadosPantalla}
            total={listado.total}
            consulta={consulta}
            cursor={listado.items.length === POR_PAGINA ? ultimo : null}
            basePath="/servicios"
            tipo="service"
            etiqueta="servicios"
            limite={POR_PAGINA}
          />
        )}
      </section>

      <p className="aviso" style={{ marginTop: 26 }}>
        Los {listado.total.toLocaleString("es-ES")} servicios proceden de fuentes públicas (OpenStreetMap y
        otras) y figuran con su autoría. Las fotografías son imágenes de referencia de esas mismas fuentes,
        no fotos propias de cada negocio. Solo 89 servicios tienen importe publicado; el resto dice
        «Consultar» a propósito: no se inventa ninguno. Cuando el motor de enriquecimiento ha
        encontrado la imagen oficial del propio negocio, se muestra esa —rotulada como oficial— en
        lugar de la de referencia.
      </p>
          <EspacioPublicidad hueco="servicios-tras-filtros" />
</main>
  );
}
