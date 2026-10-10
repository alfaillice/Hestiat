import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import { NextResponse } from "next/server";
import { buscarExperiencias } from "@/lib/experiencias.server";
import { buscarServicios } from "@/lib/servicios.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Siguiente tanda del catálogo público, para el scroll infinito.
 *
 * Paginación por CURSOR: en `tras` viaja el identificador de la última ficha ya mostrada y se
 * devuelven las siguientes a esa. Nunca hay repetidas ni saltos, y no se carga todo de golpe.
 *
 * Devuelve exactamente los campos que pinta la tarjeta, ya resueltos con la capa común
 * (original o enriquecido), para que la primera pantalla y las siguientes sean idénticas.
 */
const LIMITE_MAX = 48;

export async function GET(request: Request) {
  const excedido = limitar(request, "/api/catalogo/lista", 240, 60);
  if (excedido) return excedido;

  const p = new URL(request.url).searchParams;
  // El tipo se acepta en inglés y en español. Antes cualquier valor que no fuese exactamente
  // «service» caía en experiencias SIN avisar: un tipo mal escrito devolvía datos equivocados con
  // respuesta correcta. Ahora un valor no reconocido es un error explícito.
  const tipoCrudo = (p.get("tipo") ?? "").trim().toLowerCase();
  const TIPOS_VALIDOS: Record<string, "service" | "experience"> = {
    service: "service",
    servicio: "service",
    servicios: "service",
    servicio_turistico: "service",
    experience: "experience",
    experiencia: "experience",
    experiencias: "experience",
  };
  const tipo = tipoCrudo === "" ? "experience" : TIPOS_VALIDOS[tipoCrudo];
  if (!tipo) {
    return NextResponse.json(
      { ok: false, error: "Tipo de catálogo no válido. Usa «experiencia» o «servicio»." },
      { status: 400 },
    );
  }
  const tras = Math.max(0, Number(p.get("tras") ?? 0) || 0);
  const limite = Math.min(Math.max(Number(p.get("limite") ?? 24) || 24, 1), LIMITE_MAX);
  const q = (p.get("q") ?? "").trim();
  const categoria = (p.get("categoria") ?? "").trim() || undefined;
  const subcategoria = (p.get("subcategoria") ?? "").trim() || undefined;
  const provincia = (p.get("provincia") ?? "").trim() || undefined;

  try {
    const listado = tipo === "service"
      ? await buscarServicios({ q, categoria, provincia, desde: tras, porPagina: limite })
      : await buscarExperiencias({ q, categoria, subcategoria, provincia, desde: tras, porPagina: limite });
    const ultimo = listado.items.length > 0 ? listado.items[listado.items.length - 1].id : null;
    const hayMas = listado.items.length === limite && ultimo !== null;
    // Qué está guardado de esta tanda: así las tarjetas que añade el scroll salen con el corazón
    // en su estado real y no todas vacías.
    const sesionLista = await getCurrentUser();
    const guardados = sesionLista
      ? [...(await guardadosEntre(Number(sesionLista.id), tipo === "service" ? "servicio" : "experiencia", listado.items.map((i) => i.id)))]
      : [];
    return NextResponse.json({
      ok: true,
      tipo,
      total: listado.total,
      items: listado.items,
      guardados,
      mostrados: listado.items.length,
      // Si no viene lleno, se acabó: no se pide una tanda más para descubrirlo.
      siguiente: hayMas ? ultimo : null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "No se ha podido leer el catálogo." }, { status: 500 });
  }
}
