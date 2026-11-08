import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { limitar } from "@/lib/limite.server";
import {
  azar,
  googleConfigurado,
  guardarState,
  hashDe,
  retornoValido,
  urlAutorizacion,
} from "@/lib/auth-google.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Arranca el acceso con Google (OAuth 2.0 / OpenID Connect, flujo de código).
 *
 * Se generan un `state` y un `nonce`: el primero va firmado en una cookie httpOnly y en la base
 * (`auth_nonce`) para comprobar a la vuelta que el intento es el nuestro; el segundo viaja a Google
 * y vuelve dentro del token, para que un token capturado no sirva dos veces.
 *
 * Si no hay credenciales configuradas NO se simula nada: se vuelve al acceso avisando de que falta
 * configurarlo, en lugar de fingir un botón de Google que no lleva a ningún sitio.
 */
export async function GET(request: Request) {
  const limitado = limitar(request, "auth-google", 30, 60);
  if (limitado) return limitado;

  const url = new URL(request.url);
  const volver = retornoValido(url.searchParams.get("volver"));

  const responder = (location: string) => new Response(null, { status: 303, headers: { location } });

  if (!googleConfigurado()) {
    return responder(`/login?google=sin-configurar&volver=${encodeURIComponent(volver)}`);
  }

  const state = azar();
  const nonce = azar();
  await guardarState(hashDe(state));

  const c = await cookies();
  const opciones = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  c.set("hestiat_oauth_state", state, opciones);
  c.set("hestiat_oauth_nonce", nonce, opciones);
  c.set("hestiat_oauth_volver", volver, opciones);

  return NextResponse.redirect(urlAutorizacion(state, nonce));
}
