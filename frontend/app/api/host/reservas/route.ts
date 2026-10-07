import { NextResponse } from "next/server";
import { requireHost } from "@/lib/auth.server";
import { cambiarEstado, type EstadoReserva } from "@/lib/reservas.server";
import { avisarCambioEstado } from "@/lib/correo-reservas.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirmar, rechazar, cancelar o completar una reserva — POST de formulario normal.
 *
 * Igual que en la creación: sin depender de Server Actions. Que la reserva pertenezca a un
 * alojamiento del anfitrión se comprueba dentro de `cambiarEstado`, en servidor.
 */
function redirigir(ruta: string): NextResponse {
  // Relativa a propósito: detrás de nginx la aplicación se ve como localhost (ver /api/reservas).
  return new NextResponse(null, { status: 303, headers: { Location: ruta } });
}

export async function POST(request: Request) {
  const formulario = await request.formData();
  const id = Number(formulario.get("id"));
  const nuevo = String(formulario.get("estado") ?? "") as EstadoReserva;

  const host = await requireHost();
  if (!host) return redirigir("/login?redirect=/host/reservas");

  if (!Number.isFinite(id) || !["confirmada", "rechazada", "cancelada", "completada"].includes(nuevo)) {
    return redirigir("/host/reservas?aviso=" + encodeURIComponent("Petición no válida.") + "&ok=0");
  }

  try {
    const r = await cambiarEstado({ id: host.id, rol: host.rol }, id, nuevo);
    // Si el cambio se ha aplicado, se avisa: huésped, anfitrión y copia interna a Hestiat. Nunca
    // tumba la operación —el estado ya está guardado— y no lanza.
    if (r.ok) {
      try {
        await avisarCambioEstado(id, nuevo);
      } catch (error) {
        console.error("[hestiat] /api/host/reservas (avisos)", error instanceof Error ? error.message.slice(0, 200) : error);
      }
    }
    const aviso = r.ok ? "Reserva actualizada." : r.error ?? "No se ha podido actualizar.";
    return redirigir(`/host/reservas?aviso=${encodeURIComponent(aviso)}&ok=${r.ok ? "1" : "0"}`);
  } catch (error) {
    console.error("[hestiat] /api/host/reservas", error);
    return redirigir("/host/reservas?aviso=" + encodeURIComponent("No se ha podido actualizar la reserva.") + "&ok=0");
  }
}
