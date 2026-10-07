import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { permisoEdicion, previsualizarPrecio } from "@/lib/editor.server";
import { limitar } from "@/lib/limite.server";
import type { ParametrosPrecio } from "@/lib/precio.server";

export const dynamic = "force-dynamic";

/**
 * Vista previa del precio de una estancia para el editor.
 *
 * No calcula nada por su cuenta: llama a la misma función que usa la reserva
 * (`calcularDesglose`), de modo que lo que se ve aquí es exactamente lo que se cobrará.
 * Exige permiso de edición: no es un precio público, es la simulación del anfitrión.
 */
export async function POST(request: Request) {
  const limitado = limitar(request, "precio-preview", 120, 60);
  if (limitado) return limitado;

  let cuerpo: any = {};
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const legacyId = Number(cuerpo?.legacyId);
  const noches = Math.min(365, Math.max(1, Number(cuerpo?.noches) || 1));
  const huespedes = Math.max(1, Number(cuerpo?.huespedes) || 1);

  const sesion = await getCurrentUser();
  const permiso = Number.isInteger(legacyId) ? await permisoEdicion(sesion ?? null, legacyId) : { puede: false };
  if (!permiso.puede) return NextResponse.json({ ok: false, error: "Sin permiso." }, { status: 403 });

  // Valores sin guardar: son los que el anfitrión está escribiendo. Se pasan a la misma función,
  // que es lo que evita que la vista previa y la reserva real se separen con el tiempo.
  const v = cuerpo?.valores ?? {};
  const num = (x: unknown): number | null => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const valores: Partial<ParametrosPrecio> = {
    precioNoche: num(v.precioNoche) ?? 0,
    limpieza: num(v.limpieza),
    tasas: num(v.tasas),
    impuestosPct: num(v.impuestosPct),
    precioHuespedExtra: num(v.precioHuespedExtra),
    huespedesIncluidos: num(v.capacidad),
    descuentoSemanal: num(v.descuentoSemanal),
    descuentoMensual: num(v.descuentoMensual),
    estanciaMinima: num(v.estanciaMinima),
    estanciaMaxima: num(v.estanciaMaxima),
  };

  const desglose = await previsualizarPrecio(legacyId, noches, huespedes, valores);
  if (!desglose) return NextResponse.json({ ok: false, error: "Alojamiento no encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true, desglose }, { headers: { "Cache-Control": "private, no-store" } });
}
