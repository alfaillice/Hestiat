import { NextResponse } from "next/server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RECEPTOR DE CORE WEB VITALS.
 *
 * Recibe los tres números que mide `components/vitales.tsx` (LCP, CLS, INP) y la ruta, y los deja en
 * el registro del servidor. No se guarda ningún dato personal: ni IP, ni identificador, ni cookie.
 * La IP solo se usa para el límite de peticiones en memoria, que no se escribe en ningún sitio.
 *
 * Rango válido de cada métrica (fuera de eso se descarta, para no ensuciar la medida con valores
 * imposibles):
 *   LCP 0-60.000 ms · CLS 0-10 · INP 0-60.000 ms
 */
const RUTAS_VALIDAS = /^\/[A-Za-z0-9\-_/.?=&%]*$/;

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/vitales", 120, 60);
  if (excedido) return excedido;

  let datos: { ruta?: unknown; lcp?: unknown; cls?: unknown; inp?: unknown; pantalla?: unknown; conexion?: unknown };
  try {
    datos = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const numero = (v: unknown, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const ruta = String(datos.ruta ?? "").slice(0, 120);
  const lcp = numero(datos.lcp, 60_000);
  const cls = numero(datos.cls, 10);
  const inp = numero(datos.inp, 60_000);
  const pantalla = String(datos.pantalla ?? "").slice(0, 20);
  const conexion = String(datos.conexion ?? "").slice(0, 12);

  if (!RUTAS_VALIDAS.test(ruta) || lcp === null || cls === null || inp === null) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log(`[vitales] ruta=${ruta} lcp=${lcp}ms cls=${cls} inp=${inp}ms pantalla=${pantalla} red=${conexion || "-"}`);
  return new NextResponse(null, { status: 204 });
}
