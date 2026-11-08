/**
 * Correos de reserva — SOLO servidor.
 *
 * Qué hace y por qué así:
 *
 *  · Un solo sitio. Todas las notificaciones de reserva salen de aquí, tanto la creación como los
 *    cambios de estado. Si cada ruta escribiera su propio correo, acabarían discrepando.
 *
 *  · Nada de correos inventados. Cada dato sale de la base: si un alojamiento no tiene anfitrión
 *    (y hoy 27.356 no lo tienen), no se manda correo al anfitrión ni se finge un destinatario; se
 *    dice en la copia interna. Si falta el correo del huésped, no se manda.
 *
 *  · Reply-To de verdad. Al anfitrión se le pone el correo del huésped para que pueda responderle.
 *    Al huésped se le pone el del anfitrión si lo tiene; si no, hola@hestiat.com. Nunca una
 *    dirección inexistente.
 *
 *  · El asunto dice el estado REAL. La reserva nace «pendiente» porque la aprueba el anfitrión, así
 *    que al huésped no se le escribe «confirmada» hasta que de verdad lo esté. Decirle lo contrario
 *    sería mentirle.
 *
 *  · Un fallo de correo no puede tumbar una reserva. Estas funciones no lanzan nunca: devuelven qué
 *    se envió y qué no, y quien llama decide (aquí se registra, sin credenciales).
 */
import { poolLegacy } from "@/lib/db";
import { enviarCorreo } from "@/lib/correo.server";

/** Buzón interno de Hestiat. Es una dirección real y en uso. */
export const CORREO_HESTIAT = "hola@hestiat.com";

const URL_BASE = (process.env.APP_URL ?? "https://hestiat.com").replace(/\/+$/, "");

/* --------------------------------------------------------------- datos -- */

export interface DatosReserva {
  id: number;
  codigo: string;
  estado: string;
  huespedNombre: string;
  huespedEmail: string;
  huespedTel: string | null;
  llegada: string;
  salida: string;
  huespedes: number;
  noches: number;
  total: number;
  moneda: string;
  notas: string | null;
  alojamientoId: number;
  alojamientoTitulo: string;
  alojamientoSlug: string | null;
  alojamientoCiudad: string | null;
  alojamientoProvincia: string | null;
  precioOrientativo: boolean;
  anfitrionNombre: string | null;
  anfitrionEmail: string | null;
}

function aFecha(iso: unknown): string {
  return String(iso ?? "").slice(0, 10);
}

/**
 * Los datos de una reserva, tal y como están en la base. Se usa el correo REAL del anfitrión
 * (la relación de propiedad), nunca uno copiado dentro del alojamiento.
 */
export async function datosDeReserva(id: number): Promise<DatosReserva | null> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT r.id, r.codigo, r.estado, r.huesped_nombre, r.huesped_email, r.huesped_tel,
            r.llegada, r.salida, r.huespedes, r.noches, r.total, r.moneda, r.notas,
            a.id AS alojamiento_id, a.titulo, a.slug, a.ciudad, a.provincia,
            COALESCE(a.precio_orientativo, 0) AS precio_orientativo,
            u.nombre AS anfitrion_nombre, u.email AS anfitrion_email
       FROM reserva r
       LEFT JOIN alojamiento a ON a.id = r.alojamiento_id
       LEFT JOIN alojamiento_anfitrion af ON af.alojamiento_id = r.alojamiento_id
       LEFT JOIN usuario u ON u.id = af.usuario_id
      WHERE r.id = ? LIMIT 1`,
    [id],
  );
  const f = filas[0];
  if (!f) return null;
  return {
    id: Number(f.id),
    codigo: String(f.codigo ?? ""),
    estado: String(f.estado ?? "pendiente"),
    huespedNombre: String(f.huesped_nombre ?? ""),
    huespedEmail: String(f.huesped_email ?? "").trim().toLowerCase(),
    huespedTel: f.huesped_tel ? String(f.huesped_tel) : null,
    llegada: aFecha(f.llegada),
    salida: aFecha(f.salida),
    huespedes: Number(f.huespedes ?? 1),
    noches: Number(f.noches ?? 0),
    total: Number(f.total ?? 0),
    moneda: String(f.moneda ?? "EUR"),
    notas: f.notas ? String(f.notas) : null,
    alojamientoId: Number(f.alojamiento_id ?? 0),
    alojamientoTitulo: String(f.titulo ?? "(alojamiento eliminado)"),
    alojamientoSlug: f.slug ? String(f.slug) : null,
    alojamientoCiudad: f.ciudad ? String(f.ciudad) : null,
    alojamientoProvincia: f.provincia ? String(f.provincia) : null,
    precioOrientativo: Number(f.precio_orientativo ?? 0) === 1,
    anfitrionNombre: f.anfitrion_nombre ? String(f.anfitrion_nombre) : null,
    anfitrionEmail: f.anfitrion_email ? String(f.anfitrion_email).trim().toLowerCase() : null,
  };
}

/* ------------------------------------------------------------ formato -- */

function euros(total: number, moneda: string): string {
  const simbolo = moneda === "EUR" ? "\u20ac" : ` ${moneda}`;
  const n = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(total);
  return moneda === "EUR" ? `${n} ${simbolo}` : `${n}${simbolo}`;
}

function fechaLarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  const texto = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function estadoLegible(estado: string): string {
  switch (estado) {
    case "pendiente": return "Pendiente de confirmación por el anfitrión";
    case "confirmada": return "Confirmada";
    case "cancelada": return "Cancelada";
    case "rechazada": return "No confirmada por el anfitrión";
    case "completada": return "Completada";
    default: return estado;
  }
}

/** Ubicación según las reglas de privacidad: ciudad y provincia, nunca la dirección exacta. */
function ubicacion(d: DatosReserva): string {
  const partes = [d.alojamientoCiudad, d.alojamientoProvincia].filter(Boolean);
  return partes.length > 0 ? partes.join(", ") : "España";
}

interface Bloque {
  /** Título del correo. */
  cabecera: string;
  /** Primera línea, en grande. */
  entrada: string;
  /** Filas etiqueta → valor, en el orden en que se leen. */
  filas: [string, string][];
  /** Párrafos de texto corrido, después de las filas. */
  parrafos?: string[];
  /** Botón opcional. */
  boton?: { texto: string; url: string };
  /** Cierre pequeño. */
  pie?: string;
}

function textoPlano(b: Bloque): string {
  const lineas: string[] = [b.entrada, ""];
  for (const [etiqueta, valor] of b.filas) lineas.push(`${etiqueta}: ${valor}`);
  for (const p of b.parrafos ?? []) lineas.push("", p);
  if (b.boton) lineas.push("", `${b.boton.texto}: ${b.boton.url}`);
  if (b.pie) lineas.push("", b.pie);
  lineas.push("", "Hestiat — https://hestiat.com");
  return lineas.join("\n");
}

/**
 * Un HTML sobrio y legible en cualquier cliente: tablas y estilos en línea, sin tipografías
 * externas ni imágenes que puedan quedar bloqueadas. Los colores son los de la marca.
 */
function html(b: Bloque): string {
  const filas = b.filas
    .map(
      ([etiqueta, valor]) => `<tr>
        <td style="padding:7px 14px 7px 0;color:#5b6b70;font-size:14px;vertical-align:top;white-space:nowrap">${escapar(etiqueta)}</td>
        <td style="padding:7px 0;color:#12232b;font-size:15px;font-weight:600">${escapar(valor)}</td>
      </tr>`,
    )
    .join("");
  const parrafos = (b.parrafos ?? [])
    .map((p) => `<p style="margin:14px 0 0;color:#3d4d54;font-size:14px;line-height:1.55">${escapar(p)}</p>`)
    .join("");
  const boton = b.boton
    ? `<p style="margin:24px 0 6px">
         <a href="${escapar(b.boton.url)}" style="display:inline-block;background:#1c4b5a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px">${escapar(b.boton.texto)}</a>
       </p>
       <p style="margin:6px 0 0;color:#7b8a90;font-size:12px;word-break:break-all">${escapar(b.boton.url)}</p>`
    : "";
  const pie = b.pie ? `<p style="margin:20px 0 0;color:#7b8a90;font-size:12px;line-height:1.5">${escapar(b.pie)}</p>` : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapar(b.cabecera)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e1d8">
    <div style="background:#1c4b5a;padding:18px 26px">
      <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.3px">Hestiat</span>
      <span style="color:#c9a227;font-size:17px;font-weight:700">.</span>
    </div>
    <div style="padding:26px">
      <h1 style="margin:0 0 6px;color:#12232b;font-size:21px;line-height:1.3">${escapar(b.entrada)}</h1>
      <p style="margin:0 0 12px;color:#7b8a90;font-size:13px">${escapar(b.cabecera)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${filas}</table>
      ${parrafos}
      ${boton}
      ${pie}
    </div>
    <div style="background:#f4f2ed;padding:16px 26px;color:#7b8a90;font-size:12px;line-height:1.5">
      Hestiat · <a href="${escapar(URL_BASE)}" style="color:#1c4b5a">${escapar(URL_BASE)}</a><br>
      Este mensaje se ha enviado automáticamente a propósito de una reserva. No compartas la contraseña de tu correo con nadie.
    </div>
  </div>
</body></html>`;
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------- envíos -- */

export interface ResultadoAvisos {
  enviados: string[];
  fallos: string[];
  omitidos: string[];
}

/** Envía un bloque a un destinatario y anota el resultado. Nunca lanza. */
async function mandar(
  r: ResultadoAvisos,
  quien: string,
  para: string | null,
  asunto: string,
  b: Bloque,
  responderA: string | null,
): Promise<void> {
  if (!para) {
    r.omitidos.push(`${quien}: sin dirección`);
    return;
  }
  const res = await enviarCorreo({ para, asunto, texto: textoPlano(b), html: html(b), responderA });
  if (res.ok) r.enviados.push(quien);
  else r.fallos.push(`${quien}: ${res.motivo === "sin_smtp" ? "el correo no está configurado en el servidor" : res.detalle ?? "error"}`);
}

function filasComunes(d: DatosReserva): [string, string][] {
  return [
    ["Alojamiento", d.alojamientoTitulo],
    ["Huésped", d.huespedNombre],
    ["Email", d.huespedEmail],
    ["Llegada", fechaLarga(d.llegada)],
    ["Salida", fechaLarga(d.salida)],
    ["Noches", String(d.noches)],
    ["Viajeros", String(d.huespedes)],
    ["Precio total", euros(d.total, d.moneda)],
    ["Estado", estadoLegible(d.estado)],
  ];
}

/** Aviso interno a Hestiat. Se manda siempre, aunque el alojamiento no tenga anfitrión. */
async function aHestiat(r: ResultadoAvisos, d: DatosReserva, asunto: string, entrada: string, extra: string[] = []): Promise<void> {
  const b: Bloque = {
    cabecera: `Reserva ${d.codigo}`,
    entrada,
    filas: filasComunes(d),
    parrafos: [
      // Este es el dato que de verdad importa a Hestiat: si no hay anfitrión, nadie va a responder.
      d.anfitrionEmail
        ? `Anfitrión: ${d.anfitrionNombre ?? "(sin nombre)"} <${d.anfitrionEmail}>`
        : "AVISO: este alojamiento no tiene anfitrión asignado, así que no se ha podido avisarle.",
      ...extra,
    ],
    pie: d.huespedTel ? `Teléfono del huésped: ${d.huespedTel}` : undefined,
  };
  await mandar(r, "hestiat", CORREO_HESTIAT, asunto, b, d.huespedEmail || null);
}

/**
 * Correos de una reserva recién creada: al anfitrión, al huésped y copia interna a Hestiat.
 */
export async function avisarReservaCreada(reservaId: number): Promise<ResultadoAvisos> {
  const r: ResultadoAvisos = { enviados: [], fallos: [], omitidos: [] };
  try {
    const d = await datosDeReserva(reservaId);
    if (!d) {
      r.fallos.push("la reserva no existe");
      return r;
    }

    // 1 · Al anfitrión. Reply-To al huésped: así puede responderle directamente.
    await mandar(
      r,
      "anfitrión",
      d.anfitrionEmail,
      `Nueva reserva en Hestiat — ${d.alojamientoTitulo}`,
      {
        cabecera: `Reserva ${d.codigo}`,
        entrada: "Nueva reserva recibida",
        filas: filasComunes(d),
        parrafos: [
          d.estado === "pendiente"
            ? "Tienes que confirmarla o rechazarla desde tu panel. Si no haces nada, la solicitud caduca sola."
            : "No hay nada que hacer: ya está confirmada.",
          "Puedes responder a este correo para escribir directamente al huésped.",
        ],
        boton: { texto: "Ver reserva", url: `${URL_BASE}/host/reservas` },
        pie: d.notas ? `Notas del huésped: ${d.notas}` : undefined,
      },
      d.huespedEmail || null,
    );

    // 2 · Al huésped. Reply-To al anfitrión si existe; si no, al buzón de Hestiat (nunca a nadie
    //     que no exista).
    await mandar(
      r,
      "huésped",
      d.huespedEmail,
      `${d.estado === "confirmada" ? "Reserva confirmada" : "Reserva recibida"} en Hestiat — ${d.alojamientoTitulo}`,
      {
        cabecera: `Reserva ${d.codigo}`,
        entrada: d.estado === "confirmada" ? "Tu reserva está confirmada" : "Hemos recibido tu solicitud de reserva",
        filas: [
          ["Alojamiento", d.alojamientoTitulo],
          ["Ubicación", ubicacion(d)],
          ["Llegada", fechaLarga(d.llegada)],
          ["Salida", fechaLarga(d.salida)],
          ["Noches", String(d.noches)],
          ["Viajeros", String(d.huespedes)],
          ["Precio total", euros(d.total, d.moneda)],
          ["Estado", estadoLegible(d.estado)],
        ],
        parrafos: [
          d.estado === "pendiente"
            ? "El anfitrión tiene que confirmar la reserva. Te avisaremos por correo en cuanto lo haga."
            : "El anfitrión ya ha confirmado la reserva.",
          d.precioOrientativo
            ? "IMPORTANTE: el precio de este alojamiento es orientativo. El anfitrión confirmará el importe final."
            : "El precio indicado es el total de la estancia.",
          "En Hestiat no se paga nada: no hay comisión ni pasarela de pago. El pago se acuerda con el anfitrión.",
          "La dirección exacta te la facilitará el anfitrión al confirmar la reserva.",
        ],
        boton: { texto: "Ver mi reserva", url: `${URL_BASE}/reserva/${d.codigo}` },
        pie: "Guarda este correo: el código de reserva es tu referencia para cualquier consulta.",
      },
      d.anfitrionEmail || CORREO_HESTIAT,
    );

    // 3 · Copia interna a Hestiat.
    await aHestiat(r, d, `[Hestiat] Nueva reserva — ${d.alojamientoTitulo} (${d.codigo})`, "Nueva reserva registrada");
  } catch (error) {
    const m = error instanceof Error ? error.message : "error desconocido";
    console.error("[hestiat] avisos de reserva:", m.slice(0, 200));
    r.fallos.push(m.slice(0, 200));
  }
  resumir("creación", r);
  return r;
}

/**
 * Correos de un cambio de estado: al huésped (lo que ha pasado con su reserva), al anfitrión
 * (constancia) y copia interna a Hestiat. El asunto dice el estado real.
 */
export async function avisarCambioEstado(reservaId: number, nuevo: string): Promise<ResultadoAvisos> {
  const r: ResultadoAvisos = { enviados: [], fallos: [], omitidos: [] };
  try {
    const d = await datosDeReserva(reservaId);
    if (!d) {
      r.fallos.push("la reserva no existe");
      return r;
    }
    const asuntos: Record<string, string> = {
      confirmada: `Reserva confirmada en Hestiat — ${d.alojamientoTitulo}`,
      rechazada: `Tu solicitud en Hestiat no ha podido confirmarse — ${d.alojamientoTitulo}`,
      cancelada: `Reserva cancelada en Hestiat — ${d.alojamientoTitulo}`,
      completada: `Gracias por tu estancia en Hestiat — ${d.alojamientoTitulo}`,
    };
    const entradas: Record<string, string> = {
      confirmada: "El anfitrión ha confirmado tu reserva",
      rechazada: "El anfitrión no ha podido aceptar tu solicitud",
      cancelada: "La reserva ha sido cancelada",
      completada: "Tu estancia ha terminado",
    };
    const cuerpo: Record<string, string> = {
      confirmada: "Ya está confirmada. La dirección exacta te la dará el anfitrión. Si necesitas algo más, puedes responder a este correo.",
      rechazada: "Las fechas no están disponibles. Puedes buscar otras fechas o pedir consejo escribiendo a hola@hestiat.com.",
      cancelada: "Las noches han quedado libres de nuevo. Si no has sido tú, escríbenos a hola@hestiat.com.",
      completada: "Esperamos que haya ido bien. Puedes reservar de nuevo cuando quieras.",
    };
    const asuntoHuesped = asuntos[nuevo] ?? `Reserva actualizada en Hestiat — ${d.alojamientoTitulo}`;

    await mandar(
      r,
      "huésped",
      d.huespedEmail,
      asuntoHuesped,
      {
        cabecera: `Reserva ${d.codigo}`,
        entrada: entradas[nuevo] ?? "Tu reserva ha cambiado de estado",
        filas: [
          ["Alojamiento", d.alojamientoTitulo],
          ["Ubicación", ubicacion(d)],
          ["Llegada", fechaLarga(d.llegada)],
          ["Salida", fechaLarga(d.salida)],
          ["Noches", String(d.noches)],
          ["Viajeros", String(d.huespedes)],
          ["Precio total", euros(d.total, d.moneda)],
          ["Estado", estadoLegible(nuevo)],
        ],
        parrafos: [cuerpo[nuevo] ?? "", d.precioOrientativo ? "Recuerda que el precio de este alojamiento es orientativo y lo cierra el anfitrión." : ""].filter(Boolean),
        boton: { texto: "Ver mi reserva", url: `${URL_BASE}/reserva/${d.codigo}` },
      },
      d.anfitrionEmail || CORREO_HESTIAT,
    );

    await mandar(
      r,
      "anfitrión",
      d.anfitrionEmail,
      `Reserva ${nuevo} — ${d.alojamientoTitulo}`,
      {
        cabecera: `Reserva ${d.codigo}`,
        entrada: `La reserva ha pasado a: ${estadoLegible(nuevo)}`,
        filas: filasComunes(d),
        parrafos: ["Constancia del cambio. Puedes responder a este correo para escribir al huésped."],
        boton: { texto: "Ver reserva", url: `${URL_BASE}/host/reservas` },
      },
      d.huespedEmail || null,
    );

    await aHestiat(r, d, `[Hestiat] Reserva ${nuevo} — ${d.alojamientoTitulo} (${d.codigo})`, `Cambio de estado: ${estadoLegible(nuevo)}`);
  } catch (error) {
    const m = error instanceof Error ? error.message : "error desconocido";
    console.error("[hestiat] avisos de reserva:", m.slice(0, 200));
    r.fallos.push(m.slice(0, 200));
  }
  resumir("cambio de estado", r);
  return r;
}

/** Una sola línea de registro, sin credenciales y sin datos personales más allá del código. */
function resumir(momento: string, r: ResultadoAvisos): void {
  const partes = [`[hestiat] correos (${momento})`];
  partes.push(`enviados: ${r.enviados.join(", ") || "ninguno"}`);
  if (r.omitidos.length > 0) partes.push(`omitidos: ${r.omitidos.join(", ")}`);
  if (r.fallos.length > 0) partes.push(`fallos: ${r.fallos.join(" | ")}`);
  console.log(partes.join(" · "));
}
