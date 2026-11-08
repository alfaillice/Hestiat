import Link from "next/link";
import { Aviso, Vacio } from "@/components/estados";
import { requireHost } from "@/lib/auth.server";
import { reservasDeAnfitrion } from "@/lib/reservas.server";

export const dynamic = "force-dynamic";

/**
 * Reservas del anfitrión.
 *
 * Confirmar o rechazar cambia el estado de verdad en la base y, al cancelar o rechazar, **libera las
 * noches** para que vuelvan a estar disponibles. La comprobación de propiedad se hace en servidor.
 */
const ETIQUETA: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada",
  rechazada: "Rechazada", completada: "Completada", no_show: "No presentado",
};

export default async function HostReservas({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; ok?: string; estado?: string; desde?: string; hasta?: string; q?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;

  const sp = await searchParams;
  const filtros = {
    estado: sp.estado && ETIQUETA[sp.estado] ? sp.estado : undefined,
    desde: sp.desde,
    hasta: sp.hasta,
    q: sp.q,
  };
  const filas = await reservasDeAnfitrion(host.id, filtros);
  const pendientes = filas.filter((r) => r.estado === "pendiente").length;

  return (
    <>
      <header className="admin-cab">
        <h1>Reservas</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {filas.length} {filas.length === 1 ? "reserva" : "reservas"}
          {pendientes > 0 ? ` · ${pendientes} sin responder` : ""} · Hestiat no cobra comisiones: el total es
          noches × precio por noche
        </p>
      </header>

      <Aviso texto={sp.aviso} ok={sp.ok} />

      <form method="get" className="admin-buscar" style={{ flexWrap: "wrap" }}>
        <select name="estado" defaultValue={sp.estado ?? ""}>
          <option value="">Todas</option>
          {Object.entries(ETIQUETA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          Entrada desde
          <input type="date" name="desde" defaultValue={sp.desde ?? ""} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          hasta
          <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
        </label>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Huésped, correo o código" />
        <button type="submit" className="f-aplicar">Buscar</button>
        {(sp.estado || sp.desde || sp.hasta || sp.q) && <a className="f-limpiar" href="/host/reservas">Quitar filtros</a>}
      </form>

      {filas.length === 0 ? (
        <p className="aviso">
          Todavía no hay reservas{filtros.estado ? " con ese estado" : ""}. Cuando alguien solicite fechas en uno
          de tus alojamientos aparecerá aquí, y podrás confirmarla o rechazarla.
        </p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th><th>Alojamiento</th><th>Huésped</th><th>Fechas</th>
                <th>Noches</th><th>Total</th><th>Estado</th><th />
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.codigo ?? `#${r.id}`}</td>
                  <td>{r.alojamientoTitulo.slice(0, 30)}</td>
                  <td>
                    {r.huespedNombre}
                    <br />
                    <span style={{ color: "var(--muted-fg)", fontSize: 12.5 }}>{r.huespedEmail}</span>
                  </td>
                  <td>{r.llegada} → {r.salida}</td>
                  <td className="num">{r.noches}</td>
                  <td className="num">{r.total.toLocaleString("es-ES")} {r.moneda}</td>
                  <td>
                    <span className={r.estado === "confirmada" ? "punto punto-ok" : r.estado === "pendiente" ? "punto punto-off" : "punto"} />
                    {ETIQUETA[r.estado] ?? r.estado}
                  </td>
                  <td>
                    {r.estado === "pendiente" && (
                      <span style={{ display: "flex", gap: 6 }}>
                        <form action="/api/host/reservas" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="estado" value="confirmada" />
                          <button className="f-aplicar" type="submit" style={{ padding: "6px 12px" }}>Confirmar</button>
                        </form>
                        <form action="/api/host/reservas" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="estado" value="rechazada" />
                          <button className="f-limpiar" type="submit" style={{ padding: "6px 12px" }}>Rechazar</button>
                        </form>
                      </span>
                    )}
                    {r.estado === "confirmada" && (
                      <span style={{ display: "flex", gap: 6 }}>
                        <form action="/api/host/reservas" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="estado" value="completada" />
                          <button className="f-limpiar" type="submit" style={{ padding: "6px 12px" }}>Completada</button>
                        </form>
                        <form action="/api/host/reservas" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="estado" value="cancelada" />
                          <button className="f-limpiar" type="submit" style={{ padding: "6px 12px" }}>Cancelar</button>
                        </form>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="aviso" style={{ marginTop: 18 }}>
        Al <strong>rechazar</strong> o <strong>cancelar</strong> una reserva se liberan automáticamente sus
        noches, para que vuelvan a estar disponibles. Confirmar no borra nada: solo cambia el estado.
      </p>

      <p style={{ marginTop: 14 }}>
        <Link className="f-limpiar" href="/host">← Mis alojamientos</Link>
      </p>
    </>
  );
}
