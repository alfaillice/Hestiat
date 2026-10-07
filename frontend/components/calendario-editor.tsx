"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Calendario de disponibilidad del editor.
 *
 * Es una vista REAL, no decorativa: cada noche llega del servidor con su origen (reserva de
 * Hestiat, bloqueo manual, calendario externo o libre) y la leyenda explica qué significa cada
 * color. Desde aquí se bloquean y se liberan noches.
 *
 * Dos reglas que se ven en la propia interfaz, porque son las de verdad:
 *  · Una noche con reserva NO se puede tocar: aparece como reservada y sin marca seleccionable.
 *  · Una noche importada de un calendario externo se libera desconectando ese canal, no aquí.
 */
type EstadoNoche = "libre" | "reservada" | "bloqueada" | "ical" | "mantenimiento";

interface Noche {
  fecha: string;
  estado: EstadoNoche;
  motivo?: string | null;
}

const ETIQUETA: Record<EstadoNoche, string> = {
  libre: "Libre",
  reservada: "Reserva de Hestiat",
  bloqueada: "Bloqueada a mano",
  ical: "Calendario externo",
  mantenimiento: "Mantenimiento",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function mesActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function moverMes(mes: string, salto: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + salto, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarioEditor({ alojamientoId }: { alojamientoId: number }) {
  const [mes, setMes] = useState(mesActual());
  const [noches, setNoches] = useState<Noche[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/alojamientos/${alojamientoId}/disponibilidad?mes=${mes}`, { headers: { accept: "application/json" } });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error ?? "No se ha podido leer el calendario.");
      setNoches(d.noches as Noche[]);
      setMensaje(null);
    } catch (error) {
      setNoches([]);
      setMensaje({ tipo: "error", texto: error instanceof Error ? error.message : "Error al leer el calendario." });
    } finally {
      setCargando(false);
    }
  }, [alojamientoId, mes]);

  useEffect(() => {
    void cargar();
    setSeleccion(new Set());
  }, [cargar]);

  /** Solo se pueden seleccionar las noches que el anfitrión puede gobernar. */
  const gobernable = (n: Noche) => n.estado === "libre" || n.estado === "bloqueada";

  const alternar = (n: Noche) => {
    if (!gobernable(n)) return;
    setSeleccion((s) => {
      const c = new Set(s);
      if (c.has(n.fecha)) c.delete(n.fecha);
      else c.add(n.fecha);
      return c;
    });
  };

  async function aplicar(accion: "bloquear" | "liberar") {
    if (seleccion.size === 0) return;
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await fetch(`/api/alojamientos/${alojamientoId}/disponibilidad`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion, fechas: [...seleccion] }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error ?? "No se ha podido aplicar el cambio.");
      const omitidas = Number(d.omitidas ?? 0);
      setMensaje({
        tipo: "ok",
        texto: `${accion === "bloquear" ? "Bloqueadas" : "Liberadas"} ${d.hechas} ${d.hechas === 1 ? "noche" : "noches"}.${
          omitidas > 0
            ? ` ${omitidas} ${omitidas === 1 ? "noche no se ha tocado" : "noches no se han tocado"} (tienen reserva o vienen de un calendario externo).`
            : ""
        }`,
      });
      setSeleccion(new Set());
      await cargar();
    } catch (error) {
      setMensaje({ tipo: "error", texto: error instanceof Error ? error.message : "Error al guardar." });
    } finally {
      setOcupado(false);
    }
  }

  const [anio, mesNum] = mes.split("-").map(Number);
  const primerDia = new Date(Date.UTC(anio, mesNum - 1, 1));
  const huecos: (Noche | null)[] = Array((primerDia.getUTCDay() + 6) % 7).fill(null);
  for (const n of noches) huecos.push(n);

  return (
    <div className="caldisp">
      <div className="caldisp-cab">
        <button className="f-limpiar" type="button" onClick={() => setMes(moverMes(mes, -1))}>← mes anterior</button>
        <strong>{MESES[mesNum - 1]} {anio}</strong>
        <button className="f-limpiar" type="button" onClick={() => setMes(moverMes(mes, 1))}>mes siguiente →</button>
      </div>

      {mensaje && (
        <p className="aviso" role="status" style={mensaje.tipo === "error" ? { borderColor: "var(--destructive)", color: "var(--destructive)" } : { borderColor: "var(--primary)" }}>
          {mensaje.texto}
        </p>
      )}

      <div className="caldisp-rejilla">
        {DIAS.map((d) => <span key={d} className="mes-dia-semana">{d}</span>)}
        {huecos.map((n, i) =>
          n === null ? (
            <span key={`h${i}`} />
          ) : (
            <button
              key={n.fecha}
              type="button"
              className={`caldisp-dia caldisp-${n.estado}` + (seleccion.has(n.fecha) ? " caldisp-sel" : "")}
              disabled={!gobernable(n)}
              aria-pressed={seleccion.has(n.fecha)}
              title={`${n.fecha} · ${ETIQUETA[n.estado]}${n.motivo ? ` (${n.motivo})` : ""}`}
              onClick={() => alternar(n)}
            >
              {Number(n.fecha.slice(8, 10))}
            </button>
          ),
        )}
      </div>

      <p className="leyenda caldisp-leyenda">
        {(["libre", "reservada", "bloqueada", "ical"] as EstadoNoche[]).map((e) => (
          <span key={e}><i className={`caldisp-muestra caldisp-${e}`} aria-hidden="true" /> {ETIQUETA[e]}</span>
        ))}
      </p>

      <div className="caldisp-acciones">
        <span className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          {seleccion.size === 0 ? "Selecciona noches en el calendario." : `${seleccion.size} ${seleccion.size === 1 ? "noche seleccionada" : "noches seleccionadas"}.`}
        </span>
        <button className="f-aplicar" type="button" disabled={ocupado || seleccion.size === 0} onClick={() => void aplicar("bloquear")}>
          Bloquear
        </button>
        <button className="f-limpiar" type="button" disabled={ocupado || seleccion.size === 0} onClick={() => void aplicar("liberar")}>
          Liberar
        </button>
        {seleccion.size > 0 && (
          <button className="f-limpiar" type="button" onClick={() => setSeleccion(new Set())}>Quitar selección</button>
        )}
        {cargando && <span className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>Cargando…</span>}
      </div>
    </div>
  );
}
