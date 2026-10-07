import Link from "next/link";
import { listarReclamas } from "@/lib/reclama.server";


export const dynamic = "force-dynamic";

/**
 * Reclamaciones pendientes (plan A).
 *
 * Aprobar vincula el alojamiento a la cuenta cuyo correo coincide con el de la solicitud y retira
 * su marca de huérfano. Si no existe esa cuenta, NO se inventa: se avisa y no se cambia nada.
 *
 * Toda la autorización es de servidor, y la acción la vuelve a comprobar: una server action es un
 * endpoint público.
 */
export default async function AdminReclamaciones({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const pendientes = await listarReclamas("pendiente");

  return (
    <>
      <header className="admin-cab">
        <h1>Reclamaciones de propiedad</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {pendientes.length} {pendientes.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"} ·
          aprobar vincula el alojamiento a la cuenta de ese correo y retira la marca de huérfano
        </p>
      </header>

      {sp.aviso && (
        <p className="aviso" style={sp.ok === "0" ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 } : { marginBottom: 16 }}>
          {sp.aviso}
        </p>
      )}

      {pendientes.length === 0 ? (
        <p className="aviso">
          No hay reclamaciones pendientes. Los alojamientos sin propietario se pueden reclamar desde{" "}
          <Link href="/reclamar" style={{ textDecoration: "underline" }}>
            /reclamar
          </Link>
          .
        </p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>Alojamiento</th>
                <th>Solicitante</th>
                <th>Contacto</th>
                <th>Motivo</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendientes.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.id}</td>
                  <td>
                    #{r.alojamiento_id}
                    <br />
                    <span style={{ color: "var(--muted-fg)" }}>{String((r as any).titulo ?? "—").slice(0, 40)}</span>
                  </td>
                  <td>{r.nombre}</td>
                  <td>
                    {r.email}
                    {r.telefono ? (
                      <>
                        <br />
                        <span style={{ color: "var(--muted-fg)" }}>{r.telefono}</span>
                      </>
                    ) : null}
                  </td>
                  <td style={{ maxWidth: 260 }}>{String(r.mensaje ?? "—").slice(0, 140)}</td>
                  <td>{String(r.creado_en).slice(0, 10)}</td>
                  <td>
                    <span style={{ display: "flex", gap: 6 }}>
                      <form action="/api/admin/reclamaciones" method="post">
                        <input type="hidden" name="accion" value="aprobar" />
                        <input type="hidden" name="id" value={r.id} />
                        <button className="f-aplicar" type="submit" style={{ padding: "6px 12px" }}>
                          Aprobar
                        </button>
                      </form>
                      <form action="/api/admin/reclamaciones" method="post">
                        <input type="hidden" name="accion" value="rechazar" />
                        <input type="hidden" name="id" value={r.id} />
                        <button className="f-limpiar" type="submit" style={{ padding: "6px 12px" }}>
                          Rechazar
                        </button>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="aviso" style={{ marginTop: 20 }}>
        Ninguna aprobación borra datos: solo añade el vínculo en <code>alojamiento_anfitrion</code> y
        retira la marca de huérfano de ese alojamiento concreto. Rechazar deja constancia sin cambiar nada más.
      </p>

      <p style={{ marginTop: 16 }}>
        <Link className="f-limpiar" href="/admin">
          ← Volver al resumen
        </Link>
      </p>
    </>
  );
}
