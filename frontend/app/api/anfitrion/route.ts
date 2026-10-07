import { solicitar } from "@/lib/anfitrion.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solicitar la cuenta de anfitrión — POST de formulario normal.
 *
 * Dos desenlaces posibles, y la respuesta lo distingue:
 *  · con SMTP configurado → se ha enviado un enlace de confirmación; la cuenta NO está activa aún
 *  · sin SMTP            → la cuenta queda activa directamente y la página lo explica
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/anfitrion", 10, 60);
  if (excedido) return excedido;

  try {
    const r = await solicitar(await request.formData());
    if (!r.ok) return redirigir(`/anfitrion?error=${encodeURIComponent(r.error)}`);
    return redirigir(r.verificacion ? "/anfitrion?enviado=1" : "/host?bienvenida=anfitrion");
  } catch (error) {
    console.error("[hestiat] /api/anfitrion", error);
    return redirigir("/anfitrion?error=" + encodeURIComponent("No se ha podido tramitar la solicitud. Inténtalo de nuevo."));
  }
}
