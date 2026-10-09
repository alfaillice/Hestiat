import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";
import { registrarRespuesta } from "@/lib/captacion.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * REGISTRO DE RESPUESTAS REALES DE CORREO.
 *
 * Para qué: cuando alguien contesta a un correo, el seguimiento tiene que pararse o avanzar según lo
 * que haya dicho. Esto es la puerta por la que entra esa información.
 *
 * Quién puede usarla:
 *   · una persona con sesión de administración (desde el CRM);
 *   · un proveedor de correo o un automatismo, SOLO si el administrador ha configurado un secreto
 *     compartido en el entorno (CORREO_WEBHOOK_TOKEN) y lo envía correctamente.
 * Si no hay secreto configurado, la puerta queda cerrada a los automatismos: solo administración.
 *
 * Lo que NO hace: inventar aperturas ni clics. Aquí solo se registra lo que alguien ha enviado.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/correo/respuesta", 60, 60);
  if (excedido) return excedido;

  const url = new URL(request.url);
  const tokenRecibido = request.headers.get("x-hestiat-token") ?? url.searchParams.get("token") ?? "";
  const tokenEsperado = (process.env.CORREO_WEBHOOK_TOKEN ?? "").trim();
  const autorizadoPorToken = tokenEsperado.length > 0 && tokenRecibido === tokenEsperado;

  let quien = "webhook:correo";
  if (!autorizadoPorToken) {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Solo administración, o un secreto compartido válido (CORREO_WEBHOOK_TOKEN sin configurar)." },
        { status: 403 },
      );
    }
    quien = admin.email;
  }

  let cuerpo: Record<string, unknown> = {};
  const tipoContenido = request.headers.get("content-type") ?? "";
  try {
    if (tipoContenido.includes("application/json")) cuerpo = (await request.json()) as Record<string, unknown>;
    else {
      const fd = await request.formData();
      cuerpo = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const email = String(cuerpo.email ?? "").trim();
  const tipo = String(cuerpo.tipo ?? "").trim();
  const TIPOS = ["interesado", "no_interesado", "baja", "pregunta", "rebote", "otro"];
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Falta la dirección que ha respondido." }, { status: 400 });
  }
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ ok: false, error: `Tipo no válido. Admite: ${TIPOS.join(", ")}` }, { status: 400 });
  }

  const r = await registrarRespuesta({
    email,
    tipo: tipo as "interesado" | "no_interesado" | "baja" | "pregunta" | "rebote" | "otro",
    asunto: cuerpo.asunto ? String(cuerpo.asunto) : null,
    extracto: cuerpo.extracto ? String(cuerpo.extracto) : null,
    fuente: cuerpo.fuente ? String(cuerpo.fuente) : "webhook",
    responsable: quien,
  });

  return NextResponse.json({
    ...r,
    ok: true,
    nota: r.seguimientoDetenido
      ? "Seguimiento detenido para esta dirección y añadida a la lista de exclusión."
      : "Respuesta registrada.",
  });
}
