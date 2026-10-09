import { NextResponse } from "next/server";
import { buscar } from "@/lib/db";
import type { FiltrosBusqueda } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import { limitar } from "@/lib/limite.server";

export const dynamic = "force-dynamic";

/**
 * Página siguiente de la galería, para el scroll infinito.
 *
 * Devuelve exactamente la misma forma que la primera carga del servidor (misma función de
 * traducción), de modo que las tarjetas que se añaden al hacer scroll son idénticas a las iniciales
 * y la cuadrícula no cambia de aspecto a mitad de página.
 */
const TANDA = 42; // 6 columnas × 7 filas, como pide el diseño

export async function GET(request: Request) {
  const limitado = limitar(request, "buscar", 180, 60);
  if (limitado) return limitado;

  const url = new URL(request.url);

  const uno = (k: string) => url.searchParams.get(k) ?? undefined;
  const num = (k: string) => {
    const x = Number(uno(k));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const orden = uno("orden");
  // «cerca=lat,lng»: si viene, la tanda siguiente del scroll se ordena igual, por distancia real.
  const punto = (uno("cerca") ?? "").split(",");
  const lat = Number(punto[0]);
  const lng = Number(punto[1]);
  const cerca =
    punto.length === 2 && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : undefined;
  const filtros: FiltrosBusqueda = {
    q: (uno("q") ?? "").trim(),
    provincia: uno("provincia"),
    precioMin: num("precioMin"),
    precioMax: num("precioMax"),
    servicios: url.searchParams.getAll("servicios"),
    orden: orden === "precio_asc" || orden === "precio_desc" ? orden : "recomendados",
    cerca,
    pagina: Math.max(1, Number(uno("p")) || 1),
    porPagina: TANDA,
  };

  const { total, items, pagina, porPagina } = await buscar(filtros);
  const tarjetas = items.map((i) => aTarjeta(i as unknown as Record<string, unknown>));
  const siguiente = pagina * porPagina < total ? pagina + 1 : null;

  // Si hay sesión, se devuelve también cuáles de estas tarjetas ya están guardadas: si no, al
  // llegar por scroll aparecerían con el corazón vacío aunque estuvieran en favoritos.
  const sesion = await getCurrentUser();
  const guardados = sesion
    ? [...(await guardadosEntre(Number(sesion.id), "alojamiento", tarjetas.map((t) => t.id)))]
    : [];

  return NextResponse.json(
    { ok: true, total, pagina, porPagina, siguiente, tarjetas, guardados },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
