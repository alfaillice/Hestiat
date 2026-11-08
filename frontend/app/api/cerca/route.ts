import { NextResponse } from "next/server";
import { alojamientosCerca, experienciasCerca, MAXIMO } from "@/lib/cerca.server";
import { serviciosCerca } from "@/lib/servicios.server";
import type { RespuestaCerca } from "@/lib/cerca.tipos";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Cerca de ti», con tres modos posibles y ninguno inventado:
 *
 *  · `lat` y `lng` → la ubicación que la persona ha autorizado. Se ordena por distancia real y se
 *    dice «a 3,2 km». Las coordenadas se usan para esta consulta y se descartan: no se guardan.
 *  · `destino` → una ciudad (la elegida en la búsqueda o la última buscada). Se ordena por ese
 *    destino y NO se muestra ninguna distancia, porque no hay ninguna que medir.
 *  · sin nada de lo anterior → una selección del catálogo, que se enseña como «Descubre…» y nunca
 *    como «cerca de ti».
 *
 * Siempre devuelve las dos listas (alojamientos y experiencias), con un máximo de 13 cada una, y
 * solo lo que existe: si hay menos, se devuelven los que haya.
 */
export async function GET(request: Request) {
  const excedido = limitar(request, "/api/cerca", 60, 60);
  if (excedido) return excedido;

  const p = new URL(request.url).searchParams;
  // OJO: `Number(null)` es 0, así que sin coordenadas esto pasaba la validación como si fuera el
  // punto (0, 0) —en el golfo de Guinea— y la sección decía «a 50 m» de sitios que estaban a
  // kilómetros. Hay que comprobar que los parámetros EXISTEN, no solo que son números.
  const latTxt = p.get("lat");
  const lngTxt = p.get("lng");
  const lat = Number(latTxt);
  const lng = Number(lngTxt);
  const hayTexto = (v: string | null): v is string => v !== null && v.trim() !== "";
  const coordenadasValidas =
    hayTexto(latTxt) &&
    hayTexto(lngTxt) &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  const destino = (p.get("destino") ?? "").trim().slice(0, 80);

  const punto = coordenadasValidas ? { lat, lng } : undefined;
  let modo: RespuestaCerca["modo"] = punto ? "punto" : destino ? "destino" : "descubre";

  try {
    let [aloj, expe, serv] = await Promise.all([
      alojamientosCerca({ punto, destino: punto ? undefined : destino }, MAXIMO),
      experienciasCerca({ punto, destino: punto ? undefined : destino }, MAXIMO),
      serviciosCerca(punto, punto ? undefined : destino, MAXIMO),
    ]);

    /* Si el punto está lejísimos de todo el catálogo, «cerca de ti» no significa nada y enseñar
       «a 3.900 km» sería ridículo. Pasa cuando alguien navega desde fuera de España o cuando el
       navegador devuelve una posición falsa (0,0, en el golfo de Guinea, es el caso típico). En ese
       caso se cambia al destino elegido o a la selección del catálogo, y NO se enseña distancia. */
    const LEJOS_M = 500_000; // 500 km
    if (modo === "punto" && (aloj.cercaniaMetros === null || aloj.cercaniaMetros > LEJOS_M)) {
      modo = destino ? "destino" : "descubre";
      [aloj, expe] = await Promise.all([
        alojamientosCerca({ destino }, MAXIMO),
        experienciasCerca({ destino }, MAXIMO),
      ]);
      serv = await serviciosCerca(undefined, destino, MAXIMO);
    }

    const sesion = await getCurrentUser();
    const guardados = sesion
      ? [...(await guardadosEntre(Number(sesion.id), "alojamiento", aloj.items.map((t) => t.id)))]
      : [];

    const respuesta: RespuestaCerca = {
      modo,
      etiqueta: modo === "destino" ? destino : null,
      alojamientos: aloj.items,
      experiencias: expe,
      servicios: serv.items,
      guardados,
      haySesion: Boolean(sesion),
      totales: { alojamientos: aloj.total, experiencias: expe.length, servicios: serv.total },
    };
    return NextResponse.json(respuesta, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[hestiat] /api/cerca", error instanceof Error ? error.message.slice(0, 160) : error);
    return NextResponse.json(
      { modo, etiqueta: null, alojamientos: [], experiencias: [], servicios: [], guardados: [], haySesion: false, totales: { alojamientos: 0, experiencias: 0, servicios: 0 } },
      { status: 200 },
    );
  }
}
