import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { alternarFavorito, esTipoValido, favoritosDe, favoritosPorTipo, TIPOS_FAVORITO } from "@/lib/favoritos.server";
import type { TipoFavorito } from "@/lib/favoritos.server";
import { limitar } from "@/lib/limite.server";

export const dynamic = "force-dynamic";

/**
 * Favoritos: guardar o quitar un elemento de la lista del usuario. UN SOLO SISTEMA para alojamientos,
 * experiencias y servicios; el tipo forma parte de la identificación porque los identificadores
 * numéricos pueden coincidir entre categorías.
 *
 * Exige sesión: sin sesión la respuesta lo dice (401) en vez de fingir que se ha guardado. Acepta
 * formulario y JSON. Se mantiene el campo antiguo `accommodationId` por compatibilidad: si llega sin
 * tipo, se entiende que es un alojamiento.
 */
function leer(entrada: unknown): { tipo: TipoFavorito | null; itemId: number } {
  const o = (entrada ?? {}) as Record<string, unknown>;
  const bruto = o.tipo ?? (o.accommodationId !== undefined ? "alojamiento" : undefined);
  const idBruto = o.itemId ?? o.accommodationId;
  return { tipo: esTipoValido(bruto) ? bruto : null, itemId: Number(idBruto) };
}

export async function POST(request: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) {
    return NextResponse.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });
  }
  const limitado = limitar(request, "favoritos", 90, 60);
  if (limitado) return limitado;

  let entrada: unknown = null;
  const tipoCabecera = request.headers.get("content-type") ?? "";
  try {
    if (tipoCabecera.includes("application/json")) {
      entrada = await request.json();
    } else {
      const formulario = await request.formData();
      entrada = Object.fromEntries(formulario.entries());
    }
  } catch {
    entrada = null;
  }

  const { tipo, itemId } = leer(entrada);
  if (!tipo) return NextResponse.json({ ok: false, motivo: "tipo-no-valido" }, { status: 400 });
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ ok: false, motivo: "elemento-no-valido" }, { status: 400 });
  }

  const guardado = await alternarFavorito(Number(sesion.id), tipo, itemId);
  return NextResponse.json({ ok: true, guardado, tipo, itemId });
}

/** Lista de ids guardados. Con `?tipo=` devuelve ese tipo; sin él, los tres. */
export async function GET(request: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });
  const pedido = new URL(request.url).searchParams.get("tipo");
  if (pedido) {
    if (!esTipoValido(pedido)) return NextResponse.json({ ok: false, motivo: "tipo-no-valido" }, { status: 400 });
    const ids = await favoritosDe(Number(sesion.id), pedido);
    return NextResponse.json({ ok: true, tipo: pedido, ids });
  }
  const porTipo = await favoritosPorTipo(Number(sesion.id));
  return NextResponse.json({
    ok: true,
    tipos: TIPOS_FAVORITO,
    porTipo,
    // Compatibilidad con lo que ya existía: `ids` eran los alojamientos.
    ids: porTipo.alojamiento,
  });
}
