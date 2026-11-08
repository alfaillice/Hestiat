import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";
import { bloquear, liberar, nochesDelMes } from "@/lib/calendario.server";

export const dynamic = "force-dynamic";

/**
 * Disponibilidad del alojamiento desde el editor: consultar un mes, bloquear y desbloquear noches.
 *
 * Reutiliza la lógica que ya existía (`bloquear`, `liberar`, `nochesDelMes`) en vez de reimplementar
 * el calendario. La autorización vive en esas funciones (dueño **o** administrador) y aquí no se
 * duplica: si el usuario no puede, se devuelve su mismo error.
 *
 * `liberar` nunca toca noches de una reserva ni de un calendario externo —eso lo garantiza la
 * consulta de `calendario.server`—, así que desde aquí es imposible dejar sin efecto una reserva.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) {
    return NextResponse.json({ ok: false, error: "Alojamiento no válido." }, { status: 400 });
  }
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401 });

  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ ok: false, error: "Mes no válido (formato AAAA-MM)." }, { status: 400 });
  }

  try {
    const noches = await nochesDelMes(legacyId, mes);
    return NextResponse.json({ ok: true, mes, noches }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[hestiat] disponibilidad GET", legacyId, mes, error);
    return NextResponse.json({ ok: false, error: "No se ha podido leer la disponibilidad." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) {
    return NextResponse.json({ ok: false, error: "Alojamiento no válido." }, { status: 400 });
  }

  const limitado = limitar(request, "disponibilidad-editor", 120, 60);
  if (limitado) return limitado;

  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401 });

  let cuerpo: { accion?: string; fechas?: unknown } = {};
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const accion = String(cuerpo.accion ?? "");
  const fechas = Array.isArray(cuerpo.fechas) ? cuerpo.fechas.map(String) : [];
  if (fechas.length === 0) return NextResponse.json({ ok: false, error: "No has seleccionado ninguna noche." }, { status: 400 });
  if (fechas.length > 120) return NextResponse.json({ ok: false, error: "Demasiadas noches de una vez (máximo 120)." }, { status: 400 });

  try {
    const r =
      accion === "bloquear"
        ? await bloquear(Number(sesion.id), legacyId, fechas)
        : accion === "liberar"
          ? await liberar(Number(sesion.id), legacyId, fechas)
          : { ok: false, hechas: 0, omitidas: 0, error: "Acción no reconocida." };
    return NextResponse.json(r, { status: r.ok ? 200 : 403 });
  } catch (error) {
    console.error("[hestiat] disponibilidad POST", legacyId, accion, error);
    return NextResponse.json({ ok: false, error: "No se ha podido aplicar el cambio." }, { status: 500 });
  }
}
