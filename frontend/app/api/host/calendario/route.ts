import { requireHost } from "@/lib/auth.server";
import { bloquear, liberar, fechasValidas } from "@/lib/calendario.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bloquear o liberar noches — POST de formulario normal.
 *
 * La propiedad del alojamiento se comprueba dentro de `bloquear`/`liberar` (en servidor). Aquí solo
 * se valida la forma de la petición y se limita la frecuencia: esta ruta puede escribir muchas filas
 * de golpe, así que es justo la que hay que proteger.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/host/calendario", 30, 60);
  if (excedido) return excedido;

  const host = await requireHost();
  if (!host) return redirigir("/login?redirect=/host/calendario");

  const formulario = await request.formData();
  const alojamientoId = Number(formulario.get("a"));
  const mes = String(formulario.get("mes") ?? "");
  const accion = String(formulario.get("accion") ?? "");
  const fechas = fechasValidas(formulario.getAll("fechas"));
  const volver = `/host/calendario?a=${alojamientoId}&mes=${mes}`;

  if (!Number.isFinite(alojamientoId) || !["bloquear", "liberar"].includes(accion)) {
    return redirigir(`${volver}&aviso=${encodeURIComponent("Petición no válida.")}&ok=0`);
  }

  try {
    const r = accion === "bloquear"
      ? await bloquear(host.id, alojamientoId, fechas)
      : await liberar(host.id, alojamientoId, fechas);

    if (!r.ok) return redirigir(`${volver}&aviso=${encodeURIComponent(r.error ?? "No se ha podido aplicar.")}&ok=0`);

    const verbo = accion === "bloquear" ? "bloqueadas" : "liberadas";
    const aviso = `${r.hechas} ${r.hechas === 1 ? "noche" : "noches"} ${verbo}.` +
      (r.omitidas > 0 ? ` ${r.omitidas} sin cambios (ya ocupadas, de canal externo o con reserva).` : "");
    return redirigir(`${volver}&aviso=${encodeURIComponent(aviso)}&ok=1`);
  } catch (error) {
    console.error("[hestiat] /api/host/calendario", error);
    return redirigir(`${volver}&aviso=${encodeURIComponent("No se ha podido aplicar el cambio.")}&ok=0`);
  }
}
