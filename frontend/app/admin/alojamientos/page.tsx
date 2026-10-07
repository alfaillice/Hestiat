import Link from "next/link";
import { poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Gestión de alojamientos — el listado del backoffice, equivalente al de la aplicación antigua.
 * Lee de la base ORIGINAL (datos vivos): lo que el administrador ve es lo que está publicado.
 * Nunca mezcla datos de prueba: si se crean, se marcan con el título y se borran al terminar.
 */
import { Aviso } from "@/components/estados";

export default async function AdminAlojamientos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string; estado?: string; aviso?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? 1) || 1);
  const por = 25;
  const offset = (pagina - 1) * por;

  const filtros: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (q) {
    filtros.push("(titulo LIKE ? OR ciudad LIKE ? OR provincia LIKE ? OR CAST(id AS CHAR) = ?)");
    valores.push(`%${q}%`, `%${q}%`, `%${q}%`, q);
  }
  if (sp.estado === "activos") filtros.push("activo = 1");
  if (sp.estado === "inactivos") filtros.push("activo = 0");
  const where = filtros.join(" AND ");

  const [tot] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM alojamiento WHERE ${where}`, valores);
  const total = Number(tot[0]?.n ?? 0);
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT id, titulo, ciudad, provincia, precio_noche, precio_orientativo, activo, lat, lng,
            (SELECT COUNT(*) FROM alojamiento_foto f WHERE f.alojamiento_id = a.id) AS fotos
       FROM alojamiento a WHERE ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...valores, por, offset],
  );

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + por, total);

  return (
    <>
      <header className="admin-cab">
        <h1>Alojamientos</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {total.toLocaleString("es-ES")} registros · mostrando {desde}–{hasta}
        </p>
      </header>

      {/* Tras eliminar un alojamiento se vuelve aquí con el mensaje: quedarse en su ficha daría 404. */}
      <Aviso texto={sp.aviso} ok={sp.ok} />

      <p style={{ marginBottom: 14 }}>
        <Link className="f-aplicar" href="/nuevo">
          Nuevo alojamiento
        </Link>
      </p>

      <form className="admin-buscar" method="get">
        <input name="q" defaultValue={q} placeholder="Buscar por título, ciudad, provincia o id" />
        <select name="estado" defaultValue={sp.estado ?? ""}>
          <option value="">Todos</option>
          <option value="activos">Publicados</option>
          <option value="inactivos">Despublicados</option>
        </select>
        <button type="submit" className="f-aplicar">
          Filtrar
        </button>
      </form>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Ubicación</th>
              <th>Precio</th>
              <th>Fotos</th>
              <th>Coords</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.id}>
                <td className="num">{a.id}</td>
                <td>{a.titulo}</td>
                <td>{[a.ciudad, a.provincia].filter(Boolean).join(", ") || "—"}</td>
                <td className="num">
                  {a.precio_noche
                    ? `${Number(a.precio_noche).toLocaleString("es-ES")} €`
                    : a.precio_orientativo
                      ? `desde ${Number(a.precio_orientativo).toLocaleString("es-ES")} €`
                      : "—"}
                </td>
                <td className="num">{a.fotos}</td>
                <td>{a.lat && a.lng ? "sí" : "no"}</td>
                <td>
                  <span className={a.activo ? "punto punto-ok" : "punto punto-off"} />
                  {a.activo ? "publicado" : "despublicado"}
                </td>
                <td>
                  <Link className="enlace-accion" href={`/admin/alojamientos/${a.id}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="nav">
        {pagina > 1 && (
          <Link href={`/admin/alojamientos?q=${encodeURIComponent(q)}&p=${pagina - 1}`}>← Anterior</Link>
        )}
        {hasta < total && (
          <Link href={`/admin/alojamientos?q=${encodeURIComponent(q)}&p=${pagina + 1}`}>Siguiente →</Link>
        )}
      </nav>
    </>
  );
}
