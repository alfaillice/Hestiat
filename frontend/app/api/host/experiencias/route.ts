import { requireHost } from "@/lib/auth.server";
import { enlazar, type TipoCatalogo } from "@/lib/catalogo.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vincular o desvincular experiencias y servicios del catálogo a un alojamiento.
 *
 * POST de formulario normal. La propiedad del alojamiento se comprueba en servidor
 * (`alojamientoPropio`): un anfitrión solo puede tocar sus alojamientos.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/host/experiencias", 30, 60);
  if (excedido) return excedido;

  const host = await requireHost();
  if (!host) return redirigir("/login?redirect=/host/experiencias");

  const formulario = await request.formData();
  const alojamientoId = Number(formulario.get("a"));
  const tipo = String(formulario.get("tipo") ?? "experiencia") as TipoCatalogo;
  const accion = String(formulario.get("accion") ?? "");
  const ids = formulario.getAll("ids").map((v) => Number(v));
  const volver = `/host/experiencias?a=${alojamientoId}&tipo=${tipo}`;

  if (!Number.isFinite(alojamientoId) || !["experiencia", "servicio"].includes(tipo) || !["agregar", "quitar"].includes(accion)) {
    return redirigir(`${volver}&aviso=${encodeURIComponent("Petición no válida.")}&ok=0`);
  }

  try {
    const r = await enlazar(host.id, alojamientoId, tipo, ids, accion as "agregar" | "quitar");
    if (!r.ok) return redirigir(`${volver}&aviso=${encodeURIComponent(r.error)}&ok=0`);
    const plural = tipo === "experiencia" ? "experiencia" : "servicio";
    const verbo = accion === "agregar" ? "añadidas" : "retiradas";
    const aviso = r.hechas === 0
      ? `Nada que cambiar: ya estaban en ese estado.`
      : `${r.hechas} ${r.hechas === 1 ? plural : plural + "s"} ${verbo}.`;
    return redirigir(`${volver}&aviso=${encodeURIComponent(aviso)}&ok=1`);
  } catch (error) {
    console.error("[hestiat] /api/host/experiencias", error);
    return redirigir(`${volver}&aviso=${encodeURIComponent("No se ha podido aplicar el cambio.")}&ok=0`);
  }
}
