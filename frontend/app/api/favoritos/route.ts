import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { alternarFavorito, favoritosDe } from "@/lib/favoritos.server";
import { limitar } from "@/lib/limite.server";

export const dynamic = "force-dynamic";

/**
 * Favoritos: guardar o quitar un alojamiento de la lista del usuario.
 *
 * Exige sesión: sin sesión no hay dónde guardar, y la respuesta lo dice (401) en vez de fingir que
 * se ha guardado. Acepta formulario normal y JSON, para que funcione igual con o sin JavaScript.
 */
export async function POST(request: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) {
    return NextResponse.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });
  }
  const limitado = limitar(request, "favoritos", 90, 60);
  if (limitado) return limitado;

  let accommodationId = 0;
  const tipo = request.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("application/json")) {
      const cuerpo = await request.json();
      accommodationId = Number((cuerpo as any)?.accommodationId);
    } else {
      const formulario = await request.formData();
      accommodationId = Number(formulario.get("accommodationId"));
    }
  } catch {
    accommodationId = 0;
  }

  if (!Number.isInteger(accommodationId) || accommodationId <= 0) {
    return NextResponse.json({ ok: false, motivo: "alojamiento-no-valido" }, { status: 400 });
  }

  const guardado = await alternarFavorito(Number(sesion.id), accommodationId);
  return NextResponse.json({ ok: true, guardado });
}

/** Lista de ids guardados (para sincronizar la interfaz sin recargar). */
export async function GET() {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });
  const ids = await favoritosDe(Number(sesion.id));
  return NextResponse.json({ ok: true, ids });
}
