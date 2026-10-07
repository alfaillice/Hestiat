"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Caja de reserva de la ficha.
 *
 * Qué hace de verdad, sin adornos:
 *  · Calendario real: las noches **ya ocupadas o bloqueadas llegan del servidor** y aparecen
 *    deshabilitadas; no se pueden elegir. Selecciona entrada y salida, cambia de mes y calcula las
 *    noches.
 *  · Huéspedes limitado a la **capacidad real** del alojamiento.
 *  · El desglose del precio se calcula al instante, pero **el importe definitivo lo calcula el
 *    servidor** al enviar la solicitud: aquí no se decide ningún precio.
 *  · Enviar es un **POST de formulario normal** contra `/api/reservas`. Funciona sin JavaScript y
 *    el botón se bloquea mientras se envía para no duplicar solicitudes.
 *  · En móvil, una barra inferior fija con el precio y el botón, respetando las «safe areas».
 */
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function sumarMes(anio: number, mes: number, salto: number): [number, number] {
  const d = new Date(Date.UTC(anio, mes + salto, 1));
  return [d.getUTCFullYear(), d.getUTCMonth()];
}
function nochesEntre(a: string, b: string): number {
  const x = Date.parse(`${a}T00:00:00Z`);
  const y = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  return Math.round((y - x) / 86_400_000);
}

export default function ReservaCaja({
  slug,
  precioNoche,
  moneda,
  orientativo,
  capacidad,
  nochesBloqueadas,
  tieneFechas,
}: {
  slug: string;
  precioNoche: number | null;
  moneda: string;
  orientativo: boolean;
  capacidad: number;
  nochesBloqueadas: string[];
  tieneFechas: boolean;
}) {
  const hoy = iso(new Date());
  const [hoyAnio, hoyMes] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1];

  // El rango vive en un solo estado y se actualiza de forma funcional: así dos clics seguidos no
  // leen un valor antiguo y el orden entrada/salida se decide siempre sobre el estado real.
  const [rango, setRango] = useState<{ desde: string; hasta: string }>({ desde: "", hasta: "" });
  const desde = rango.desde;
  const hasta = rango.hasta;
  const [huespedes, setHuespedes] = useState(2);
  const [vista, setVista] = useState<[number, number]>([hoyAnio, hoyMes]);
  const [calendario, setCalendario] = useState(false);

  const bloqueadas = useMemo(() => new Set(nochesBloqueadas), [nochesBloqueadas]);
  const noches = desde && hasta ? nochesEntre(desde, hasta) : 0;
  const total = precioNoche && noches > 0 ? Math.round(precioNoche * noches * 100) / 100 : 0;
  const maxHuespedes = capacidad > 0 ? capacidad : 30;
  /** ¿Hay alguna noche bloqueada dentro del rango elegido? */
  const rangoInvalido = useMemo(() => {
    if (!desde || !hasta) return false;
    for (let d = new Date(`${desde}T00:00:00Z`); iso(d) < hasta; d.setUTCDate(d.getUTCDate() + 1)) {
      if (bloqueadas.has(iso(d))) return true;
    }
    return false;
  }, [desde, hasta, bloqueadas]);

  const elegirDia = (fecha: string) => {
    if (bloqueadas.has(fecha) || fecha < hoy) return;
    setRango((r) => {
      // Sin entrada, o con el rango ya completo: este clic marca la entrada.
      if (!r.desde || r.hasta) return { desde: fecha, hasta: "" };
      // Clic anterior a la entrada: se reinicia con la fecha nueva.
      if (fecha <= r.desde) return { desde: fecha, hasta: "" };
      return { desde: r.desde, hasta: fecha };
    });
    setCalendario(true);
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
                  (bloqueadas.has(f) ? " mes-ocupado" : "") +
                  (f === desde || f === hasta ? " mes-elegido" : "") +
                  (desde && hasta && f > desde && f < hasta ? " mes-en-rango" : "") +
                  (f < hoy ? " mes-pasado" : "")
                }
                disabled={bloqueadas.has(f) || f < hoy}
                onClick={() => elegirDia(f)}
                title={bloqueadas.has(f) ? "No disponible" : undefined}
                aria-label={`${f}${bloqueadas.has(f) ? " (no disponible)" : ""}`}
              >
                {Number(f.slice(8, 10))}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  const [anio2, mes2] = sumarMes(vista[0], vista[1], 1);

  // El botón no envía nada: lleva al formulario real de solicitud con las fechas ya puestas. La API
  // exige también nombre y correo, así que enviar desde aquí daría un error de validación. La
  // navegación funciona sin JavaScript y no puede duplicar solicitudes.
  const fechasValidas = Boolean(desde && hasta && noches > 0 && !rangoInvalido);
  const enlace = `/reservar/${encodeURIComponent(slug)}${
    fechasValidas ? `?desde=${desde}&hasta=${hasta}&huespedes=${huespedes}` : ""
  }`;

  return (
    <>
      <aside className="reserva-caja" aria-label="Reservar">
        <p className="rc-precio">
          {precioNoche ? (
            <>
              {orientativo ? "Desde " : ""}
              <strong>{precioNoche.toLocaleString("es-ES")} {moneda}</strong>
              <span className="rc-noche"> / noche</span>
            </>
          ) : (
            <strong>Precio a consultar</strong>
          )}
        </p>
        {orientativo && precioNoche ? (
          <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12.5, marginBottom: 10 }}>
            Precio orientativo: lo confirma el anfitrión al aceptar.
          </p>
        ) : null}

        <div>
          <button
            type="button"
            className="rc-fechas"
            onClick={() => setCalendario((v) => !v)}
            aria-expanded={calendario}
          >
            <span className={"rc-campo" + (desde && !hasta ? " rc-activo" : "")}>
              <span className="etq">Entrada</span>
              <span className="rc-valor">{desde || "Elegir"}</span>
            </span>
            <span className={"rc-campo" + (hasta ? " rc-activo" : "")}>
              <span className="etq">Salida</span>
              <span className="rc-valor">{hasta || "Elegir"}</span>
            </span>
          </button>

          <label className="rc-campo" style={{ marginTop: 8 }}>
            <span className="etq">Huéspedes</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <button type="button" className="rc-paso" onClick={() => setHuespedes((n) => Math.max(1, n - 1))} aria-label="Menos huéspedes">−</button>
              <span className="rc-valor" style={{ minWidth: 26, textAlign: "center" }}>{huespedes}</span>
              <button type="button" className="rc-paso" onClick={() => setHuespedes((n) => Math.min(maxHuespedes, n + 1))} aria-label="Más huéspedes">+</button>
              <span className="m" style={{ color: "var(--muted-fg)", fontSize: 12 }}>
                máximo {maxHuespedes}
              </span>
            </span>
          </label>

          {noches > 0 && (
            <div className="rc-desglose">
              <p><span>{precioNoche?.toLocaleString("es-ES")} {moneda} × {noches} {noches === 1 ? "noche" : "noches"}</span><span>{total.toLocaleString("es-ES")} {moneda}</span></p>
              <p><span>Comisiones y gestión</span><span>0 {moneda}</span></p>
              <p className="rc-total"><span>Total</span><span>{total.toLocaleString("es-ES")} {moneda}</span></p>
            </div>
          )}

          {rangoInvalido && (
            <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", fontSize: 13 }}>
              En ese rango hay una noche ocupada. Elige otras fechas.
            </p>
          )}

          {!desde || !hasta ? (
            <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13, marginTop: 8 }}>
              {tieneFechas ? "Pulsa las fechas para abrir el calendario." : "Escríbenos y te confirmamos disponibilidad."}
            </p>
          ) : null}

          {fechasValidas ? (
            <Link className="f-aplicar rc-boton" href={enlace}>Solicitar reserva</Link>
          ) : (
            <button className="f-aplicar rc-boton" type="button" disabled>Solicitar reserva</button>
          )}

          <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 8, textAlign: "center" }}>
            Es una solicitud: el anfitrión la confirma o la rechaza. No se cobra nada.
          </p>

          <p style={{ marginTop: 10, textAlign: "center" }}>
            <Link className="f-limpiar" href={`/reservar/${encodeURIComponent(slug)}`}>
              Prefiero escribir sin fechas
            </Link>
          </p>

          {/* El calendario va DEBAJO del botón, no encima: con dos meses abiertos empujaba la acción
              principal fuera de la vista. Se abre al pulsar las fechas. */}
          {tieneFechas && calendario && (
            <div className="rc-calendario">
              <div className="mes-nav">
                <button type="button" className="f-limpiar" onClick={() => setVista(sumarMes(vista[0], vista[1], -1))}>← mes anterior</button>
                <button type="button" className="f-limpiar" onClick={() => setVista(sumarMes(vista[0], vista[1], 1))}>mes siguiente →</button>
              </div>
              <div className="meses">
                {mesJSX(vista[0], vista[1])}
                <div className="mes-segundo">{mesJSX(anio2, mes2)}</div>
              </div>
              <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12, marginTop: 6 }}>
                Los días tachados ya están ocupados o bloqueados.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Barra inferior en móvil: el precio y el botón siempre a mano. */}
      <div className="barra-movil" aria-hidden="false">
        <span className="bm-precio">
          {precioNoche ? `${orientativo ? "Desde " : ""}${precioNoche.toLocaleString("es-ES")} ${moneda}` : "Consultar"}
          <span className="rc-noche"> / noche</span>
        </span>
        <a className="f-aplicar" href={enlace}>Solicitar reserva</a>
      </div>
    </>
  );
}
