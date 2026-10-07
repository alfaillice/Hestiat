import Link from "next/link";
import type { Metadata } from "next";
import { buscarCatalogo, totalCatalogo } from "@/lib/catalogo.server";
import { poolLegacy } from "@/lib/db";
import { Vacio } from "@/components/estados";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Experiencias y planes — Hestiat",
  description:
    "Qué hacer y qué visitar en toda España: rutas, miradores, patrimonio, naturaleza y planes cerca de tu alojamiento.",
  alternates: { canonical: "/experiencias" },
};

/**
 * Catálogo público de experiencias.
 *
 * Antes esta página decía «fase de datos en preparación» mientras en la base había **262.804
 * experiencias**. Ahora se muestran de verdad: se filtra por provincia y categoría, se busca por
 * nombre y se pagina. Nada de datos inventados: lo que se ve sale del catálogo importado, con su
 * autoría.
 */
const POR_PAGINA = 24;

export default async function Experiencias({
  searchParams,
}: {
  searchParams: Promise<{ provincia?: string; categoria?: string; q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const provincia = (sp.provincia ?? "").trim() || null;
  const categoria = (sp.categoria ?? "").trim() || null;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? 1) || 1);

  const [provincias, categorias] = await Promise.all([
    poolLegacy
      .query<any[]>(
        `SELECT province AS provincia, COUNT(*) AS total FROM experiencia
          WHERE province IS NOT NULL AND province <> '' GROUP BY province ORDER BY total DESC LIMIT 60`,
      )
      .then(([f]) => f)
      .catch(() => []),
    poolLegacy
      .query<any[]>(
        `SELECT category AS name, COUNT(*) AS total FROM experiencia
          WHERE category IS NOT NULL AND category <> '' GROUP BY category ORDER BY total DESC LIMIT 40`,
      )
      .then(([f]) => f)
      .catch(() => []),
  ]);

  const [fichas, total] = await Promise.all([
    buscarCatalogo("experiencia", { provincia, q, limite: POR_PAGINA, pagina, categoria }),
    totalCatalogo("experiencia", provincia),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlace = (p: number) => {
    const url = new URLSearchParams();
    if (provincia) url.set("provincia", provincia);
    if (categoria) url.set("categoria", categoria);
    if (q) url.set("q", q);
    if (p > 1) url.set("p", String(p));
    return `/experiencias${url.toString() ? `?${url}` : ""}`;
  };

  return (
    <main className="wrap" style={{ paddingBottom: 60 }}>
      <header style={{ paddingTop: 34, marginBottom: 18 }}>
        <h1 style={{ fontFamily: "var(--fuente-titulo)", fontSize: 34, marginBottom: 6 }}>Experiencias y planes</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {total.toLocaleString("es-ES")} {total === 1 ? "plan" : "planes"}
          {provincia ? ` en ${provincia}` : " en toda España"}. Datos del catálogo público, con su autoría.
        </p>
      </header>

      <form method="get" className="admin-buscar" style={{ flexWrap: "wrap" }}>
        <select name="provincia" defaultValue={provincia ?? ""}>
          <option value="">Todas las provincias</option>
          {provincias.map((p) => (
            <option key={p.provincia} value={p.provincia}>
              {p.provincia} ({Number(p.total).toLocaleString("es-ES")})
            </option>
          ))}
        </select>
        <select name="categoria" defaultValue={categoria ?? ""}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Buscar por nombre" />
        <button type="submit" className="f-aplicar">Buscar</button>
        {(provincia || categoria || q) && <Link className="f-limpiar" href="/experiencias">Quitar filtros</Link>}
      </form>

      {fichas.length === 0 ? (
        <Vacio
          titulo="No hay planes que coincidan"
          explicacion={
            q || provincia || categoria
              ? "Prueba con otra provincia, otra categoría o menos palabras."
              : "El catálogo está vacío en este momento."
          }
          accion={{ texto: "Ver todo el catálogo", href: "/experiencias" }}
        />
      ) : (
        <>
          <div className="grid3" style={{ marginTop: 18 }}>
            {fichas.map((f) => (
              <article key={f.id} className="tarjeta">
                <h2 style={{ fontFamily: "var(--fuente-titulo)", fontSize: 17, marginBottom: 4 }}>
                  {f.web ? (
                    <a href={f.web} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>
                      {f.nombre.slice(0, 60)}
                    </a>
                  ) : (
                    f.nombre.slice(0, 60)
                  )}
                </h2>
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
                  {[f.categoria, f.municipio, f.provincia].filter(Boolean).join(" · ") || "Sin ubicación"}
                </p>
                {f.descripcion && (
                  <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13, marginTop: 6 }}>
                    {f.descripcion.slice(0, 120)}
                  </p>
                )}
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 8 }}>
                  {f.precio ? `Precio: ${f.precio}` : "Precio no indicado"}
                  {f.fuente ? ` · fuente: ${f.fuente}` : ""}
                </p>
              </article>
            ))}
          </div>

          {paginas > 1 && (
            <nav className="nav" style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {pagina > 1 && <Link href={enlace(pagina - 1)}>← Anterior</Link>}
              <span className="m" style={{ color: "var(--muted-fg)" }}>Página {pagina} de {paginas.toLocaleString("es-ES")}</span>
              {pagina < paginas && <Link href={enlace(pagina + 1)}>Siguiente →</Link>}
            </nav>
          )}
        </>
      )}

      <p className="aviso" style={{ marginTop: 26 }}>
        Estos planes proceden de fuentes públicas y figuran con su autoría. Si tienes un alojamiento en
        Hestiat, puedes vincular los que quieras para ofrecérselos a tus huéspedes desde tu panel.
      </p>
    </main>
  );
}
