import { buscar } from "@/lib/db";

export const dynamic = "force-dynamic"; // datos vivos: la búsqueda no se cachea

/**
 * Portada + búsqueda. Server Component: la consulta se hace en el servidor y el HTML
 * sale ya renderizado (SSR), que es lo que exige el SEO y la velocidad en móvil.
 */
export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);
  const { total, items, porPagina } = await buscar({ q, pagina });
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <main className="wrap">
      <h1 style={{ fontSize: 40, lineHeight: 1.12, margin: "30px 0 8px", maxWidth: "20ch" }}>
        ¿Dónde quieres despertar?
      </h1>

      <form className="search" method="get" action="/">
        <input name="q" defaultValue={q} placeholder="Ciudad, provincia…" aria-label="Buscar destino" />
        <button type="submit">Buscar</button>
      </form>

      <p className="count">
        {total.toLocaleString("es-ES")} alojamientos
        {q ? ` para «${q}»` : ""}
        {total > 0 ? ` · mostrando ${desde}–${hasta}` : ""}
      </p>

      {items.length === 0 ? (
        <p className="warn">
          No hay resultados con ese criterio. Prueba con otra ciudad o provincia, o quita el filtro.
        </p>
      ) : (
        <div className="cards">
          {items.map((a) => (
            <a className="card" key={a.id} href={`/alojamiento/${a.slug}`}>
              {a.portada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.portada} alt={a.title} loading="lazy" />
              ) : (
                <div className="nofoto" />
              )}
              <div className="body">
                <div className="t">{a.title}</div>
                <div className="m">{[a.city, a.province].filter(Boolean).join(", ")}</div>
                <div className="p">
                  {a.price_per_night
                    ? `${Number(a.price_per_night).toLocaleString("es-ES")} € / noche`
                    : "Consultar"}
                  {a.price_type !== "real" && <span className="ref"> · orientativo</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <nav className="nav">
        {pagina > 1 && (
          <a href={`/?q=${encodeURIComponent(q)}&p=${pagina - 1}`}>← Anterior</a>
        )}
        {hasta < total && (
          <a href={`/?q=${encodeURIComponent(q)}&p=${pagina + 1}`}>Siguiente →</a>
        )}
      </nav>

      <p className="warn">
        Datos reales del esquema nuevo (<code>accommodation</code>, <code>accommodation_photo</code>).
        Los precios se distinguen siempre entre publicados y orientativos, con su fuente.
      </p>
    </main>
  );
}
