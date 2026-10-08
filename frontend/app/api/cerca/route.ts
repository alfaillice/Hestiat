import { NextResponse } from "next/server";
import { buscar } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «a 3,2 km» o «a 850 m». La distancia viene calculada por la base, aquí solo se escribe. */
function distanciaLegible(metros: unknown): string | undefined {
  const m = Number(metros);
  if (!Number.isFinite(m) || m < 0) return undefined;
  if (m < 950) return `a ${Math.round(m / 10) * 10} m`;
  return `a ${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Alojamientos alrededor de un punto.
 *
 * Las coordenadas las pone el navegador cuando la persona da permiso. Aquí no se guarda ninguna
 * ubicación: se usan para esta consulta y se descartan. El orden es por distancia real, calculada en
 * la base con las coordenadas de cada alojamiento.
 *
 * Devuelve además qué tiene guardado en favoritos quien pregunta, para que el corazón de la tarjeta
 * salga en su estado de verdad y no vacío.
 */
export async function GET(request: Request) {
  const excedido = limitar(request, "/api/cerca", 30, 60);
  if (excedido) return excedido;

  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ alojamientos: [], error: "Coordenadas no válidas." }, { status: 400 });
  }

  try {
    const r = await buscar({ cerca: { lat, lng }, pagina: 1, porPagina: 12 });
    const tarjetas = r.items.map((fila) => {
      const f = fila as unknown as Record<string, unknown>;
      return {
        ...aTarjeta(f),
        nota: distanciaLegible(f.distancia_m),
      };
    });

    const sesion = await getCurrentUser();
    const guardados = sesion
      ? [...(await guardadosEntre(Number(sesion.id), tarjetas.map((t) => t.id)))]
      : [];

    return NextResponse.json(
      { alojamientos: tarjetas, guardados, haySesion: Boolean(sesion), total: r.total },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[hestiat] /api/cerca", error instanceof Error ? error.message.slice(0, 160) : error);
    return NextResponse.json({ alojamientos: [], error: "No se han podido buscar alojamientos cercanos." }, { status: 500 });
  }
}
