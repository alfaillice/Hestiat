/**
 * CORREO COMERCIAL DEL AGENTE — SOLO SERVIDOR.
 *
 * REGLA DE ORO: aquí NADA se envía solo. El agente redacta y deja el borrador; una persona lo
 * aprueba, y solo entonces sale UN correo individual. No hay ninguna función que envíe en masa.
 *
 * Antes de enviar se comprueban cuatro cosas, y si falla cualquiera, no se envía:
 *   1. Que el borrador exista y siga sin enviar (no se envía dos veces lo mismo).
 *   2. Que quien aprueba sea de verdad una persona con rol de administración en Hestiat.
 *   3. Que la dirección no esté en la lista de exclusión ni el contacto marcado como excluido.
 *   4. Que no se supere el límite de envíos del día.
 *
 * Se reutiliza el mismo correo que ya usa Hestiat para las reservas (`enviarCorreo`): un solo
 * camino de salida, una sola configuración.
 */
import { pool } from "@/lib/db";
import { enviarCorreo } from "@/lib/correo.server";
import { registrarAccion } from "@/lib/ia-auditoria.server";
import { estaExcluido, excluirEmail } from "@/lib/ia-datos.server";

export const LIMITE_ENVIOS_DIA = Number(process.env.IA_LIMITE_ENVIOS_DIA ?? 20);

export async function borradoresPendientes(limite = 30) {
  const [filas] = await pool.query<any[]>(
    `SELECT c.id, c.lead_id, c.asunto, c.creado_en, c.autor,
            l.empresa, l.email, l.localidad, l.estado, l.excluido
       FROM lead_contacto c
       JOIN \`lead\` l ON l.id = c.lead_id
      WHERE c.resultado IS NULL AND c.canal = 'email'
      ORDER BY c.id DESC LIMIT ?`,
    [Math.min(Math.max(limite, 1), 100)],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    lead_id: Number(f.lead_id),
    empresa: f.empresa,
    email: f.email,
    localidad: f.localidad,
    asunto: f.asunto,
    redactado_por: f.autor,
    redactado_en: f.creado_en,
    contacto_excluido: Number(f.excluido) === 1,
  }));
}

export async function enviadosHoy(): Promise<number> {
  const [filas] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM lead_contacto WHERE resultado = 'enviado' AND enviado_en >= CURDATE()`,
  );
  return Number(filas[0]?.n ?? 0);
}

/**
 * Cancela un correo redactado que todavía no ha salido. Es la otra cara de la aprobación: si algo no
 * debe enviarse, se deja constancia de que se ha descartado, con quién lo decidió.
 */
export async function cancelarBorrador(contactoId: number, quien: string) {
  const [filas] = await pool.query<any[]>(
    `SELECT id, resultado FROM lead_contacto WHERE id = ? LIMIT 1`,
    [contactoId],
  );
  const c = filas[0];
  if (!c) return { ok: false as const, motivo: "no existe ese correo" };
  if (c.resultado === "enviado") return { ok: false as const, motivo: "ese correo ya se envió: no se puede cancelar" };
  await pool.query(
    `UPDATE lead_contacto SET resultado = 'cancelado', aprobado_por = ? WHERE id = ?`,
    [`cancelado por ${quien}`.slice(0, 120), contactoId],
  );
  await registrarAccion({
    accion: "envio_cancelado",
    usuarioEmail: quien,
    entidad: "lead_contacto",
    entidadId: contactoId,
    detalle: { motivo: "cancelado antes de enviarse" },
  });
  return { ok: true as const };
}

/** Comprueba quién autoriza: tiene que ser un administrador real de Hestiat. */
async function esAdmin(email: string): Promise<boolean> {
  const [filas] = await pool.query<any[]>(
    `SELECT u.id FROM usuario u WHERE LOWER(u.email) = LOWER(?) AND u.rol = 'admin' AND u.activo = 1 LIMIT 1`,
    [email.trim()],
  );
  return filas.length > 0;
}

export interface ResultadoEnvio {
  ok: boolean;
  motivo?: string;
  detalle?: string;
}

/** Envía UN correo ya redactado, con aprobación humana explícita. */
export async function enviarAprobado(contactoId: number, aprobadoPor: string): Promise<ResultadoEnvio> {
  const [filas] = await pool.query<any[]>(
    `SELECT c.*, l.email AS lead_email, l.empresa, l.excluido, l.estado
       FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id WHERE c.id = ? LIMIT 1`,
    [contactoId],
  );
  const c = filas[0];
  if (!c) return { ok: false, motivo: "no existe ese borrador" };
  if (c.resultado === "enviado") return { ok: false, motivo: "ese correo ya se envió: no se repite" };
  if (c.canal !== "email") return { ok: false, motivo: "ese registro no es un correo" };

  const autorizador = String(aprobadoPor ?? "").trim();
  if (!autorizador) {
    return { ok: false, motivo: "falta quién autoriza el envío (aprobadoPor)" };
  }
  if (!(await esAdmin(autorizador))) {
    await registrarAccion({
      accion: "envio_rechazado_autorizador",
      usuarioEmail: autorizador,
      entidad: "lead_contacto",
      entidadId: contactoId,
      detalle: { motivo: "quien autoriza no es administrador de Hestiat" },
    });
    return { ok: false, motivo: "quien autoriza no es un administrador de Hestiat" };
  }

  const destino = String(c.lead_email ?? "").trim();
  if (!destino) return { ok: false, motivo: "el contacto no tiene email" };
  if (Number(c.excluido) === 1) return { ok: false, motivo: "el contacto está marcado como excluido" };
  if (await estaExcluido(destino)) return { ok: false, motivo: "esa dirección está en la lista de exclusión" };

  const yaEnviados = await enviadosHoy();
  if (yaEnviados >= LIMITE_ENVIOS_DIA) {
    return { ok: false, motivo: `límite de ${LIMITE_ENVIOS_DIA} envíos al día alcanzado (hoy: ${yaEnviados})` };
  }

  const cuerpo = String(c.cuerpo ?? "");
  const texto =
    `${cuerpo}\n\n—\nHestiat\nhola@hestiat.com · https://hestiat.com\n` +
    "Si no quieres recibir más mensajes nuestros, responde a este correo con la palabra BAJA y no volveremos a escribirte.";

  const res = await enviarCorreo({
    para: destino,
    asunto: String(c.asunto ?? "Hestiat"),
    texto,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">${cuerpo
      .split("\n")
      .map((l: string) => `<p>${l.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch] as string)}</p>`)
      .join("")}<hr><p style="font-size:12.5px;color:#666">Hestiat · hola@hestiat.com · https://hestiat.com<br>Si no quieres recibir más mensajes nuestros, responde con la palabra BAJA.</p></div>`,
    responderA: "hola@hestiat.com",
  });

  if (!res.ok) {
    await pool.query(`UPDATE lead_contacto SET resultado = 'cancelado' WHERE id = ?`, [contactoId]);
    await registrarAccion({
      accion: "envio_fallido",
      usuarioEmail: autorizador,
      entidad: "lead_contacto",
      entidadId: contactoId,
      detalle: { motivo: res.motivo, detalle: res.detalle ?? null },
    });
    return { ok: false, motivo: res.motivo === "sin_smtp" ? "el servidor de correo no está configurado" : "el servidor de correo ha fallado", detalle: res.detalle };
  }

  await pool.query(
    `UPDATE lead_contacto SET resultado = 'enviado', enviado_en = NOW(), aprobado_por = ? WHERE id = ?`,
    [autorizador.slice(0, 120), contactoId],
  );
  // La aprobación queda también en el propio correo, para medir «aprobados» y «enviados» aparte.
  await pool.query(`UPDATE lead_contacto SET revisado_por = ?, revisado_en = NOW() WHERE id = ?`, [autorizador.slice(0, 120), contactoId]);
  // El lead avanza por la vía oficial: con el evento real (el envío) y dejando rastro en el historial.
  const { cambiarEstado } = await import("@/lib/captacion.server");
  const cambio = await cambiarEstado(Number(c.lead_id), "CONTACTED", {
    motivo: "Correo aprobado y enviado",
    responsable: autorizador,
    evento: "envio_real",
  });
  if (!cambio.ok) console.error("[hestiat] el envío se hizo pero el estado no avanzó:", cambio.motivo);
  await registrarAccion({
    accion: "email_comercial_enviado",
    usuarioEmail: autorizador,
    entidad: "lead_contacto",
    entidadId: contactoId,
    detalle: { para: destino, asunto: String(c.asunto ?? "").slice(0, 120), aprobado_por: autorizador },
  });
  return { ok: true };
}

/** Registra un rebote: el contacto deja de recibir y la dirección entra en exclusión. */
export async function registrarRebote(contactoId: number, detalle: string) {
  const [filas] = await pool.query<any[]>(
    `SELECT c.id, l.email FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id WHERE c.id = ? LIMIT 1`,
    [contactoId],
  );
  const c = filas[0];
  if (!c) return { ok: false as const, motivo: "no existe ese envío" };
  await pool.query(`UPDATE lead_contacto SET resultado = 'rebotado' WHERE id = ?`, [contactoId]);
  if (c.email) await excluirEmail(String(c.email), `Rebote: ${detalle}`.slice(0, 160), "rebote");
  await registrarAccion({
    accion: "rebote_registrado",
    entidad: "lead_contacto",
    entidadId: contactoId,
    detalle: { email: c.email, detalle: detalle.slice(0, 200) },
  });
  return { ok: true as const };
}
