import { cookies } from "next/headers";
import {
  autenticarConGoogle,
  consumirState,
  googleConfigurado,
  hashDe,
  intercambiarCodigo,
  retornoValido,
  verificarIdToken,
} from "@/lib/auth-google.server";
import { createSession, setSessionCookie } from "@/lib/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vuelta de Google.
 *
 * Orden de comprobaciones, y ninguna se salta: que la petición traiga `state` y `code`, que el
 * `state` coincida con la cookie, que exista y no se haya usado en `auth_nonce` (y no esté caducado
 * —se consume de una vez), que Google cambie el código por un token, y que ese token esté firmado
 * por Google, destinado a esta aplicación, vigente y con nuestro `nonce`.
 *
 * Solo entonces se vincula la identidad y se abre sesión. Cualquier fallo devuelve al acceso con un
 * mensaje claro: nunca se crea una cuenta a medias.
 *
 * No se toca el rol en ningún caso: Google autentica, los permisos siguen siendo de Hestiat.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const responder = (location: string) => new Response(null, { status: 303, headers: { location } });

  if (!googleConfigurado()) return responder("/login?google=sin-configurar");

  const c = await cookies();
  const volver = retornoValido(c.get("hestiat_oauth_volver")?.value);
  const borrar = () => {
    c.delete("hestiat_oauth_state");
    c.delete("hestiat_oauth_nonce");
    c.delete("hestiat_oauth_volver");
  };

  const errorGoogle = url.searchParams.get("error");
  if (errorGoogle) {
    // Cancelar en Google no es un fallo del sistema: se vuelve al acceso sin ruido.
    borrar();
    return responder("/login?google=cancelado");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = c.get("hestiat_oauth_state")?.value;
  const nonceCookie = c.get("hestiat_oauth_nonce")?.value;

  if (!code || !state || !stateCookie || !nonceCookie || state !== stateCookie) {
    borrar();
    return responder("/login?google=state");
  }

  try {
    const valido = await consumirState(hashDe(state));
    if (!valido) {
      borrar();
      return responder("/login?google=state-caducado");
    }

    const { id_token } = await intercambiarCodigo(code);
    if (!id_token) throw new Error("Google no ha devuelto la identidad.");
    const carga = await verificarIdToken(id_token, nonceCookie);

    const r = await autenticarConGoogle(carga);
    borrar();
    if (!r.ok) return responder(`/login?google=error&motivo=${encodeURIComponent(r.error)}`);

    const token = await createSession(r.usuarioId, request.headers.get("user-agent") ?? undefined);
    await setSessionCookie(token);
    return responder(volver);
  } catch (error) {
    borrar();
    const motivo = error instanceof Error ? error.message : "No se ha podido completar el acceso.";
    console.error("[hestiat] google callback", motivo);
    return responder(`/login?google=error&motivo=${encodeURIComponent(motivo)}`);
  }
}
