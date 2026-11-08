import { crearReclama } from "@/lib/reclama.server";
import { redirigir } from "@/lib/http.server";
import { NextResponse } from "next/server";

import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enviar una reclamación de propiedad — POST de formulario normal. */
export async function POST(request: Request) {
  // Límite de frecuencia: esta ruta crea datos y es pública.
  const excedido = limitar(request, "/api/reclamar", 10, 60);
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

  const alojamientoId = Number(formulario.get("alojamientoId"));

  try {
    const r = await crearReclama({
      alojamientoId,
      email: String(formulario.get("email") ?? ""),
      nombre: String(formulario.get("nombre") ?? ""),
      telefono: String(formulario.get("telefono") ?? ""),
      mensaje: String(formulario.get("mensaje") ?? ""),
    });
    if (!r.ok) {
      const p = new URLSearchParams({ id: String(alojamientoId), error: r.error });
      return redirigir(`/reclamar?${p}`);
    }
    return redirigir("/reclamar?enviado=1");
  } catch (error) {
    console.error("[hestiat] /api/reclamar", error);
    const p = new URLSearchParams({ id: String(alojamientoId), error: "No se ha podido enviar la solicitud." });
    return redirigir(`/reclamar?${p}`);
  }
}
