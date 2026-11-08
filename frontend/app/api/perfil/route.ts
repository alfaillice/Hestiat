import { getCurrentUser } from "@/lib/auth.server";
import { actualizarPerfil, cambiarPassword, guardarAvatar, quitarAvatar } from "@/lib/cuenta.server";
import { redirigir } from "@/lib/http.server";

import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guardar el perfil o cambiar la contraseña — POST de formulario normal.
 *
 * El identificador del usuario sale SIEMPRE de la sesión, nunca del formulario: así nadie puede
 * editar el perfil de otra persona cambiando un campo oculto.
 */
export async function POST(request: Request) {
  // Límite de frecuencia: esta ruta crea datos y es pública.
  const excedido = limitar(request, "/api/perfil", 30, 60);
  if (excedido) return excedido;

  const usuario = await getCurrentUser();
  if (!usuario) return redirigir("/login?redirect=/perfil");

  const formulario = await request.formData();
  const accion = String(formulario.get("accion") ?? "perfil");

  try {
    if (accion === "avatar") {
      const r = await guardarAvatar(usuario.id, formulario);
      return redirigir(`/perfil?aviso=${encodeURIComponent(r.ok ? "Foto guardada." : r.error)}&ok=${r.ok ? 1 : 0}#mifoto`);
    }

    if (accion === "avatar-quitar") {
      const r = await quitarAvatar(usuario.id);
      return redirigir(`/perfil?aviso=${encodeURIComponent(r.ok ? "Foto quitada. Vuelves a tener el avatar con tu inicial." : r.error)}&ok=${r.ok ? 1 : 0}#mifoto`);
    }

    if (accion === "password") {
      const r = await cambiarPassword(
        usuario.id,
        String(formulario.get("actual") ?? ""),
        String(formulario.get("nueva") ?? ""),
        String(formulario.get("nueva2") ?? ""),
      );
      return redirigir(`/perfil?aviso=${encodeURIComponent(r.ok ? "Contraseña actualizada." : r.error)}&ok=${r.ok ? 1 : 0}`);
    }

    const r = await actualizarPerfil(usuario.id, formulario);
    return redirigir(`/perfil?aviso=${encodeURIComponent(r.ok ? "Perfil guardado." : r.error)}&ok=${r.ok ? 1 : 0}`);
  } catch (error) {
    console.error("[hestiat] /api/perfil", error);
    return redirigir("/perfil?aviso=" + encodeURIComponent("No se ha podido guardar.") + "&ok=0");
  }
}
