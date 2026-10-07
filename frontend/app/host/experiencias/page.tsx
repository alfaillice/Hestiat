import Link from "next/link";
import { Aviso, Vacio } from "@/components/estados";
import { requireHost } from "@/lib/auth.server";
import { misAlojamientos } from "@/lib/calendario.server";
import { buscarCatalogo, listarEnlazadas, totalCatalogo, type TipoCatalogo } from "@/lib/catalogo.server";

export const dynamic = "force-dynamic";

/**
 * Experiencias y servicios para tus alojamientos.
 *
 * Se dice lo que son: un **catálogo importado** de fuentes públicas, no registros creados por
 * anfitriones. Por eso aquí no se «editan»: se **vinculan** a tu alojamiento para ofrecérselos a
 * tus huéspedes, y se desvinculan cuando quieras.
 *
 * La búsqueda se hace por la provincia del alojamiento seleccionado, que es lo que tiene sentido
 * para un anfitrión: qué hay cerca de su casa.
 *
 * Formularios POST normales: funciona sin JavaScript.
 */
export default async function HostExperiencias({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; tipo?: string; q?: string; aviso?: string; ok?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;

  const sp = await searchParams;
  const lista = await misAlojamientos(host.id);
  const seleccionado = Number(sp.a) || lista[0]?.id || 0;
  const alojamiento = lista.find((l) => l.id === seleccionado) ?? lista[0];
  const tipo: TipoCatalogo = sp.tipo === "servicio" ? "servicio" : "experiencia";
  const q = (sp.q ?? "").trim();

  const propio = alojamiento
    ? { provincia: alojamiento.provincia ?? null, ciudad: alojamiento.ciudad ?? null }
    : null;

  const [fichas, enlazadas, total] = alojamiento
    ? await Promise.all([
        buscarCatalogo(tipo, { provincia: propio?.provincia ?? null, q, limite: 40 }),
        listarEnlazadas(host.id, alojamiento.id, tipo),
        totalCatalogo(tipo, propio?.provincia ?? null),
      ])
    : [[], [], 0];

  const enlazadasSet = new Set(enlazadas);
  const base = `/host/experiencias?a=${alojamiento?.id ?? ""}&tipo=${tipo}`;

  return (
    <>
      <header className="admin-cab">
        <h1>Experiencias y servicios</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Añade a tus alojamientos qué se puede hacer y qué se puede contratar cerca. Se ofrecen al
          huésped junto a tu alojamiento.
        </p>
      </header>

      <Aviso texto={sp.aviso} ok={sp.ok} />

      {lista.length === 0 || !alojamiento ? (
        <p className="aviso">Todavía no tienes alojamientos. <Link href="/host" style={{ textDecoration: "underline" }}>Vuelve a tu panel</Link>.</p>
      ) : (
        <>
          <nav style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Link className={tipo === "experiencia" ? "f-aplicar" : "f-limpiar"} href={`/host/experiencias?a=${alojamiento.id}&tipo=experiencia`}>Experiencias</Link>
            <Link className={tipo === "servicio" ? "f-aplicar" : "f-limpiar"} href={`/host/experiencias?a=${alojamiento.id}&tipo=servicio`}>Servicios</Link>
          </nav>

          <form method="get" className="admin-buscar">
            <input type="hidden" name="tipo" value={tipo} />
            <select name="a" defaultValue={String(alojamiento.id)}>
              {lista.map((l) => (
                <option key={l.id} value={l.id}>{l.titulo} {l.ciudad ? `· ${l.ciudad}` : ""}</option>
              ))}
            </select>
            <input name="q" defaultValue={q} placeholder={`Buscar ${tipo === "experiencia" ? "experiencia" : "servicio"} por nombre`} />
            <button type="submit" className="f-aplicar">Buscar</button>
          </form>

          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 12 }}>
            {alojamiento.titulo}
            {propio?.provincia ? ` · provincia ${propio.provincia}` : ""} ·{" "}
            <strong>{enlazadas.length}</strong> {enlazadas.length === 1 ? "vinculada" : "vinculadas"} de{" "}
            {total.toLocaleString("es-ES")} en el catálogo
            {propio?.provincia ? ` de ${propio.provincia}` : ""}
          </p>

          <form action="/api/host/experiencias" method="post">
            <input type="hidden" name="a" value={alojamiento.id} />
            <input type="hidden" name="tipo" value={tipo} />

            {fichas.length === 0 ? (
              <p className="aviso">
                No hay {tipo === "experiencia" ? "experiencias" : "servicios"} en el catálogo que coincidan
                {q ? ` con «${q}»` : ""}{propio?.provincia ? ` en ${propio.provincia}` : ""}.
              </p>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr><th>Vincular</th><th>Nombre</th><th>Categoría</th><th>Municipio</th><th>Precio</th><th>Fuente</th></tr>
                  </thead>
                  <tbody>
                    {fichas.map((f) => (
                      <tr key={f.id}>
                        <td><input type="checkbox" name="ids" value={f.id} defaultChecked={enlazadasSet.has(f.id)} aria-label={`Vincular ${f.nombre}`} /></td>
                        <td>
                          {f.web ? (
                            <a href={f.web} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>{f.nombre.slice(0, 46)}</a>
                          ) : (
                            f.nombre.slice(0, 46)
                          )}
                        </td>
                        <td>{f.categoria ?? "—"}</td>
                        <td>{f.municipio ?? "—"}</td>
                        <td>{f.precio ?? "—"}</td>
                        <td style={{ color: "var(--muted-fg)", fontSize: 12.5 }}>{f.fuente ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {fichas.length > 0 && (
              <div className="f-acciones" style={{ marginTop: 14 }}>
                <button className="f-aplicar" type="submit" name="accion" value="agregar">Vincular las marcadas</button>
                <button className="f-limpiar" type="submit" name="accion" value="quitar">Quitar las marcadas</button>
              </div>
            )}
          </form>

          <p className="aviso" style={{ marginTop: 18 }}>
            Las de arriba son las que ya están marcadas. Estos registros proceden de fuentes públicas
            (figuran con su autoría) y <strong>no se editan desde aquí</strong>: se vinculan a tu
            alojamiento o se quitan.
          </p>
        </>
      )}
    </>
  );
}
