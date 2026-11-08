import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { lanzarLote, reanudarUltimoLote, situacion, type TipoCatalogo } from "@/lib/enriquecimiento.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Solo se exportan los métodos HTTP: cualquier otro export en un route puede confundir al enrutador
   (era la causa de que el POST se quedara sin respuesta). La lógica vive en `ejecutar`. */
const TIPOS = ["experience", "service", "accommodation"];
const MAX_LOTE = 200;
const ACCIONES = ["lote", "reanudar", "situacion"];

interface Peticion {
  tipo?: string;
  limite?: string | number;
  desde?: string | number;
  forzar?: string | boolean;
  accion?: string;
}

/**
 * Lanzador del motor de enriquecimiento. POST es la vía definitiva; GET se mantiene solo para
 * consultar el estado (`accion=situacion`), que no modifica nada.
 *
 * Valida, en este orden: permisos (solo administración), catalog_type, acción, tamaño de lote
 * (1–200) y punto de partida. Devuelve siempre batch_id, status, cantidad solicitada y procesada.
 */
async function ejecutar(datos: Peticion) {
  const usuario = await getCurrentUser();
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ ok: false, status: "denegado", error: "Solo un administrador puede lanzar lotes de enriquecimiento." }, { status: 403 });
  }

  const tipo = String(datos.tipo ?? "");
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ ok: false, status: "invalido", error: "catalog_type no válido.", permitidos: TIPOS }, { status: 400 });
  }
  const accion = String(datos.accion ?? "lote");
  if (!ACCIONES.includes(accion)) {
    return NextResponse.json({ ok: false, status: "invalido", error: "Acción no válida.", permitidas: ACCIONES }, { status: 400 });
  }
  const limite = datos.limite === undefined ? 25 : Number(datos.limite);
  if (!Number.isFinite(limite) || limite < 1 || limite > MAX_LOTE) {
    return NextResponse.json({ ok: false, status: "invalido", error: `El tamaño del lote debe estar entre 1 y ${MAX_LOTE}.` }, { status: 400 });
  }
  const desde = Math.max(0, Number(datos.desde ?? 0) || 0);
  const forzar = datos.forzar === true || datos.forzar === "1";

  try {
    if (accion === "situacion") {
      return NextResponse.json({ ok: true, status: "consulta", catalog_type: tipo, situacion: await situacion(tipo as TipoCatalogo) });
    }
    const resumen = accion === "reanudar"
      ? await reanudarUltimoLote(tipo as TipoCatalogo, { limite })
      : await lanzarLote(tipo as TipoCatalogo, { desde, limite, forzar, usuarioId: Number(usuario.id) });
    if (!resumen) {
      return NextResponse.json({ ok: true, status: "nada_que_reanudar", batch_id: null, cantidad_solicitada: 0, cantidad_procesada: 0 });
    }
    return NextResponse.json({
      ok: true,
      status: resumen.estado_final ?? "terminado",
      batch_id: resumen.lote,
      catalog_type: resumen.tipo,
      cantidad_solicitada: resumen.procesadas,
      cantidad_procesada: resumen.procesadas,
      desde: resumen.desde,
      hasta: resumen.hasta,
      resumen,
    });
  } catch (error) {
    const motivo = error instanceof Error ? error.message.slice(0, 300) : "error desconocido";
    console.error("[hestiat] enriquecimiento:", motivo);
    return NextResponse.json({ ok: false, status: "error", error: "El lote no ha podido completarse.", detalle: motivo }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/enriquecimiento", 20, 60);
  if (excedido) return excedido;
  const tipoContenido = request.headers.get("content-type") ?? "";
  const datos: Peticion = {};
  try {
    if (tipoContenido.includes("application/json")) {
      Object.assign(datos, (await request.json()) as Peticion);
    } else {
      const formulario = await request.formData();
      for (const [clave, valor] of formulario.entries()) {
        (datos as Record<string, string>)[clave] = String(valor);
      }
    }
  } catch {
    return NextResponse.json({ ok: false, status: "invalido", error: "El cuerpo de la petición no se entiende." }, { status: 400 });
  }
  return ejecutar(datos);
}

export async function GET(request: Request) {
  const excedido = limitar(request, "/api/enriquecimiento", 20, 60);
  if (excedido) return excedido;
  const p = new URL(request.url).searchParams;
  const accion = p.get("accion") ?? "situacion";
  // Por GET solo se consulta. Lanzar o reanudar un lote modifica datos: eso va por POST.
  if (accion !== "situacion") {
    return NextResponse.json({ ok: false, status: "metodo_no_permitido", error: "Para lanzar o reanudar un lote usa POST." }, { status: 405 });
  }
  return ejecutar({ tipo: p.get("tipo") ?? undefined, accion });
}
