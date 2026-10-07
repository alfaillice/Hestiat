import { requireAdmin } from "@/lib/auth.server";
import { aprobarReclama, rechazarReclama } from "@/lib/reclama.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aprobar o rechazar una reclamación de propiedad — POST de formulario normal.
 *
 * Aprobar vincula el alojamiento a la cuenta de ese correo y retira su marca de huérfano. Si esa
 * cuenta no existe, `aprobarReclama` avisa y NO cambia nada.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return redirigir("/login?redirect=/admin/reclamaciones");

  const formulario = await request.formData();
  const id = Number(formulario.get("id"));
  const accion = String(formulario.get("accion") ?? "");
  if (!Number.isFinite(id)) return redirigir("/admin/reclamaciones?aviso=Petici%C3%B3n%20no%20v%C3%A1lida&ok=0");

  // El estado destino se deduce de la acción concreta: nunca se acepta del formulario.
  const nuevo = accion === "aprobar" ? "confirmada" : "";
  try {
    if (nuevo) {
      const r = await aprobarReclama(id, admin.id);
      return redirigir(`/admin/reclamaciones?aviso=${encodeURIComponent(r.mensaje)}&ok=${r.ok ? 1 : 0}`);
    }
    await rechazarReclama(id, admin.id);
    return redirigir("/admin/reclamaciones?aviso=Solicitud%20rechazada&ok=1");
  } catch (error) {
    console.error("[hestiat] /api/admin/reclamaciones", error);
    return redirigir("/admin/reclamaciones?aviso=No%20se%20ha%20podido%20actualizar&ok=0");
  }
}
