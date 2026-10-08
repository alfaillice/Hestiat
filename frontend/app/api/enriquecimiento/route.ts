import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { lanzarLote, reanudarUltimoLote, situacion, type TipoCatalogo } from "@/lib/enriquecimiento.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS: TipoCatalogo[] = ["experience", "service", "accommodation"];

/**
 * Lanzador del motor de enriquecimiento. SOLO administración.
 *
 * Por qué una ruta y no un botón: los lotes se lanzan desde el servidor (o, más adelante, desde el
 * panel) y aquí queda todo el control: quién lo lanzó, cuántas fichas, desde dónde y con qué
 * resultado. No toca ningún dato original: escribe en las tablas del motor.
 *
 *   POST /api/enriquecimiento  { tipo, limite, desde, forzar, accion }
 *   GET  /api/enriquecimiento?tipo=experience&limite=50&accion=situacion
 *
 * `accion`: lote (por defecto) · reanudar · situacion.
 */
async function procesar(request: Request, params: URLSearchParams, cuerpo?: FormData) {
  const usuario = await getCurrentUser();
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede lanzar lotes de enriquecimiento." }, { status: 403 });
  }
  const valor = (clave: string) => String(cuerpo?.get(clave) ?? params.get(clave) ?? "");
  const tipo = (valor("tipo") || "experience") as TipoCatalogo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ ok: false, error: "Tipo de catálogo no válido." }, { status: 400 });
  }
  const accion = valor("accion") || "lote";
  const limite = Number(valor("limite") || 50);
  const desde = Number(valor("desde") || 0);
  const forzar = valor("forzar") === "1";

  try {
    if (accion === "situacion") {
      return NextResponse.json({ ok: true, tipo, situacion: await situacion(tipo) });
    }
    if (accion === "reanudar") {
      const resumen = await reanudarUltimoLote(tipo, { limite });
      return NextResponse.json({ ok: true, reanudado: Boolean(resumen), resumen });
    }
    const resumen = await lanzarLote(tipo, { desde, limite, forzar, usuarioId: Number(usuario.id) });
    return NextResponse.json({ ok: true, resumen });
  } catch (error) {
    const motivo = error instanceof Error ? error.message.slice(0, 300) : "error desconocido";
    console.error("[hestiat] enriquecimiento:", motivo);
    return NextResponse.json({ ok: false, error: "El lote no ha podido completarse.", detalle: motivo }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/enriquecimiento", 20, 60);
  if (excedido) return excedido;
  const cuerpo = await request.formData().catch(() => undefined);
  return procesar(request, new URL(request.url).searchParams, cuerpo);
}

export async function GET(request: Request) {
  const excedido = limitar(request, "/api/enriquecimiento", 20, 60);
  if (excedido) return excedido;
  return procesar(request, new URL(request.url).searchParams);
}
