import Link from "next/link";
import { requireHost } from "@/lib/auth.server";
import { misAlojamientos } from "@/lib/calendario.server";
import { listarCanales, obtenerTokenExport, CANALES, type Canal } from "@/lib/canales.server";

export const dynamic = "force-dynamic";

/**
 * Integraciones: calendarios externos por iCalendar.
 *
 * Aquí se conectan los canales (Airbnb, Booking, Vrbo y otros) y se entrega a esas plataformas la
 * dirección del calendario de Hestiat. Es el mecanismo que usan de verdad esas plataformas sin
 * contrato de partner: se importa su calendario y se les exporta el nuestro.
 *
 * La interfaz dice lo que es y lo que no: la API oficial de reservas exige un acuerdo que Hestiat
 * no tiene, y eso no se simula. Con iCal se resuelve el problema real —que no se venda dos veces la
 * misma noche— sin fingir nada.
 *
 * Los formularios son POST normales: funcionan sin JavaScript.
 */
const NOMBRES: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
  otro: "Otro calendario",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  ok: "sincronizando bien",
  error: "con error",
  invalid: "dirección no válida",
};

export default async function HostIntegraciones({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; aviso?: string; ok?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;

  const sp = await searchParams;
  const lista = await misAlojamientos(host.id);
  const seleccionado = Number(sp.a) || lista[0]?.id || 0;
  const alojamiento = lista.find((l) => l.id === seleccionado) ?? lista[0];

  const datos = alojamiento ? await listarCanales(host.id, alojamiento.id) : null;
  const canales = datos?.canales ?? [];
  const exportToken = alojamiento ? await obtenerTokenExport(host.id, alojamiento.id) : null;
  const base = process.env.APP_URL?.trim() || "https://hestiat.com";
  const urlExport = exportToken ? `${base}/api/ical/${exportToken.token}` : null;

  return (
    <>
      <header className="admin-cab">
        <h1>Integraciones</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Conecta tus calendarios de Airbnb, Booking y otros para no vender dos veces la misma noche.
        </p>
      </header>

      {sp.aviso && (
        <p className="aviso" style={sp.ok === "0" ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 14 } : { marginBottom: 14 }}>
          {sp.aviso}
        </p>
      )}

      {lista.length === 0 || !alojamiento ? (
        <p className="aviso">
          Todavía no tienes alojamientos. <Link href="/host" style={{ textDecoration: "underline" }}>Vuelve a tu panel</Link>.
        </p>
      ) : (
        <>
          {lista.length > 1 && (
            <form method="get" className="admin-buscar">
              <select name="a" defaultValue={String(alojamiento.id)}>
                {lista.map((l) => (
                  <option key={l.id} value={l.id}>{l.titulo} {l.ciudad ? `· ${l.ciudad}` : ""}</option>
                ))}
              </select>
              <button type="submit" className="f-aplicar">Ver</button>
            </form>
          )}

          <h2 style={{ fontSize: 19, margin: "6px 0 8px" }}>{alojamiento.titulo}</h2>

          {/* --- Exportar: la dirección que se pega en las plataformas --- */}
          <section className="aud-bloque" style={{ marginBottom: 20 }}>
            <div className="aud-cab">
              <h2>Exportar el calendario de Hestiat</h2>
            </div>
            <p className="m" style={{ color: "var(--muted-fg)" }}>
              Pega esta dirección en Airbnb, Booking o Vrbo como «importar calendario». Así esas
              plataformas saben qué noches están ocupadas aquí y dejan de ofrecerlas.
            </p>
            {urlExport ? (
              <p style={{ marginTop: 10 }}>
                <code style={{ display: "block", padding: 10, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", wordBreak: "break-all", fontSize: 13 }}>
                  {urlExport}
                </code>
              </p>
            ) : (
              <p className="aviso">No se ha podido generar la dirección de exportación.</p>
            )}
            <p className="m" style={{ color: "var(--muted-fg)", marginTop: 8 }}>
              Solo entrega fechas ocupadas: ni nombres, ni teléfonos, ni importes.
            </p>
          </section>

          {/* --- Importar: un formulario por canal --- */}
          <h2 style={{ fontSize: 19, margin: "20px 0 10px" }}>Calendarios que importas</h2>
          <ul style={{ listStyle: "none", display: "grid", gap: 12 }}>
            {CANALES.map((canal: Canal) => {
              const c = canales.find((x) => x.canal === canal);
              const conectado = Boolean(c?.conectado);
              return (
                <li key={canal} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius, 10px)", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <strong>{NOMBRES[canal] ?? canal}</strong>
                    <span className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                      {conectado ? (
                        <>
                          <span className={c?.estado === "ok" ? "punto punto-ok" : "punto punto-off"} />
                          {ETIQUETA_ESTADO[c?.estado ?? ""] ?? c?.estado ?? "conectado"}
                          {c?.eventos !== null && c?.eventos !== undefined ? ` · ${c.eventos} ${c.eventos === 1 ? "evento" : "eventos"}` : ""}
                          {c?.caducado ? " · pendiente de actualizar" : ""}
                        </>
                      ) : (
                        "sin conectar"
                      )}
                    </span>
                  </div>

                  {c?.error && (
                    <p className="m" style={{ color: "var(--destructive)", marginTop: 6 }}>{c.error}</p>
                  )}
                  {c?.ultimaSync && (
                    <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12.5, marginTop: 4 }}>
                      Última actualización: {String(c.ultimaSync).replace("T", " ").slice(0, 16)}
                    </p>
                  )}

                  <form action="/api/host/canales" method="post" style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <input type="hidden" name="a" value={alojamiento.id} />
                    <input type="hidden" name="canal" value={canal} />
                    <input
                      type="url"
                      name="url"
                      defaultValue={c?.url ?? ""}
                      placeholder="https://…/calendar.ics"
                      style={{ flex: 1, minWidth: 220, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, font: "inherit", fontSize: 14, background: "var(--background)", color: "var(--ink)" }}
                    />
                    <button className="f-aplicar" type="submit" name="accion" value="conectar">
                      {conectado ? "Guardar y sincronizar" : "Conectar"}
                    </button>
                    {conectado && (
                      <>
                        <button className="f-limpiar" type="submit" name="accion" value="sincronizar">Actualizar</button>
                        <button className="f-limpiar" type="submit" name="accion" value="desconectar">Desconectar</button>
                      </>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>

          <p className="aviso" style={{ marginTop: 20 }}>
            Al desconectar un canal se retiran las noches que había importado <em>ese</em> canal. Las
            reservas hechas en Hestiat y los bloqueos manuales no se tocan nunca.
          </p>
          <p className="aviso" style={{ marginTop: 10 }}>
            Con iCal se sincronizan disponibilidad y fechas. La <strong>API oficial</strong> de Airbnb y
            Booking —tarifas, contenido y reservas en tiempo real— exige un contrato de partner que
            Hestiat no tiene, y aquí no se simula.
          </p>

          <p style={{ marginTop: 16 }}>
            <Link className="f-limpiar" href={`/host/calendario?a=${alojamiento.id}`}>Ver el calendario de este alojamiento</Link>
          </p>
        </>
      )}
    </>
  );
}
