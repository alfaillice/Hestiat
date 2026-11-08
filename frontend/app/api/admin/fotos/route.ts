import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";
import {
  subirFoto,
  marcarPrincipal,
  reordenar,
  eliminarFoto,
  fotosDe,
  type TipoPublicacion,
} from "@/lib/fotos-gestor.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FOTOGRAFÍAS DE UNA PUBLICACIÓN — GESTIÓN, SOLO ADMINISTRADOR.
 *
 * ── SEGURIDAD, LA PARTE QUE NO SE NEGOCIA ───────────────────────────────────────────────────────
 * · La puerta la cierra el SERVIDOR con `requireAdmin`, no el formulario: entrar por URL directa
 *   no sirve de nada.
 * · El tipo de archivo se decide por sus BYTES DE CABECERA, no por lo que declare el navegador.
 * · Se rechaza lo que no sea imagen admitida, lo vacío y lo que pase de tamaño.
 * · El nombre del archivo lo genera el almacén: nunca se usa un nombre puesto por quien sube.
 * · Las credenciales de R2 no salen de aquí: las maneja el almacén, en el servidor.
 * · Una imagen compartida por otras publicaciones NO se borra del almacén.
 *
 *   GET    ?tipo=&item=                          → lista las fotos
 *   POST   (multipart: tipo, item, archivo, alt) → sube una
 *   PATCH  (json: tipo, item, accion 'principal'|'orden')  → principal u orden
 *   DELETE (json: tipo, item, foto)              → elimina una
 */
const TIPOS = ["alojamiento", "experiencia", "servicio"] as const;

function tipoValido(v: unknown): TipoPublicacion | null {
  const t = String(v ?? "");
  return (TIPOS as readonly string[]).includes(t) ? (t as TipoPublicacion) : null;
}

function idValido(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Datos del administrador para la auditoría, sin suponer la forma exacta de la sesión. */
function quienDe(u: unknown): { usuarioId: number | null; usuarioEmail: string | null } {
  const s = u as { id?: unknown; email?: unknown; correo?: unknown };
  const id = Number(s?.id);
  const email = typeof s?.email === "string" ? s.email : typeof s?.correo === "string" ? s.correo : null;
  return { usuarioId: Number.isInteger(id) && id > 0 ? id : null, usuarioEmail: email };
}

export async function GET(request: Request) {
  const sesion = await requireAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const tipo = tipoValido(sp.get("tipo"));
  const item = idValido(sp.get("item"));
  if (!tipo || !item) return NextResponse.json({ ok: false, error: "Falta el tipo o el identificador." }, { status: 400 });

  return NextResponse.json({ ok: true, fotos: await fotosDe(tipo, item) });
}

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/admin/fotos", 60, 60);
  if (excedido) return excedido;
  const sesion = await requireAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene el formato esperado." }, { status: 400 });
  }

  const tipo = tipoValido(formulario.get("tipo"));
  const item = idValido(formulario.get("item"));
  const archivo = formulario.get("archivo");
  if (!tipo || !item) return NextResponse.json({ ok: false, error: "Falta el tipo o el identificador." }, { status: 400 });
  if (!(archivo instanceof File)) return NextResponse.json({ ok: false, error: "No ha llegado ningún archivo." }, { status: 400 });

  const alt = formulario.get("alt");
  const res = await subirFoto({
    tipo,
    itemId: item,
    archivo,
    alt: typeof alt === "string" && alt.trim() ? alt.trim().slice(0, 200) : null,
    quien: quienDe(sesion),
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

export async function PATCH(request: Request) {
  const sesion = await requireAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

  let cuerpo: { tipo?: unknown; item?: unknown; accion?: unknown; foto?: unknown; ids?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene el formato esperado." }, { status: 400 });
  }
  const tipo = tipoValido(cuerpo.tipo);
  const item = idValido(cuerpo.item);
  if (!tipo || !item) return NextResponse.json({ ok: false, error: "Falta el tipo o el identificador." }, { status: 400 });

  if (cuerpo.accion === "principal") {
    const foto = idValido(cuerpo.foto);
    if (!foto) return NextResponse.json({ ok: false, error: "Falta la fotografía." }, { status: 400 });
    const ok = await marcarPrincipal(tipo, item, foto, quienDe(sesion));
    return NextResponse.json({ ok, fotos: await fotosDe(tipo, item) });
  }
  if (cuerpo.accion === "orden") {
    const ids = Array.isArray(cuerpo.ids)
      ? cuerpo.ids.map(idValido).filter((n): n is number => n !== null)
      : [];
    if (ids.length === 0) return NextResponse.json({ ok: false, error: "No hay orden que guardar." }, { status: 400 });
    await reordenar(tipo, item, ids, quienDe(sesion));
    return NextResponse.json({ ok: true, fotos: await fotosDe(tipo, item) });
  }
  return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const sesion = await requireAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

  let cuerpo: { tipo?: unknown; item?: unknown; foto?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene el formato esperado." }, { status: 400 });
  }
  const tipo = tipoValido(cuerpo.tipo);
  const item = idValido(cuerpo.item);
  const foto = idValido(cuerpo.foto);
  if (!tipo || !item || !foto) return NextResponse.json({ ok: false, error: "Faltan datos para eliminar." }, { status: 400 });

  const res = await eliminarFoto(tipo, item, foto, quienDe(sesion));
  return NextResponse.json({ ...res, fotos: await fotosDe(tipo, item) }, { status: res.ok ? 200 : 400 });
}
