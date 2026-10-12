import { NextResponse } from "next/server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RECEPTOR DE IMPRESIONES DE PUBLICIDAD.
 *
 * Recibe UNA línea por anuncio que se ha mostrado de verdad en la pantalla de un visitante, y la
 * deja en el registro del servidor. Sirve para lo único que se puede medir honestamente desde la
 * web: **cuántas veces se ha mostrado cada bloque, en qué tipo de página y en qué ruta**.
 *
 * ── LO QUE NO SE PUEDE MEDIR DESDE AQUÍ, Y POR QUÉ ──────────────────────────────────────────────
 * · **Clics**: instrumentar los clics en un anuncio está prohibido por la política de AdSense. Se
 *   consultan en el panel de AdSense, que es su fuente legítima.
 * · **Ingresos**: son datos de la cuenta de Google, no del sitio. Solo existen en AdSense.
 * Por eso este receptor no inventa ninguna de las dos cosas: mide impresiones y nada más.
 *
 * ── PRIVACIDAD ──────────────────────────────────────────────────────────────────────────────────
 * No se guarda IP, ni identificador, ni cookie, ni dato de la persona: solo el identificador del
 * hueco, el tipo de página y la ruta. La IP se usa únicamente para el límite de peticiones en
 * memoria, que no se escribe en ningún sitio.
 */
const HUECOS_VALIDOS = /^[a-z0-9-]{3,40}$/;
const TIPOS_VALIDOS = /^[a-z0-9-]{3,30}$/;
const RUTAS_VALIDAS = /^\/[A-Za-z0-9\-_/.?=&%]*$/;

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/impresion-anuncio", 240, 60);
  if (excedido) return excedido;

  let datos: { hueco?: unknown; tipo?: unknown; ruta?: unknown };
  try {
    datos = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const hueco = typeof datos.hueco === "string" ? datos.hueco : "";
  const tipo = typeof datos.tipo === "string" ? datos.tipo : "";
  const ruta = typeof datos.ruta === "string" ? datos.ruta : "";

  if (!HUECOS_VALIDOS.test(hueco) || !TIPOS_VALIDOS.test(tipo) || !RUTAS_VALIDAS.test(ruta)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Una línea por impresión. Sin datos personales: hueco, tipo de página y ruta.
  console.log(`[anuncios] impresion hueco=${hueco} tipo=${tipo} ruta=${ruta.slice(0, 120)}`);
  return NextResponse.json({ ok: true });
}
