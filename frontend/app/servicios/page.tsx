import Link from "next/link";
import type { Metadata } from "next";
import SeccionHome from "@/components/seccion-home";
import ImagenSegura from "@/components/imagen-segura";
import CercaDeTi from "@/components/cerca-de-ti";
import {
  buscarServicios,
  categoriasServicioConDatos,
  destacadosServicios,
  provinciasConServicios,
  type ServTarjeta,
} from "@/lib/servicios.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Servicios — Hestiat",
  description:
    "Servicios reales en toda España: peluquerías, bienestar, gimnasios, veterinarios, transporte, lavanderías, fotografía y más, con su ubicación y su precio cuando está publicado.",
  alternates: { canonical: "/servicios" },
};

const POR_PAGINA = 24;

/** Una tarjeta de servicio. La misma pieza para las filas y para la rejilla. */
function TarjetaServ({ s }: { s: ServTarjeta }) {
  const lugar = [s.municipio, s.provincia].filter(Boolean).join(", ");
  return (
    <Link className="serv-card" href={s.href}>
      <span className="serv-media">
        <ImagenSegura src={s.imagen} alt={`${s.nombre}: imagen de referencia`} />
      </span>
      <span className="serv-txt">
        <b>{s.nombre}</b>
        {lugar ? <span className="m">{lugar}</span> : null}
        <span className="m">{s.categoria ?? "Sin categoría"}{s.subcategoria ? ` · ${s.subcategoria}` : ""}</span>
        <span className="serv-fuente">
          {s.precio}
          {s.precioOrientativo ? " · orientativo" : ""}
        </span>
      </span>
    </Link>
  );
}

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
  const pagina = Math.max(1, Number(uno(sp.p) ?? 1) || 1);
  const filtrando = Boolean(q || categoria || provincia);

  const [categorias, provincias, listado] = await Promise.all([
    categoriasServicioConDatos(),
    provinciasConServicios(14),
    buscarServicios({ q, categoria, provincia, pagina, porPagina: POR_PAGINA }),
  ]);
  const destacados = filtrando ? [] : await destacadosServicios(13);
  const paginas = Math.max(1, Math.ceil(listado.total / listado.porPagina));
  const elegida = categorias.find((c) => c.slug === categoria) ?? categorias.find((c) => c.hijas.some((h) => h.slug === categoria));

  const enlaces = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const base = { q: q || undefined, categoria, provincia, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    const s = u.toString();
    return `/servicios${s ? `?${s}` : ""}`;
  };

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
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
        {categorias.map((c) => (
          <Link className="tcat" key={c.slug} href={`/servicios?categoria=${encodeURIComponent(c.slug)}`}>
            <span className="tcat-media" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, background: "var(--fucsia-soft)" }}>
              <span aria-hidden="true">{c.icono ?? "🛎"}</span>
            </span>
            <span className="tcat-txt">
              <b>{c.nombre}</b>
              <span>{c.total.toLocaleString("es-ES")} servicios</span>
            </span>
          </Link>
        ))}
      </SeccionHome>

      {destacados.length > 0 ? (
        <SeccionHome titulo="Servicios destacados" sub="Los que tienen más información publicada: web, teléfono y horario reales" verTodos="/servicios">
          {destacados.map((s) => (
            <TarjetaServ key={s.id} s={s} />
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
          <>
            <div className="serv-grid">
              {listado.items.map((s) => (
                <TarjetaServ key={s.id} s={s} />
              ))}
            </div>
            {pagina < paginas ? (
              <p style={{ marginTop: 22, textAlign: "center" }}>
                <Link className="f-aplicar" href={enlaces({ p: String(pagina + 1) })}>Cargar más servicios</Link>
                <span className="m" style={{ display: "block", marginTop: 8, color: "var(--muted-fg)", fontSize: 13 }}>
                  Página {pagina.toLocaleString("es-ES")} de {paginas.toLocaleString("es-ES")}
                </span>
              </p>
            ) : null}
          </>
        )}
      </section>

      <p className="aviso" style={{ marginTop: 26 }}>
        Los {listado.total.toLocaleString("es-ES")} servicios proceden de fuentes públicas (OpenStreetMap y
        otras) y figuran con su autoría. Las fotografías son imágenes de referencia de esas mismas fuentes,
        no fotos propias de cada negocio. Solo 89 servicios tienen importe publicado; el resto dice
        «Consultar» a propósito: no se inventa ninguno.
      </p>
    </main>
  );
}
