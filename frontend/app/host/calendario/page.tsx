import Link from "next/link";
import { requireHost } from "@/lib/auth.server";
import { misAlojamientos, nochesDelMes, type EstadoNoche } from "@/lib/calendario.server";

export const dynamic = "force-dynamic";

/**
 * Calendario del anfitrión.
 *
 * Un mes por pantalla, con el estado REAL de cada noche, y bloqueo o liberación en bloque.
 *
 * Decisión de diseño importante: las noches con **reserva** y las que vienen de un **canal iCal**
 * aparecen marcadas y **no se pueden seleccionar**. Una reserva no se libera desde aquí — habría
 * que cancelarla, que es la acción correcta y además deja rastro. Y un bloqueo de iCal volvería a
 * entrar en la siguiente sincronización, así que tocarlo solo generaría confusión.
 *
 * El formulario es un POST normal: funciona sin JavaScript.
 */
const ETIQUETA: Record<EstadoNoche, string> = {
  libre: "Libre",
  reservada: "Reservada",
  bloqueada: "Bloqueada",
  ical: "Canal externo",
  mantenimiento: "Mantenimiento",
};

const PUNTO: Record<EstadoNoche, string> = {
  libre: "punto-ok",
  reservada: "punto",
  bloqueada: "punto-off",
  ical: "punto-off",
  mantenimiento: "punto-off",
};

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

function mesVecino(mes: string, salto: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + salto, 1));
  return d.toISOString().slice(0, 7);
}

function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function HostCalendario({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; mes?: string; aviso?: string; ok?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;

  const sp = await searchParams;
  const lista = await misAlojamientos(host.id);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? (sp.mes as string) : mesActual();
  const seleccionado = Number(sp.a) || lista[0]?.id || 0;
  const alojamiento = lista.find((l) => l.id === seleccionado) ?? lista[0];

  const hoy = new Date().toISOString().slice(0, 10);
  const noches = alojamiento ? await nochesDelMes(alojamiento.id, mes) : [];
  const resumen = {
    libres: noches.filter((n) => n.estado === "libre").length,
    reservadas: noches.filter((n) => n.estado === "reservada").length,
    bloqueadas: noches.filter((n) => n.estado === "bloqueada").length,
    canal: noches.filter((n) => n.estado === "ical").length,
  };

  return (
    <>
      <header className="admin-cab">
        <h1>Calendario</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Estado real de cada noche. Las que tienen reserva o vienen de un canal externo no se pueden
          tocar desde aquí a propósito.
        </p>
      </header>

      {sp.aviso && (
        <p className="aviso" style={sp.ok === "0" ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 14 } : { marginBottom: 14 }}>
          {sp.aviso}
        </p>
      )}

      {lista.length === 0 ? (
        <p className="aviso">
          Todavía no tienes alojamientos. <Link href="/host" style={{ textDecoration: "underline" }}>Vuelve a tu panel</Link> para ver el estado.
        </p>
      ) : (
        <>
          <form method="get" className="admin-buscar">
            <select name="a" defaultValue={String(alojamiento?.id ?? "")}>
              {lista.map((l) => (
                <option key={l.id} value={l.id}>{l.titulo} {l.ciudad ? `· ${l.ciudad}` : ""}</option>
              ))}
            </select>
            <input type="month" name="mes" defaultValue={mes} />
            <button type="submit" className="f-aplicar">Ver</button>
          </form>

          <nav style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <Link className="f-limpiar" href={`/host/calendario?a=${alojamiento?.id ?? ""}&mes=${mesVecino(mes, -1)}`}>← Mes anterior</Link>
            <strong style={{ textTransform: "capitalize" }}>{nombreMes(mes)}</strong>
            <Link className="f-limpiar" href={`/host/calendario?a=${alojamiento?.id ?? ""}&mes=${mesVecino(mes, 1)}`}>Mes siguiente →</Link>
          </nav>

          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 12 }}>
            {resumen.libres} libres · {resumen.bloqueadas} bloqueadas · {resumen.reservadas} reservadas
            {resumen.canal > 0 ? ` · ${resumen.canal} de canal externo` : ""}
          </p>

          <form action="/api/host/calendario" method="post">
            <input type="hidden" name="a" value={alojamiento?.id ?? ""} />
            <input type="hidden" name="mes" value={mes} />

            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Noche</th><th>Estado</th><th style={{ width: 90 }}>Seleccionar</th></tr>
                </thead>
                <tbody>
                  {noches.map((n) => {
                    const protegida = n.estado === "reservada" || n.estado === "ical" || n.fecha < hoy;
                    return (
                      <tr key={n.fecha}>
                        <td className="num">{n.fecha}</td>
                        <td>
                          <span className={`punto ${PUNTO[n.estado]}`} />
                          {ETIQUETA[n.estado]}
                          {n.fecha < hoy && <span style={{ color: "var(--muted-fg)" }}> · pasada</span>}
                          {n.reservaId && <span style={{ color: "var(--muted-fg)" }}> · reserva #{n.reservaId}</span>}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            name="fechas"
                            value={n.fecha}
                            disabled={protegida}
                            aria-label={`Seleccionar ${n.fecha}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="f-acciones" style={{ marginTop: 14 }}>
              <button className="f-aplicar" type="submit" name="accion" value="bloquear">Bloquear las seleccionadas</button>
              <button className="f-limpiar" type="submit" name="accion" value="liberar">Liberar las seleccionadas</button>
            </div>
          </form>

          <p className="aviso" style={{ marginTop: 18 }}>
            Bloquear marca la noche como no disponible. Liberar la vuelve a poner disponible. Ninguna de
            las dos acciones toca una reserva: si necesitas liberar una noche reservada, cancela la reserva
            desde <Link href="/host/reservas" style={{ textDecoration: "underline" }}>Reservas</Link>.
          </p>
        </>
      )}

      <p style={{ marginTop: 16 }}>
        <Link className="f-limpiar" href="/host">← Mis alojamientos</Link>
      </p>
    </>
  );
}
