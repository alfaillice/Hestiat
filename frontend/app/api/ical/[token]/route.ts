import { poolLegacy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exportación del calendario de Hestiat en formato iCal.
 *
 * Es la otra mitad de la integración: con los canales se **importa** el calendario de Airbnb o
 * Booking, y con esta dirección se les **entrega** el de Hestiat. Es lo que permite que las
 * plataformas sepan qué noches están ocupadas aquí y no las vendan otra vez.
 *
 * Es pública a propósito (las plataformas la piden sin sesión), pero solo entrega fechas: ni
 * nombres, ni teléfonos, ni importes. El identificador es un token de 32 caracteres por
 * alojamiento, así que no se puede adivinar el calendario de nadie.
 */
function ics(lines: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hestiat//Calendario//ES", "CALSCALE:GREGORIAN"].concat(lines, ["END:VCALENDAR"]).join("\r\n");
}

function sello(fecha: string): string {
  return `${fecha.replace(/-/g, "")}T000000Z`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limpio = (token ?? "").replace(/[^a-f0-9]/gi, "").slice(0, 64);

  if (limpio.length < 16) {
    return new Response(ics([]), { status: 200, headers: { "content-type": "text/calendar; charset=utf-8" } });
  }

  try {
    // mysql2 devuelve [filas, campos]: hay que quedarse con la primera fila, no con el array.
    const [tokens] = await poolLegacy.query<any[]>(
      `SELECT alojamiento_id FROM ical_export_token WHERE token = ? LIMIT 1`,
      [limpio],
    );
    const tok = tokens[0];
    if (!tok) {
      return new Response(ics([]), { status: 200, headers: { "content-type": "text/calendar; charset=utf-8" } });
    }
    const alojamientoId = Number(tok.alojamiento_id);

    // Un evento por noche ocupada o bloqueada. Se incluye desde ayer para que las reservas en curso
    // no se pierdan por husos horarios.
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT fecha, motivo FROM disponibilidad
        WHERE alojamiento_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        ORDER BY fecha LIMIT 3000`,
      [alojamientoId],
    );

    const eventos = filas.map((f) => {
      const fecha = String(f.fecha).slice(0, 10);
      const siguiente = new Date(`${fecha}T00:00:00Z`);
      siguiente.setUTCDate(siguiente.getUTCDate() + 1);
      const fin = siguiente.toISOString().slice(0, 10);
      return [
        "BEGIN:VEVENT",
        `UID:hestiat-${alojamientoId}-${fecha}@hestiat.com`,
        `DTSTAMP:${sello(fecha)}`,
        `DTSTART;VALUE=DATE:${fecha.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${fin.replace(/-/g, "")}`,
        "SUMMARY:No disponible",
        "TRANSP:OPAQUE",
        "END:VEVENT",
      ].join("\r\n");
    });

    return new Response(ics(eventos), {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        // Se puede cachear: las plataformas lo piden cada pocas horas.
        "cache-control": "public, max-age=900",
      },
    });
  } catch (error) {
    console.error("[hestiat] /api/ical", error);
    return new Response(ics([]), { status: 200, headers: { "content-type": "text/calendar; charset=utf-8" } });
  }
}
