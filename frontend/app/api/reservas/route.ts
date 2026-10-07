import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { crearSolicitud } from "@/lib/reservas.server";

import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crear una solicitud de reserva — POST de formulario normal.
 *
 * Por qué una ruta de API y no una Server Action: este es el paso más crítico del marketplace y no
 * puede depender de que el navegador haya hidratado el JavaScript ni de que los identificadores de
 * acción coincidan entre cliente y servidor. Un POST de formulario funciona siempre, incluso sin
 * JavaScript, y se puede probar con una sola petición.
 *
 * La autorización y los cálculos son de servidor: el precio NO se acepta nunca del formulario.
 */
function redirigir(ruta: string): NextResponse {
  // Location RELATIVA a propósito. Detrás de nginx la aplicación se ve a sí misma como
  // localhost:3000, así que una URL absoluta construida con `request.url` mandaría al usuario a
  // localhost. Una ruta relativa la resuelve el navegador contra el dominio público real.
  return new NextResponse(null, { status: 303, headers: { Location: ruta } });
}

export async function POST(request: Request) {
  // Límite de frecuencia: esta ruta crea datos y es pública.
  const excedido = limitar(request, "/api/reservas", 15, 60);
  if (excedido) return excedido;

  const formulario = await request.formData();
  const slug = String(formulario.get("slug") ?? "");
  const desde = String(formulario.get("desde") ?? "");
  const hasta = String(formulario.get("hasta") ?? "");
  const huespedes = Number(formulario.get("huespedes") ?? 1);
  const base = `/reservar/${encodeURIComponent(slug)}`;

  try {
    const usuario = await getCurrentUser();
    const r = await crearSolicitud({
      accommodationId: Number(formulario.get("accommodationId")),
      desde,
      hasta,
      huespedes,
      nombre: String(formulario.get("nombre") ?? ""),
      email: String(formulario.get("email") ?? ""),
      telefono: String(formulario.get("telefono") ?? ""),
      notas: String(formulario.get("notas") ?? ""),
      usuarioId: usuario?.id ?? null,
    });

    if (!r.ok) {
      const p = new URLSearchParams({ desde, hasta, huespedes: String(huespedes), error: r.error });
      return redirigir(`${base}?${p}`);
    }
    const p = new URLSearchParams({
      codigo: r.codigo,
      noches: String(r.resumen.noches),
      total: String(r.resumen.total),
      moneda: r.resumen.moneda,
      orientativo: r.resumen.orientativo ? "1" : "0",
    });
    return redirigir(`${base}?${p}`);
  } catch (error) {
    console.error("[hestiat] /api/reservas", error);
    const p = new URLSearchParams({ desde, hasta, huespedes: String(huespedes), error: "No se ha podido registrar la solicitud. Inténtalo de nuevo." });
    return redirigir(`${base}?${p}`);
  }
}
