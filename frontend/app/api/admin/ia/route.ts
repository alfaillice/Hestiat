import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth.server";
import { pool, poolLegacy } from "@/lib/db";
import { limitar } from "@/lib/limite.server";
import { configIA, estadoIA, ejecutarAgente, guardarMensaje, historialConversacion, crearConversacion, probarConexion } from "@/lib/ia.server";
import { catalogoHerramientas, ejecutarHerramienta } from "@/lib/ia-herramientas.server";
import { comprobarLimites, configAutonomia, consumoDeHoy, registrarAccion } from "@/lib/ia-auditoria.server";
import { borradoresPendientes, enviarAprobado, enviadosHoy, LIMITE_ENVIOS_DIA } from "@/lib/ia-correo.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API de administración del AI Manager.
 *
 * Es una única puerta, y está cerrada a cal y canto: sin sesión de administración responde 403 y no
 * ejecuta nada. El agente (el modelo) NUNCA entra por aquí directamente: entra el equipo de Hestiat,
 * y el agente solo actúa a través de las herramientas, que comprueban permisos por su cuenta.
 */
export async function POST(request: Request) {
  // Límite propio de esta ruta, además del de cada herramienta.
  const excedido = limitar(request, "/api/admin/ia", 60, 60);
  if (excedido) return excedido;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Solo administración." }, { status: 403 });
  }

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const accion = String(cuerpo.accion ?? "estado");

  try {
    if (accion === "estado") {
      const [estado, consumo, autonomia, limites] = await Promise.all([
        estadoIA(),
        consumoDeHoy(),
        configAutonomia(),
        comprobarLimites(),
      ]);
      const configurada = configIA().configurada;
      const [conteos] = await pool.query<any[]>(
        `SELECT
           (SELECT COUNT(*) FROM ia_conversacion) AS conversaciones,
           (SELECT COUNT(*) FROM lead) AS leads,
           (SELECT COUNT(*) FROM ticket WHERE estado NOT IN ('RESOLVED','CLOSED')) AS tickets_abiertos,
           (SELECT COUNT(*) FROM ticket) AS tickets,
           (SELECT COUNT(*) FROM ia_campana WHERE estado IN ('borrador','pendiente_aprobacion')) AS campanas_borrador,
           (SELECT COUNT(*) FROM email_exclusion) AS exclusiones`,
      );
      const pendientes = await borradoresPendientes(5);
      const [acciones] = await poolLegacy.query<any[]>(
        `SELECT accion, entidad, entidad_id, detalle, creado_en FROM admin_auditoria
          WHERE accion LIKE 'ia:%' ORDER BY id DESC LIMIT 25`,
      );
      const [porModelo] = await pool.query<any[]>(
        `SELECT modelo, COUNT(*) AS llamadas, SUM(tokens_entrada) AS te, SUM(tokens_salida) AS ts,
                ROUND(SUM(coste_estimado), 4) AS coste
           FROM ia_consumo WHERE creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY modelo ORDER BY coste DESC`,
      );
      return NextResponse.json({
        ok: true,
        estado_modelo: estado,
        consumo_hoy: consumo,
        limites,
        autonomia,
        conteos: conteos[0] ?? {},
        pendientes_resumen: pendientes.length,
        actividad: acciones.map((a) => ({
          accion: String(a.accion).replace(/^ia:/, ""),
          entidad: a.entidad,
          entidad_id: a.entidad_id,
          detalle: a.detalle,
          cuando: a.creado_en,
        })),
        consumo_30_dias: porModelo,
        configurada,
      });
    }

    if (accion === "herramientas") {
      const autonomia = await configAutonomia();
      return NextResponse.json({ ok: true, herramientas: catalogoHerramientas(), autonomia });
    }

    if (accion === "probar") {
      const r = await probarConexion();
      await registrarAccion({
        accion: "prueba_conexion",
        usuarioId: admin.id,
        usuarioEmail: admin.email,
        detalle: { ok: r.ok, detalle: r.detalle.slice(0, 200) },
      });
      return NextResponse.json({ ok: r.ok, resultado: r.detalle, modelo: r.modelo ?? null });
    }

    if (accion === "chat") {
      const mensaje = String(cuerpo.mensaje ?? "").trim();
      if (!mensaje) return NextResponse.json({ ok: false, error: "Escribe algo." }, { status: 400 });
      if (mensaje.length > 6000) return NextResponse.json({ ok: false, error: "El mensaje es demasiado largo." }, { status: 400 });

      let conversacionId = cuerpo.conversacionId ? Number(cuerpo.conversacionId) : null;
      if (!conversacionId) {
        conversacionId = await crearConversacion({
          usuarioId: admin.id,
          canal: "admin",
          titulo: mensaje.slice(0, 120),
        });
      }
      const historial = await historialConversacion(conversacionId);
      await guardarMensaje(conversacionId, "usuario", mensaje);

      const r = await ejecutarAgente({
        mensaje,
        historial,
        ctx: {
          usuarioId: admin.id,
          usuarioEmail: admin.email,
          canal: "admin",
          autorizadoPor: cuerpo.autorizadoPor ? String(cuerpo.autorizadoPor).slice(0, 120) : null,
        },
        potente: Boolean(cuerpo.potente),
        conversacionId,
      });

      if (r.respuesta) await guardarMensaje(conversacionId, "asistente", r.respuesta);
      await registrarAccion({
        accion: "conversacion",
        usuarioId: admin.id,
        usuarioEmail: admin.email,
        entidad: "ia_conversacion",
        entidadId: conversacionId,
        detalle: {
          ok: r.ok,
          modelo: r.modelo ?? null,
          pasos: r.pasos.length,
          herramientas: r.pasos.filter((p) => p.tipo === "herramienta").map((p) => p.herramienta),
          coste: r.costeTotal ?? 0,
          error: r.error ?? null,
        },
      });
      return NextResponse.json({
        ok: r.ok,
        conversacionId,
        respuesta: r.respuesta,
        pasos: r.pasos,
        modelo: r.modelo ?? null,
        coste_estimado: r.costeTotal ?? 0,
        motivo: r.motivo ?? null,
        error: r.error ?? null,
      });
    }

    if (accion === "herramienta") {
      // Ejecutar una herramienta directamente desde la consola (para pruebas y tareas sueltas).
      const nombre = String(cuerpo.herramienta ?? "");
      const argumentos = (cuerpo.argumentos ?? {}) as Record<string, unknown>;
      const r = await ejecutarHerramienta(nombre, argumentos, {
        usuarioId: admin.id,
        usuarioEmail: admin.email,
        canal: "admin",
        autorizadoPor: cuerpo.autorizadoPor ? String(cuerpo.autorizadoPor).slice(0, 120) : null,
      });
      return NextResponse.json({ ok: r.ok, resultado: r.resultado ?? null, error: r.error ?? null, nivel: r.nivel });
    }

    if (accion === "autonomia") {
      const cambios: Array<[string, string]> = [];
      if (cuerpo.nivel_autonomia !== undefined) {
        const n = Number(cuerpo.nivel_autonomia);
        if (![1, 2, 3].includes(n)) return NextResponse.json({ ok: false, error: "El nivel debe ser 1, 2 o 3." }, { status: 400 });
        cambios.push(["nivel_autonomia", String(n)]);
      }
      if (cuerpo.envios_requieren_aprobacion !== undefined) {
        cambios.push(["envios_requieren_aprobacion", cuerpo.envios_requieren_aprobacion ? "1" : "0"]);
      }
      if (cuerpo.limite_llamadas_por_hora !== undefined) {
        cambios.push(["limite_llamadas_por_hora", String(Math.max(1, Number(cuerpo.limite_llamadas_por_hora) || 120))]);
      }
      if (cuerpo.limite_gasto_diario_usd !== undefined) {
        cambios.push(["limite_gasto_diario_usd", String(Math.max(0, Number(cuerpo.limite_gasto_diario_usd) || 5))]);
      }
      if (cambios.length === 0) return NextResponse.json({ ok: false, error: "No hay ningún cambio." }, { status: 400 });

      for (const [clave, valor] of cambios) {
        await pool.query(
          `INSERT INTO ia_config (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
          [clave, valor],
        );
      }
      await registrarAccion({
        accion: "cambio_autonomia",
        usuarioId: admin.id,
        usuarioEmail: admin.email,
        entidad: "ia_config",
        detalle: Object.fromEntries(cambios),
      });
      return NextResponse.json({ ok: true, autonomia: await configAutonomia() });
    }

    if (accion === "pendientes") {
      const borradores = await borradoresPendientes(50);
      const [campanas] = await pool.query<any[]>(
        `SELECT id, nombre, objetivo, estado, asunto, creada_por, creada_en FROM ia_campana
          WHERE estado IN ('borrador','pendiente_aprobacion') ORDER BY id DESC LIMIT 30`,
      );
      return NextResponse.json({
        ok: true,
        borradores,
        campanas,
        enviados_hoy: await enviadosHoy(),
        limite_envios_dia: LIMITE_ENVIOS_DIA,
        nota: "Nada de esto se ha enviado. El correo comercial solo sale con la aprobación de un administrador.",
      });
    }

    if (accion === "aprobar_envio") {
      const contactoId = Number(cuerpo.contactoId);
      if (!Number.isFinite(contactoId) || contactoId <= 0) {
        return NextResponse.json({ ok: false, error: "Falta el borrador." }, { status: 400 });
      }
      const r = await enviarAprobado(contactoId, admin.email);
      return NextResponse.json({ ok: r.ok, motivo: r.motivo ?? null, detalle: r.detalle ?? null });
    }

    return NextResponse.json({ ok: false, error: `Acción no reconocida: ${accion}` }, { status: 400 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error interno.";
    console.error("[hestiat] /api/admin/ia", accion, mensaje);
    await registrarAccion({ accion: "error_api", usuarioEmail: admin.email, detalle: { accion, error: mensaje.slice(0, 300) } });
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
