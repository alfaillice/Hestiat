"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SelectorFechas, { iso, nochesEntre } from "@/components/selector-fechas";

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
  // El rango vive en un solo estado y se actualiza de forma funcional: así dos clics seguidos no
  // leen un valor antiguo y el orden entrada/salida se decide siempre sobre el estado real.
  const [rango, setRango] = useState<{ desde: string; hasta: string }>({ desde: "", hasta: "" });
  const desde = rango.desde;
  const hasta = rango.hasta;
  const [huespedes, setHuespedes] = useState(2);
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
              principal fuera de la vista. Se abre al pulsar las fechas.
              Es el MISMO componente que usa el buscador (`SelectorFechas`): una sola lógica de
              entrada, salida, rango, noches y días bloqueados para toda la plataforma. */}
          {tieneFechas && calendario && (
            <SelectorFechas
              desde={desde}
              hasta={hasta}
              bloqueadas={nochesBloqueadas}
              onCambio={(d, h) => setRango({ desde: d, hasta: h })}
            />
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
