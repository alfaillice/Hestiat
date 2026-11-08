import { NextResponse } from "next/server";
import { limitar } from "@/lib/limite.server";
import { cambiarPasswordConToken, revisarPasswordNueva } from "@/lib/recuperacion.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poner la contraseña nueva — POST de formulario normal. */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/restablecer", 10, 60);
  if (excedido) return excedido;

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene el formato esperado." }, { status: 400 });
  }

  const token = String(formulario.get("token") ?? "").trim();
  const password = String(formulario.get("password") ?? "");
  const password2 = String(formulario.get("password2") ?? "");
  const volver = (motivo: string) => redirigir(`/restablecer/${encodeURIComponent(token)}?error=${motivo}`);

  const problema = revisarPasswordNueva(password, password2);
  if (problema) return volver(problema.includes("8") ? "corta" : "distintas");

  try {
    const r = await cambiarPasswordConToken(token, password);
    if (!r.ok) {
      console.warn("[hestiat] restablecer: testigo no válido", r.motivo);
      return volver(r.motivo);
    }
    return redirigir("/login?recuperado=1");
  } catch (error) {
    console.error("[hestiat] /api/restablecer", error);
    return volver("error");
  }
}
