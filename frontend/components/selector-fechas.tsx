"use client";

import { useMemo, useState } from "react";

/**
 * Selector de fechas de rango: UN solo calendario para toda Hestiat.
 *
 * Este componente es el calendario que ya usaba la ficha de alojamiento, movido aquí tal cual para
 * que la ficha y el buscador compartan exactamente la misma lógica. No hay un segundo sistema de
 * fechas: la selección en dos pasos (primero entrada, después salida), el orden, las noches, el
 * rango pintado y los días deshabilitados se deciden en este único sitio.
 *
 * Qué hace:
 *  · Primer clic  → fecha de ENTRADA. Segundo clic → fecha de SALIDA (si es anterior o igual, se
 *    reinicia con la nueva entrada, como en la ficha).
 *  · Todo el intervalo se ve: entrada y salida resaltadas y los días de enmedio marcados.
 *  · Los días pasados no se pueden elegir.
 *  · Si se le pasan noches bloqueadas (la ficha sí las tiene, del servidor), se deshabilitan.
 *
 * El componente pinta SOLO el calendario. Cada sitio pone su propio disparador encima: la ficha
 * mantiene sus campos «Entrada / Salida» y el buscador usa «Fechas · 10 oct → 15 oct».
 */
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarMes(anio: number, mes: number, salto: number): [number, number] {
  const d = new Date(Date.UTC(anio, mes + salto, 1));
  return [d.getUTCFullYear(), d.getUTCMonth()];
}

export function nochesEntre(a: string, b: string): number {
  const x = Date.parse(`${a}T00:00:00Z`);
  const y = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  return Math.round((y - x) / 86_400_000);
}

/** «10 oct» — corto, para el disparador del buscador. */
export function fechaCorta(f: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return "";
  const mes = MESES[Number(f.slice(5, 7)) - 1] ?? "";
  return `${Number(f.slice(8, 10))} ${mes.slice(0, 3)}`;
}

export default function SelectorFechas({
  desde,
  hasta,
  onCambio,
  bloqueadas = [],
  meses = 2,
}: {
  desde: string;
  hasta: string;
  /** Se llama con el rango completo: (entrada, salida). La salida puede ir vacía. */
  onCambio: (desde: string, hasta: string) => void;
  /** Noches que no se pueden elegir (las que llegan del servidor en la ficha). */
  bloqueadas?: string[];
  /** Cuántos meses se ven a la vez. */
  meses?: number;
}) {
  const hoy = iso(new Date());
  const [vista, setVista] = useState<[number, number]>([Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1]);
  const bloqueo = useMemo(() => new Set(bloqueadas), [bloqueadas]);

  const elegir = (fecha: string) => {
    if (bloqueo.has(fecha) || fecha < hoy) return;
    // Sin entrada, o con el rango ya completo: este clic marca la entrada.
    if (!desde || hasta) return onCambio(fecha, "");
    // Clic anterior o igual a la entrada: se reinicia con la fecha nueva.
    if (fecha <= desde) return onCambio(fecha, "");
    return onCambio(desde, fecha);
  };

  function mesJSX(anio: number, mes: number) {
    const primero = new Date(Date.UTC(anio, mes, 1));
    const desplazamiento = (primero.getUTCDay() + 6) % 7; // la semana empieza en lunes
    const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    const celdas: (string | null)[] = Array(desplazamiento).fill(null);
    for (let d = 1; d <= dias; d += 1) celdas.push(iso(new Date(Date.UTC(anio, mes, d))));

    return (
      <div className="mes" key={`${anio}-${mes}`}>
        <p className="mes-titulo">{MESES[mes]} {anio}</p>
        <div className="mes-grid">
          {DIAS.map((d) => <span key={d} className="mes-dia-semana">{d}</span>)}
          {celdas.map((f, i) =>
            f === null ? (
              <span key={`v${i}`} />
            ) : (
              <button
                key={f}
                type="button"
                className={
                  "mes-dia" +
                  (bloqueo.has(f) ? " mes-ocupado" : "") +
                  (f === desde || f === hasta ? " mes-elegido" : "") +
                  (desde && hasta && f > desde && f < hasta ? " mes-en-rango" : "") +
                  (f < hoy ? " mes-pasado" : "")
                }
                disabled={bloqueo.has(f) || f < hoy}
                onClick={() => elegir(f)}
                title={bloqueo.has(f) ? "No disponible" : undefined}
                aria-label={`${f}${bloqueo.has(f) ? " (no disponible)" : ""}`}
              >
                {Number(f.slice(8, 10))}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  const mesesJSX = [mesJSX(vista[0], vista[1])];
  for (let i = 1; i < meses; i += 1) {
    const [a, m] = sumarMes(vista[0], vista[1], i);
    mesesJSX.push(
      <div className="mes-segundo" key={`s${i}`}>
        {mesJSX(a, m)}
      </div>,
    );
  }

  return (
    <div className="rc-calendario">
      <div className="mes-nav">
        <button type="button" className="f-limpiar" onClick={() => setVista(sumarMes(vista[0], vista[1], -1))}>
          ← mes anterior
        </button>
        <button type="button" className="f-limpiar" onClick={() => setVista(sumarMes(vista[0], vista[1], 1))}>
          mes siguiente →
        </button>
      </div>
      <div className="meses">{mesesJSX}</div>
      <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 6 }}>
        {bloqueadas.length > 0
          ? "Los días tachados ya están ocupados o bloqueados."
          : "Elige la entrada y, después, la salida."}
      </p>
    </div>
  );
}
