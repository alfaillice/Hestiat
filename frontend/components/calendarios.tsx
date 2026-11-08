"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface EstadoCanalVista {
  canal: string;
  conectado: boolean;
  url: string | null;
  ultimaSync: string | null;
  estado: string | null;
  error: string | null;
  eventos: number | null;
  caducado: boolean;
  /** Nombre con el que el anfitrión reconoce el calendario. */
  nombre: string | null;
  /** Sincronización activada o en pausa. */
  activo: boolean;
}

const NOMBRES: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
  vrbo: "Vrbo",
  google: "Google Calendar",
  otro: "Otro canal iCal",
};

const ETIQUETA: Record<string, string> = {
  ok: "correcto",
  error: "con error",
  invalid: "dirección no válida",
};

/**
 * Canales iCal por alojamiento — alta, edición y sincronización.
 *
 * Se dice lo que es de verdad: Airbnb y Booking ofrecen este mecanismo por iCalendar sin
 * contrato de partner, y es el que se usa. La API oficial exige autorización que Hestiat no
 * tiene, y no se simula.
 *
 * Toda la autorización está en el servidor: este componente solo envía la intención.
 */
export default function Calendarios({ alojamientoId, canales }: { alojamientoId: number; canales: EstadoCanalVista[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  async function llamar(
    canal: string,
    accion: "conectar" | "sincronizar" | "desconectar" | "activar" | "desactivar" | "renombrar",
    url?: string,
    nombre?: string,
  ) {
    setOcupado(`${canal}:${accion}`);
    setMensaje(null);
    try {
      const res = await fetch("/api/canales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alojamientoId, canal, accion, url, nombre }),
      });
      const r = (await res.json()) as { ok: boolean; motivo?: string | null; error?: string; eventos?: number; fechas?: number; fechasBorradas?: number };
      if (!r.ok) throw new Error(r.motivo ?? r.error ?? "La operación no se ha podido completar.");
      const nombreCanal = NOMBRES[canal] ?? canal;
      setMensaje({
        tipo: "ok",
        texto:
          accion === "conectar" || accion === "sincronizar"
            ? `${nombreCanal}: ${r.eventos ?? 0} ${(r.eventos ?? 0) === 1 ? "evento" : "eventos"} leídos, ${r.fechas ?? 0} ${(r.fechas ?? 0) === 1 ? "noche" : "noches"} bloqueadas.`
            : accion === "desactivar"
              ? `${nombreCanal}: sincronización en pausa. Las noches ya importadas siguen bloqueadas.`
              : accion === "activar"
                ? `${nombreCanal}: sincronización activada.`
                : accion === "renombrar"
                  ? `${nombreCanal}: nombre guardado.`
                  : `${nombreCanal}: canal desconectado.`,
      });
      if (accion === "conectar") setBorradores((b) => ({ ...b, [canal]: "" }));
      startTransition(() => router.refresh());
    } catch (error) {
      setMensaje({ tipo: "error", texto: error instanceof Error ? error.message : "Error." });
    } finally {
      setOcupado(null);
    }
  }

  const trabajando = ocupado !== null || pendiente;

  return (
    <div className="canales">
      <div className="medios-cab">
        <h2>Calendarios de los canales</h2>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Se importa el calendario .ics público del canal y se exporta el de Hestiat. Una reserva o un
          bloqueo hecho en Hestiat nunca se pisa.
        </p>
      </div>

      {mensaje && (
        <p className="aviso" style={mensaje.tipo === "error" ? { borderColor: "var(--destructive)", color: "var(--destructive)" } : undefined}>
          {mensaje.texto}
        </p>
      )}

      <ul className="canales-lista">
        {canales.map((c) => (
          <li key={c.canal} className="canal">
            <div className="canal-cab">
              <strong>{c.nombre ? `${c.nombre} · ${NOMBRES[c.canal] ?? c.canal}` : (NOMBRES[c.canal] ?? c.canal)}</strong>
              {c.conectado ? (
                <span className="canal-estado">
                  <span className={c.estado === "ok" ? "punto punto-ok" : "punto punto-off"} />
                  {ETIQUETA[c.estado ?? ""] ?? c.estado ?? "conectado"}
                  {c.eventos !== null ? ` · ${c.eventos} ${c.eventos === 1 ? "evento" : "eventos"}` : ""}
                  {c.activo ? "" : " · sincronización en pausa"}
                  {c.activo && c.caducado ? " · pendiente de actualizar" : ""}
                </span>
              ) : (
                <span className="canal-estado" style={{ color: "var(--muted-fg)" }}>
                  sin conectar
                </span>
              )}
            </div>

            {c.error && (
              <p className="m" style={{ color: "var(--destructive)", marginTop: 4 }}>
                {c.error}
              </p>
            )}
            {c.ultimaSync && (
              <p className="m" style={{ color: "var(--muted-fg)", marginTop: 2, fontSize: 12.5 }}>
                Última actualización: {String(c.ultimaSync).replace("T", " ").slice(0, 16)}
              </p>
            )}

            <div className="canal-acciones">
              <input
                type="url"
                placeholder="https://…/calendar.ics"
                value={borradores[c.canal] ?? c.url ?? ""}
                onChange={(e) => setBorradores((b) => ({ ...b, [c.canal]: e.target.value }))}
                disabled={trabajando}
              />
              <button
                type="button"
                className="f-aplicar"
                disabled={trabajando || !(borradores[c.canal] ?? c.url)}
                onClick={() => void llamar(c.canal, "conectar", borradores[c.canal] ?? c.url ?? "")}
              >
                {c.conectado ? "Guardar y sincronizar" : "Conectar"}
              </button>
              {c.conectado && (
                <>
                  <button type="button" className="f-limpiar" disabled={trabajando} onClick={() => void llamar(c.canal, "sincronizar")}>
                    Sincronizar ahora
                  </button>
                  <button
                    type="button"
                    className="f-limpiar"
                    disabled={trabajando}
                    onClick={() => void llamar(c.canal, c.activo ? "desactivar" : "activar")}
                  >
                    {c.activo ? "Pausar sincronización" : "Reanudar sincronización"}
                  </button>
                  <button
                    type="button"
                    className="f-limpiar"
                    disabled={trabajando}
                    onClick={() => {
                      const nuevo = prompt("Nombre para reconocer este calendario:", c.nombre ?? "");
                      if (nuevo !== null) void llamar(c.canal, "renombrar", undefined, nuevo);
                    }}
                  >
                    Editar nombre
                  </button>
                  <button
                    type="button"
                    className="f-limpiar"
                    disabled={trabajando}
                    onClick={() => {
                      if (confirm(`¿Desconectar ${NOMBRES[c.canal] ?? c.canal}? Se quitarán las noches que haya importado ese canal. Las reservas de Hestiat no se tocan.`)) {
                        void llamar(c.canal, "desconectar");
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
