import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";
import {
  activarCanal,
  conectarCanal,
  desconectarCanal,
  puedeGestionar,
  renombrarCanal,
  sincronizarCanal,
  CANALES,
  type Canal,
} from "@/lib/canales.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calendarios externos por iCalendar — conectar, sincronizar, pausar, renombrar y desconectar.
 *
 * La lógica (validación de la URL, descarga con límites, parser de VEVENT, importación a
 * `disponibilidad`) es la que ya existía, sin reescribir. Lo único que cambia es quién puede:
 * el anfitrión **dueño del alojamiento o un administrador**, porque el editor es el mismo para los
 * dos. Se comprueba aquí y otra vez dentro de cada función.
 */
type Cuerpo = {
  accion: "conectar" | "sincronizar" | "desconectar" | "activar" | "desactivar" | "renombrar";
  alojamientoId: number;
  canal: string;
  url?: string;
  nombre?: string;
};

export async function POST(request: Request) {
  const limitado = limitar(request, "/api/canales", 40, 60);
  if (limitado) return limitado;

  let cuerpo: Cuerpo;
  try {
    cuerpo = (await request.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401 });

  const alojamientoId = Number(cuerpo.alojamientoId);
  const canal = cuerpo.canal as Canal;
  if (!Number.isFinite(alojamientoId) || alojamientoId <= 0 || !CANALES.includes(canal)) {
    return NextResponse.json({ ok: false, error: "Datos no válidos." }, { status: 400 });
  }
  if (!(await puedeGestionar(Number(sesion.id), alojamientoId))) {
    return NextResponse.json({ ok: false, error: "Ese alojamiento no es tuyo." }, { status: 403 });
  }

  try {
    const usuarioId = Number(sesion.id);
    if (cuerpo.accion === "conectar") {
      const url = String(cuerpo.url ?? "").trim();
      if (!url) return NextResponse.json({ ok: false, error: "Pega la dirección del calendario del canal." }, { status: 400 });
      const r = await conectarCanal(usuarioId, alojamientoId, canal, url);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (cuerpo.accion === "sincronizar") {
      const r = await sincronizarCanal(usuarioId, alojamientoId, canal);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (cuerpo.accion === "desconectar") {
      const r = await desconectarCanal(usuarioId, alojamientoId, canal);
      return NextResponse.json(r, { status: r.ok ? 200 : 403 });
    }
    if (cuerpo.accion === "activar" || cuerpo.accion === "desactivar") {
      const r = await activarCanal(usuarioId, alojamientoId, canal, cuerpo.accion === "activar");
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (cuerpo.accion === "renombrar") {
      const r = await renombrarCanal(usuarioId, alojamientoId, canal, String(cuerpo.nombre ?? ""));
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error interno.";
    console.error("[hestiat] /api/canales", cuerpo.accion, mensaje);
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
