import { getCurrentUser } from "@/lib/auth.server";
import { crearAlojamiento } from "@/lib/admin-catalog.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta de alojamiento, para anfitriones y administradores: una sola ruta y una sola lógica.
 *
 * Lo que cambia por rol, y se decide AQUÍ, no en la interfaz:
 *  · Anfitrión: el alojamiento queda vinculado a su cuenta, siempre. No puede crear uno a nombre de
 *    otra persona ni aunque manipule el formulario.
 *  · Administrador: puede indicar un correo de anfitrión.
 *
 * Un huésped no puede crear alojamientos: se le lleva a la página para hacerse anfitrión.
 */
export async function POST(request: Request) {
  const limitado = limitar(request, "/api/alojamientos", 20, 60);
  if (limitado) return limitado;

  const sesion = await getCurrentUser();
  if (!sesion) return redirigir("/login?volver=%2Fnuevo");

  const esAdmin = sesion.rol === "admin";
  if (!esAdmin && sesion.rol !== "anfitrion") {
    return redirigir("/anfitrion");
  }

  const formulario = await request.formData();
  const parametros = new URLSearchParams({
    t: String(formulario.get("titulo") ?? ""),
    c: String(formulario.get("ciudad") ?? ""),
  });

  try {
    const r = await crearAlojamiento(formulario, { propietarioId: esAdmin ? null : Number(sesion.id) });

    if (!r.ok && "duplicados" in r) {
      parametros.set("dup", r.duplicados.map((d) => d.id).join(","));
      return redirigir(`/nuevo?${parametros.toString()}`);
    }
    if (!r.ok) {
      parametros.set("error", r.error);
      return redirigir(`/nuevo?${parametros.toString()}`);
    }
    // Al crearlo se entra directo en el editor único para completarlo: no tiene sentido dejar al
    // anfitrión en un formulario de alta si lo que falta es la ficha entera.
    return redirigir(`/editar/${r.id}?ok=${encodeURIComponent("Alojamiento creado. Completa la ficha y publícalo cuando esté listo.")}`);
  } catch (error) {
    console.error("[hestiat] /api/alojamientos", error);
    parametros.set("error", "No se ha podido crear el alojamiento.");
    return redirigir(`/nuevo?${parametros.toString()}`);
  }
}
