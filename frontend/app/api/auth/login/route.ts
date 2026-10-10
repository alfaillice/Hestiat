import { login } from "@/lib/auth.server";
import { redirigir } from "@/lib/http.server";
import { NextResponse } from "next/server";

import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrar — POST de formulario normal. La sesión se crea en servidor y la cookie es httpOnly. */
export async function POST(request: Request) {
  // Límite de frecuencia: esta ruta crea datos y es pública.
  const excedido = limitar(request, "/api/auth/login", 10, 60);
  if (excedido) return excedido;

  // Leer el formulario va DENTRO de una protección: si la petición no trae un formulario (un JSON,
  // un cuerpo cortado…) esto lanzaba una excepción que salía como error 500 del servidor.
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "La solicitud no tiene el formato esperado." },
      { status: 400 },
    );
  }

  const email = String(formulario.get("email") ?? "");
  const password = String(formulario.get("password") ?? "");
  const destino = String(formulario.get("redirect") ?? "/") || "/";

  try {
    const r = await login({ email, password, userAgent: request.headers.get("user-agent") });
    if (!r.ok) {
      const p = new URLSearchParams({ error: r.error, redirect: destino });
      return redirigir(`/login?${p}`);
    }
    return redirigir(r.usuario.rol === "admin" ? "/admin" : destino);
  } catch (error) {
    console.error("[hestiat] /api/auth/login", error);
    const p = new URLSearchParams({ error: "No se ha podido iniciar sesión. Inténtalo de nuevo.", redirect: destino });
    return redirigir(`/login?${p}`);
  }
}
