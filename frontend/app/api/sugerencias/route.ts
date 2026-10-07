import { NextResponse } from "next/server";
import { sugerenciasDestino } from "@/lib/db";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sugerencias de destino para la barra de búsqueda.
 *
 * Devuelve ciudades, provincias y nombres de alojamiento que existen de verdad en el catálogo, con
 * cuántos alojamientos hay detrás. No hay lista escrita a mano ni datos de ejemplo: todo sale de la
 * consulta. Si algo falla, la barra sigue funcionando sin sugerencias.
 */
export async function GET(request: Request) {
  // Es una ruta pública y la llama el navegador mientras se escribe: conviene limitarla.
  const excedido = limitar(request, "/api/sugerencias", 60, 60);
  if (excedido) return excedido;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const sugerencias = await sugerenciasDestino(q, 8);
    return NextResponse.json(
      { sugerencias },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    console.error("[hestiat] /api/sugerencias", error instanceof Error ? error.message.slice(0, 160) : error);
    return NextResponse.json({ sugerencias: [] }, { status: 200 });
  }
}
