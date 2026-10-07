import { poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Usuarios del backoffice. Lee de la base original: cuentas reales, con su rol y su estado. */
export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rol?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filtros: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (q) {
    filtros.push("(email LIKE ? OR nombre LIKE ? OR apellidos LIKE ?)");
    valores.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (sp.rol) {
    filtros.push("rol = ?");
    valores.push(sp.rol);
  }
  const where = filtros.join(" AND ");

  const [filas] = await poolLegacy.query<any[]>(
    `SELECT u.id, u.email, u.nombre, u.apellidos, u.telefono, u.rol, u.activo, u.creado_en,
            (SELECT COUNT(*) FROM alojamiento_anfitrion af WHERE af.usuario_id = u.id) AS alojamientos
       FROM usuario u WHERE ${where} ORDER BY u.id ASC LIMIT 200`,
    valores,
  );

  return (
    <>
      <header className="admin-cab">
        <h1>Usuarios</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {filas.length} cuentas · el rol se lee de la base, nunca del navegador
        </p>
      </header>

      <form className="admin-buscar" method="get">
        <input name="q" defaultValue={q} placeholder="Buscar por correo o nombre" />
        <select name="rol" defaultValue={sp.rol ?? ""}>
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="anfitrion">Anfitrión</option>
          <option value="huesped">Huésped</option>
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
              <th>Correo</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Alojamientos</th>
              <th>Alta</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((u) => (
              <tr key={u.id}>
                <td className="num">{u.id}</td>
                <td>{u.email}</td>
                <td>{[u.nombre, u.apellidos].filter(Boolean).join(" ") || "—"}</td>
                <td>{u.telefono || "—"}</td>
                <td>{u.rol}</td>
                <td className="num">{u.alojamientos}</td>
                <td>{u.creado_en ? String(u.creado_en).slice(0, 10) : "—"}</td>
                <td>
                  <span className={Number(u.activo) === 1 ? "punto punto-ok" : "punto punto-off"} />
                  {Number(u.activo) === 1 ? "activo" : "desactivado"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
