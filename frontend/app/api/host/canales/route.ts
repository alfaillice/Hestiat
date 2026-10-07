import { requireHost } from "@/lib/auth.server";
import { conectarCanal, sincronizarCanal, desconectarCanal, CANALES, type Canal } from "@/lib/canales.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canales iCal del panel del anfitrión — POST de formulario normal.
 *
 * Misma lógica que ya existía (`lib/canales.server`), expuesta como formulario para que funcione
 * sin JavaScript. La comprobación de propiedad la hacen las propias funciones del canal: cada una
 * verifica que el alojamiento sea del usuario antes de tocar nada.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/host/canales", 20, 60);
  if (excedido) return excedido;

  const host = await requireHost();
  if (!host) return redirigir("/login?redirect=/host/integraciones");

  const formulario = await request.formData();
  const alojamientoId = Number(formulario.get("a"));
  const canal = String(formulario.get("canal") ?? "") as Canal;
  const accion = String(formulario.get("accion") ?? "");
  const url = String(formulario.get("url") ?? "").trim();
  const volver = `/host/integraciones?a=${alojamientoId}`;

  if (!Number.isFinite(alojamientoId) || !CANALES.includes(canal)) {
    return redirigir(`${volver}&aviso=${encodeURIComponent("Petición no válida.")}&ok=0`);
  }

  try {
    if (accion === "conectar") {
      if (!url) return redirigir(`${volver}&aviso=${encodeURIComponent("Pega la dirección del calendario del canal.")}&ok=0`);
      const r = await conectarCanal(host.id, alojamientoId, canal, url);
      const aviso = r.ok
        ? `Canal conectado: ${r.eventos} ${r.eventos === 1 ? "evento leído" : "eventos leídos"}, ${r.fechas} ${r.fechas === 1 ? "noche bloqueada" : "noches bloqueadas"}.`
        : r.motivo ?? "No se ha podido conectar el canal.";
      return redirigir(`${volver}&aviso=${encodeURIComponent(aviso)}&ok=${r.ok ? 1 : 0}`);
    }

    if (accion === "sincronizar") {
      const r = await sincronizarCanal(host.id, alojamientoId, canal);
      const aviso = r.ok
        ? `Sincronizado: ${r.eventos} ${r.eventos === 1 ? "evento" : "eventos"}, ${r.fechas} ${r.fechas === 1 ? "noche" : "noches"}.`
        : r.motivo ?? "No se ha podido sincronizar.";
      return redirigir(`${volver}&aviso=${encodeURIComponent(aviso)}&ok=${r.ok ? 1 : 0}`);
    }

    if (accion === "desconectar") {
      const r = await desconectarCanal(host.id, alojamientoId, canal);
      const aviso = r.ok ? "Canal desconectado y sus noches liberadas." : r.error ?? "No se ha podido desconectar.";
      return redirigir(`${volver}&aviso=${encodeURIComponent(aviso)}&ok=${r.ok ? 1 : 0}`);
    }

    return redirigir(`${volver}&aviso=${encodeURIComponent("Acción no reconocida.")}&ok=0`);
  } catch (error) {
    console.error("[hestiat] /api/host/canales", error);
    return redirigir(`${volver}&aviso=${encodeURIComponent("No se ha podido completar la operación.")}&ok=0`);
  }
}
