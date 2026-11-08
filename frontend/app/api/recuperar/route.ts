import { NextResponse } from "next/server";
import { limitar } from "@/lib/limite.server";
import { buscarUsuarioPorEmail, crearEnlace } from "@/lib/recuperacion.server";
import { enviarEnlaceRecuperacion } from "@/lib/correo-recuperacion.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pedir el enlace de recuperación — POST de formulario normal.
 *
 * Responde SIEMPRE lo mismo, exista o no la cuenta: así no se puede averiguar qué correos están
 * registrados probando el formulario. Si la cuenta existe, se envía el correo.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/recuperar", 8, 60);
  if (excedido) return excedido;

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene el formato esperado." }, { status: 400 });
  }

  const email = String(formulario.get("email") ?? "").trim().toLowerCase();
  const destino = "/recuperar?enviado=1";
  if (!email || !email.includes("@")) {
    return redirigir("/recuperar?error=correo");
  }

  try {
    const usuario = await buscarUsuarioPorEmail(email);
    if (usuario) {
      const token = await crearEnlace(usuario.id);
      if (!token) {
        // Demasiadas peticiones para esta cuenta: no se envía nada y se anota.
        console.warn("[hestiat] recuperación: demasiadas solicitudes para la misma cuenta");
      } else {
        const envio = await enviarEnlaceRecuperacion({ para: usuario.email, nombre: usuario.nombre, token });
        if (!envio.ok) console.error("[hestiat] recuperación: el correo no ha salido", envio.motivo ?? "motivo desconocido");
      }
    }
  } catch (error) {
    // Un fallo interno no cambia la respuesta: no se filtra nada al visitante, se anota aquí.
    console.error("[hestiat] /api/recuperar", error);
  }

  return redirigir(destino);
}
