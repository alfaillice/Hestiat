import Link from "next/link";
import type { Metadata } from "next";
import { pool } from "@/lib/db";
import { Vacio } from "@/components/estados";
import TarjetaCategoria from "@/components/tarjeta-categoria";
import Carrusel from "@/components/carrusel";
import { categoriasServicio } from "@/lib/home.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Servicios — Hestiat",
  description:
    "Servicios reales en toda España: belleza y cuidado personal, deporte, comida y catering, mascotas, fotografía y más, con su ubicación y su precio cuando está publicado.",
  alternates: { canonical: "/servicios" },
};

const POR_PAGINA = 24;

/** El precio, tal y como está en la base. Nunca se inventa uno ni se redondea a la baja. */
function precioLegible(fila: Record<string, unknown>): string | null {
  if (String(fila.price_type ?? "") === "free") return "Gratis";
  const valor = Number(fila.price ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const numero = valor.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const unidad =
    fila.price_unit === "day" ? " / día" : fila.price_unit === "hour" ? " / hora" : fila.price_unit === "person" ? " / persona" : "";
  const moneda = String(fila.currency ?? "EUR") === "EUR" ? "€" : String(fila.currency ?? "");
  const desde = String(fila.price_type ?? "") === "from" ? "Desde " : "";
  return `${desde}${numero} ${moneda}${unidad}`;
}

/**
 * Catálogo público de SERVICIOS.
 *
 * Se muestran los servicios reales de la base (34.075), con su categoría, su municipio, su precio
 * cuando está publicado y su fuente. Cada imagen es una fotografía de referencia de una fuente
 * pública y se dice de dónde viene: no se presenta como foto propia de ese negocio.
 *
 * Se filtra por categoría o por nombre, y se pagina.
 */
export default async function Servicios({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const categoria = (sp.categoria ?? "").trim() || null;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? 1) || 1);

  const where: string[] = ["is_active = 1", "category IS NOT NULL", "category <> ''"];
  const valores: unknown[] = [];
  if (categoria) {
    where.push("category = ?");
    valores.push(categoria);
  }
  if (q.length >= 2) {
    where.push("name LIKE ?");
    valores.push(`%${q}%`);
  }
  const condicion = where.join(" AND ");

  const [categorias, [totales], [filas]] = await Promise.all([
    categoriasServicio(11),
    pool.query<any[]>(`SELECT COUNT(*) AS n FROM servicio_turistico WHERE ${condicion}`, valores),
    pool.query<any[]>(
      `SELECT id, name, slug, category, subcategory, municipality, province, short_description,
              price, currency, price_unit, price_type, main_image, rating, rating_count, source_name
         FROM servicio_turistico
        WHERE ${condicion}
        ORDER BY id ASC
        LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA],
    ),
  ]);

  const total = Number(totales[0]?.n ?? 0);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (p: number) => {
    const url = new URLSearchParams();
    if (categoria) url.set("categoria", categoria);
    if (q) url.set("q", q);
    if (p > 1) url.set("p", String(p));
    const cadena = url.toString();
    return `/servicios${cadena ? `?${cadena}` : ""}`;
  };

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <h1 style={{ fontSize: "clamp(24px,3vw,34px)", marginBottom: 6 }}>Servicios</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 18 }}>
        {total.toLocaleString("es-ES")} servicios reales
        {categoria ? ` en «${categoria}»` : ""}
        {q ? ` que coinciden con «${q}»` : ""}. Cada uno con su ubicación y su precio cuando está publicado.
      </p>

      <section className="seccion-home" style={{ margin: "10px 0 26px" }}>
        <div className="seccion-home-cab">
          <h2 style={{ fontSize: 20 }}>Categorías</h2>
          <Link className="ver-todos" href="/servicios">
            Ver todos <span aria-hidden="true">→</span>
          </Link>
        </div>
        <Carrusel etiqueta="Categorías de servicios">
          {categorias.map((c) => (
            <TarjetaCategoria key={c.valor} categoria={c} pie="servicios" />
          ))}
        </Carrusel>
      </section>

      <form className="filtros" method="get" action="/servicios" style={{ marginBottom: 18 }}>
        <label className="f-campo">
          <span className="etq">Categoría</span>
          <select name="categoria" defaultValue={categoria ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre} ({c.total.toLocaleString("es-ES")})
              </option>
            ))}
          </select>
        </label>
        <label className="f-campo">
          <span className="etq">Buscar por nombre</span>
          <input name="q" defaultValue={q} placeholder="Peluquería, masaje, catering…" />
        </label>
        <div className="f-acciones">
          <button type="submit" className="f-aplicar">Aplicar</button>
          <Link href="/servicios" className="f-limpiar">Quitar filtros</Link>
        </div>
      </form>

      {filas.length === 0 ? (
        <Vacio
          titulo="No hay servicios que coincidan"
          explicacion={
            categoria || q
              ? "Prueba con otra categoría o con menos palabras."
              : "El catálogo está vacío en este momento."
          }
          accion={{ texto: "Ver todo el catálogo de servicios", href: "/servicios" }}
        />
      ) : (
        <>
          <div className="serv-grid">
            {filas.map((f) => {
              const precio = precioLegible(f);
              return (
                <article className="serv-card" key={f.id}>
                  <span className="serv-media">
                    {f.main_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={String(f.main_image)} alt={`${String(f.name).slice(0, 60)}: imagen de referencia`} loading="lazy" decoding="async" />
                    ) : (
                      <span className="tcat-sinfoto" aria-hidden="true" />
                    )}
                  </span>
                  <div className="serv-txt">
                    <b>{String(f.name).slice(0, 70)}</b>
                    <span className="m">
                      {[f.municipality, f.province].filter(Boolean).join(", ") || "Sin ubicación"}
                    </span>
                    <span className="m">{precio ?? "Precio no publicado"}</span>
                    <span className="serv-fuente">
                      {f.source_name ? `Referencia · ${f.source_name}` : "Referencia"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          {paginas > 1 && (
            <nav style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }} aria-label="Paginación">
              {pagina > 1 && <Link href={enlace(pagina - 1)}>← Anterior</Link>}
              <span className="m" style={{ color: "var(--muted-fg)" }}>
                Página {pagina.toLocaleString("es-ES")} de {paginas.toLocaleString("es-ES")}
              </span>
              {pagina < paginas && <Link href={enlace(pagina + 1)}>Siguiente →</Link>}
            </nav>
          )}
        </>
      )}

      <p className="aviso" style={{ marginTop: 26 }}>
        Los servicios proceden de fuentes públicas (OpenStreetMap y otras) y figuran con su autoría.
        Las fotografías son imágenes de referencia de esas mismas fuentes, no fotos propias de cada
        negocio. El precio se muestra solo cuando está publicado, con su unidad.
      </p>
    </main>
  );
}
