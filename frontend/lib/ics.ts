/**
 * iCalendar (ICS) — lógica pura, sin base de datos ni red.
 *
 * Vive aparte de `api/canales.server.ts` a propósito: así se puede probar sin MySQL y el
 * módulo de servidor se queda con lo que sí necesita infraestructura (descarga, guardado).
 */

export const CANALES = ["airbnb", "booking", "vrbo", "google", "otro"] as const;
export type Canal = (typeof CANALES)[number];

export const MAX_EVENTOS = 1000;
export const MAX_DIAS_POR_EVENTO = 400;
export const MAX_DESCARGA_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 12_000;
/** Un canal se considera caducado (y se resincroniza) pasados estos minutos. */
export const MINUTOS_CADUCIDAD = 45;

/* ------------------------------------------------------------- validar URL --- */

export type Validacion = { ok: true } | { ok: false; motivo: string; tipo: "invalid" | "error" };

/** Validación de la URL antes de guardarla: formato, protocolo y host. */
export function validarUrlIcs(url: string): Validacion {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, tipo: "invalid", motivo: "La dirección no es una URL válida." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, tipo: "invalid", motivo: "La URL debe empezar por https:// (recomendado) o http://." };
  }
  if (!parsed.hostname.includes(".")) return { ok: false, tipo: "invalid", motivo: "El dominio de la URL no parece válido." };
  if (parsed.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
    return { ok: false, tipo: "invalid", motivo: "No se aceptan direcciones locales ni IP directas: usa la URL pública del calendario." };
  }
  const soloHost = (parsed.hostname + parsed.pathname).toLowerCase();
  if (!/(\.ics|ical|icalendar|calendar|cal\.)/.test(soloHost)) {
    return {
      ok: false,
      tipo: "invalid",
      motivo: "Esa dirección no parece un calendario iCal. Debe terminar en .ics o ser una URL de calendario del canal.",
    };
  }
  return { ok: true };
}

/* ---------------------------------------------------------------- parser ICS --- */

export type EventoIcs = { uid: string | null; desde: string; hasta: string; titulo: string | null };

const aIso = (valor: string): string | null => {
  const limpio = valor.trim().split("T")[0]?.replace(/[^0-9]/g, "") ?? "";
  if (limpio.length !== 8) return null;
  const y = limpio.slice(0, 4);
  const m = limpio.slice(4, 6);
  const d = limpio.slice(6, 8);
  const fecha = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  return `${y}-${m}-${d}`;
};

export const sumarDias = (isoFecha: string, dias: number): string => {
  const f = new Date(`${isoFecha}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
};

/**
 * Parser de VEVENT. Admite `DTSTART;VALUE=DATE` (todo el día) y `DTSTART:…T…Z`
 * (con hora). Un evento [inicio, fin) bloquea las **noches** de ese intervalo, que es
 * justo lo que reserva el huésped: del 10 al 13 bloquea 10, 11 y 12.
 */
export function parsearIcs(texto: string): EventoIcs[] {
  const lineas = texto.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const eventos: EventoIcs[] = [];
  // `todoElDia` se captura en la línea DTSTART: en END:VEVENT ya no hay contexto.
  let actual: { uid: string | null; desde: string | null; hasta: string | null; titulo: string | null; todoElDia: boolean } | null = null;

  for (const linea of lineas) {
    const [claveCruda, ...resto] = linea.split(":");
    if (resto.length === 0) continue;
    const valor = resto.join(":");
    const clave = (claveCruda ?? "").toUpperCase();
    const nombre = clave.split(";")[0] ?? "";
    const esTodoElDia = /VALUE=DATE(?!-TIME)/i.test(clave);

    if (nombre === "BEGIN" && valor.trim().toUpperCase() === "VEVENT") {
      actual = { uid: null, desde: null, hasta: null, titulo: null, todoElDia: false };
      continue;
    }
    if (nombre === "END" && valor.trim().toUpperCase() === "VEVENT") {
      if (actual?.desde) {
        const hasta = actual.hasta;
        // Todo el día: DTEND es exclusivo. Con hora: se bloquean las noches del rango.
        const fin = hasta ? (actual.todoElDia ? sumarDias(hasta, -1) : hasta) : actual.desde;
        eventos.push({
          uid: actual.uid,
          desde: actual.desde,
          hasta: fin < actual.desde ? actual.desde : fin,
          titulo: actual.titulo,
        });
      }
      actual = null;
      continue;
    }
    if (!actual) continue;

    if (nombre === "DTSTART") {
      actual.desde = aIso(valor);
      actual.todoElDia = esTodoElDia;
    } else if (nombre === "DTEND") actual.hasta = aIso(valor);
    else if (nombre === "UID") actual.uid = valor.trim().slice(0, 191);
    else if (nombre === "SUMMARY") actual.titulo = valor.trim().slice(0, 120);
  }

  return eventos.slice(0, MAX_EVENTOS);
}

/** Noches (fechas ISO) que bloquea un evento, con el tope de seguridad. */
export function nochesDeEvento(ev: EventoIcs): string[] {
  let fin = ev.hasta;
  const dias = Math.round((new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${ev.desde}T00:00:00Z`).getTime()) / 86_400_000);
  if (dias > MAX_DIAS_POR_EVENTO) fin = sumarDias(ev.desde, MAX_DIAS_POR_EVENTO);
  const noches: string[] = [];
  for (let f = ev.desde; f <= fin; f = sumarDias(f, 1)) noches.push(f);
  return noches;
}
