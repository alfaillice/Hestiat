import { buscar } from "@/lib/db";

/**
 * Bloque de resultados de búsqueda, compartido por `/` y `/search`.
 * Una sola implementación: la duplicación de lógica fue uno de los problemas
 * estructurales de la versión anterior y no se repite.
 */
export default async function Resultados({
  q,
  pagina,
  basePath,
}: {
  q: string;
  pagina: number;
  basePath: string;
}) {
  const { total, items, porPagina } = await buscar({ q, pagina });
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const enlace = (p: number) => `${basePath}?q=${encodeURIComponent(q)}&p=${p}`;

  return (
    <>
      <form className="search" method="get" action={basePath}>
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
                  {a.price_per_night ? `${Number(a.price_per_night).toLocaleString("es-ES")} € / noche` : "Consultar"}
                  {a.price_type !== "real" && <span className="ref"> · orientativo</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <nav className="nav">
        {pagina > 1 && <a href={enlace(pagina - 1)}>← Anterior</a>}
        {hasta < total && <a href={enlace(pagina + 1)}>Siguiente →</a>}
      </nav>

      <p className="warn">
        Datos reales del esquema nuevo (<code>accommodation</code>, <code>accommodation_photo</code>).
        Los precios se distinguen siempre entre publicados y orientativos, con su fuente.
      </p>
    </>
  );
}
