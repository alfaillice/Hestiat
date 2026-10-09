import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth.server";
import { pool, poolLegacy } from "@/lib/db";
import { limitar } from "@/lib/limite.server";
import { configIA, estadoIA, ejecutarAgente, guardarMensaje, historialConversacion, crearConversacion, probarConexion } from "@/lib/ia.server";
import { catalogoHerramientas, ejecutarHerramienta } from "@/lib/ia-herramientas.server";
import { comprobarLimites, configAutonomia, consumoDeHoy, registrarAccion } from "@/lib/ia-auditoria.server";
import { borradoresPendientes, enviarAprobado, enviadosHoy, LIMITE_ENVIOS_DIA } from "@/lib/ia-correo.server";
import { cancelarBorrador } from "@/lib/ia-correo.server";
import { actualizarLead, crearLead, crearTicket, actualizarTicket, excluirEmail, obtenerLead, registrarContactoLead, buscarCoincidenciasLead, extraerDominio } from "@/lib/ia-datos.server";
import { PLANTILLAS, personalizar, plantillaDe } from "@/lib/ia-plantillas.server";

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

  // La consola y el CRM usan formularios normales (funcionan sin JavaScript): se acepta tanto JSON
  // como datos de formulario. Sin esto, un envío desde el navegador llegaría vacío.
  let cuerpo: Record<string, unknown> = {};
  const tipoContenido = request.headers.get("content-type") ?? "";
  if (tipoContenido.includes("application/x-www-form-urlencoded") || tipoContenido.includes("multipart/form-data")) {
    try {
      const formulario = await request.formData();
      cuerpo = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    } catch {
      return NextResponse.json({ ok: false, error: "Formulario no válido." }, { status: 400 });
    }
  } else {
    try {
      cuerpo = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
    }
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
        // OJO: `Number(x) || 5` convertía un 0 en 5 (el 0 es falsy), así que poner el presupuesto a
        // cero no bloqueaba nada. Detectado al probar el control de gasto. Con `Number.isFinite` se
        // respeta el 0, que es justo el valor que sirve para cortar el gasto.
        const valorGasto = Number(cuerpo.limite_gasto_diario_usd);
        cambios.push(["limite_gasto_diario_usd", String(Number.isFinite(valorGasto) ? Math.max(0, valorGasto) : 5)]);
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

    /**
     * ACCIONES DEL CRM Y DE TICKETS DESDE EL PANEL.
     *
     * Vienen de formularios normales, así que responden con una redirección RELATIVA a la página de
     * la que salieron (nunca absoluta: detrás del proxy una dirección absoluta apuntaría al servidor
     * interno y rompería la navegación). El resultado se cuenta en la propia página con `aviso`.
     * Toda acción queda en la auditoría, con quién la hizo.
     */
    if (accion.startsWith("crm_") || accion.startsWith("ticket_")) {
      const volver = String(cuerpo.volver ?? "");
      const responde = (ok: boolean, aviso: string) => {
        if (volver.startsWith("/")) {
          const sep = volver.includes("?") ? "&" : "?";
          return new NextResponse(null, {
            status: 303,
            headers: { location: `${volver}${sep}ok=${ok ? 1 : 0}&aviso=${encodeURIComponent(aviso.slice(0, 300))}` },
          });
        }
        return NextResponse.json({ ok, aviso });
      };

      if (accion === "crm_crear") {
        const empresa = String(cuerpo.empresa ?? "").trim();
        if (!empresa) return responde(false, "Hace falta el nombre del negocio.");
        const email = String(cuerpo.email ?? "").trim();
        const web = String(cuerpo.web ?? "").trim();
        const localidad = String(cuerpo.localidad ?? "").trim();
        const coincidencias = await buscarCoincidenciasLead({
          email: email || null,
          dominio: web ? extraerDominio(web) : email ? extraerDominio(email) : null,
          empresa,
          localidad: localidad || null,
        });
        if (coincidencias.length > 0) {
          return responde(false, `Ya existe un potencial cliente (${coincidencias[0].por}, #${coincidencias[0].leadId}): no se ha duplicado.`);
        }
        const r = await crearLead({
          empresa,
          tipoNegocio: String(cuerpo.tipo_negocio ?? "otro"),
          localidad: localidad || null,
          provincia: String(cuerpo.provincia ?? "").trim() || null,
          pais: String(cuerpo.pais ?? "").trim() || "España",
          web: web || null,
          email: email || null,
          telefono: String(cuerpo.telefono ?? "").trim() || null,
          contactoNombre: String(cuerpo.contacto_nombre ?? "").trim() || null,
          notas: String(cuerpo.notas ?? "").trim() || null,
          fuente: "manual",
          responsable: admin.email,
        });
        await registrarAccion({ accion: "crm_crear", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "lead", entidadId: r.id, detalle: { empresa, localidad } });
        return responde(true, `Creado el potencial cliente #${r.id}.`);
      }

      if (accion === "crm_actualizar") {
        const id = Number(cuerpo.id);
        if (!Number.isFinite(id) || id <= 0) return responde(false, "Falta el cliente.");
        const cambios: Record<string, unknown> = {};
        for (const campo of ["estado", "notas", "responsable", "email", "telefono", "web"]) {
          if (cuerpo[campo] !== undefined) cambios[campo] = String(cuerpo[campo]);
        }
        cambios.excluido = cuerpo.excluido === "1" ? 1 : 0;
        if (cuerpo.excluido === "1") cambios.estado = "OPT_OUT";
        const r = await actualizarLead(id, cambios, admin.email);
        await registrarAccion({ accion: "crm_actualizar", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "lead", entidadId: id, detalle: cambios });
        return responde(r.ok, r.ok ? "Ficha actualizada." : (r.motivo ?? "No se pudo actualizar."));
      }

      if (accion === "crm_preparar_email") {
        const id = Number(cuerpo.id);
        const plantilla = plantillaDe(String(cuerpo.plantilla ?? ""));
        const lead = await obtenerLead(id);
        if (!lead) return responde(false, "No existe ese potencial cliente.");
        if (!plantilla) return responde(false, "Esa plantilla no existe.");
        if (Number(lead.excluido) === 1) return responde(false, "Ese contacto está excluido: no se le prepara ningún correo.");
        if (!lead.email) return responde(false, "Ese cliente no tiene email registrado.");
        const { asunto, cuerpo: texto } = personalizar(plantilla, {
          empresa: lead.empresa,
          localidad: lead.localidad,
          contacto: lead.contacto_nombre,
        });
        await registrarContactoLead({
          leadId: id,
          canal: "email",
          asunto,
          cuerpo: texto,
          resultado: null,
          autor: admin.email,
        });
        await registrarAccion({ accion: "crm_preparar_email", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "lead", entidadId: id, detalle: { plantilla: plantilla.id, asunto } });
        return responde(true, "Correo redactado y pendiente de aprobación. NO se ha enviado.");
      }

      if (accion === "crm_baja") {
        const id = Number(cuerpo.id);
        const lead = await obtenerLead(id);
        if (!lead) return responde(false, "No existe ese potencial cliente.");
        if (!lead.email) return responde(false, "Ese cliente no tiene email registrado.");
        await excluirEmail(String(lead.email), "Ha pedido no recibir comunicaciones", "usuario");
        await actualizarLead(id, { estado: "OPT_OUT", excluido: 1 }, admin.email);
        await registrarAccion({ accion: "crm_baja", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "lead", entidadId: id, detalle: { email: lead.email } });
        return responde(true, "Dado de baja: no se le volverá a escribir.");
      }

      if (accion === "crm_cancelar_envio") {
        const contactoId = Number(cuerpo.contactoId);
        const r = await cancelarBorrador(contactoId, admin.email);
        return responde(r.ok, r.ok ? "Correo cancelado." : (r.motivo ?? "No se pudo cancelar."));
      }

      if (accion === "ticket_crear") {
        const asunto = String(cuerpo.asunto ?? "").trim();
        if (!asunto) return responde(false, "Hace falta el asunto.");
        const r = await crearTicket({
          asunto,
          categoria: String(cuerpo.categoria ?? "otro"),
          prioridad: String(cuerpo.prioridad ?? "normal"),
          mensaje: String(cuerpo.mensaje ?? "").trim() || null,
          contactoEmail: String(cuerpo.contacto_email ?? "").trim() || null,
          contactoNombre: String(cuerpo.contacto_nombre ?? "").trim() || null,
          usuarioId: admin.id,
          autor: admin.email,
        });
        await registrarAccion({ accion: "ticket_crear", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "ticket", entidadId: r.codigo, detalle: { asunto, categoria: r.categoria, prioridad: r.prioridad } });
        return responde(true, `Incidencia ${r.codigo} creada.`);
      }

      if (accion === "ticket_actualizar") {
        const codigo = String(cuerpo.codigo ?? "").trim();
        if (!codigo) return responde(false, "Falta el identificador de la incidencia.");
        const r = await actualizarTicket(codigo, {
          estado: cuerpo.estado ? String(cuerpo.estado) : undefined,
          prioridad: cuerpo.prioridad ? String(cuerpo.prioridad) : undefined,
          responsable: cuerpo.responsable !== undefined ? String(cuerpo.responsable) : undefined,
          resolucion: cuerpo.resolucion !== undefined ? String(cuerpo.resolucion) : undefined,
          mensaje: cuerpo.mensaje ? String(cuerpo.mensaje) : undefined,
          autor: admin.email,
        });
        await registrarAccion({ accion: "ticket_actualizar", usuarioId: admin.id, usuarioEmail: admin.email, entidad: "ticket", entidadId: codigo, detalle: { ok: r.ok } });
        return responde(r.ok, r.ok ? "Incidencia actualizada." : (r.motivo ?? "No se pudo actualizar."));
      }
    }

    return NextResponse.json({ ok: false, error: `Acción no reconocida: ${accion}` }, { status: 400 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error interno.";
    console.error("[hestiat] /api/admin/ia", accion, mensaje);
    await registrarAccion({ accion: "error_api", usuarioEmail: admin.email, detalle: { accion, error: mensaje.slice(0, 300) } });
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
