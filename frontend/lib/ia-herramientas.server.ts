/**
 * HERRAMIENTAS DEL AGENTE — SOLO SERVIDOR.
 *
 * El modelo NUNCA toca la base de datos: solo puede pedir estas herramientas, y cada una valida
 * sus argumentos, comprueba el nivel de autonomía y deja rastro en la auditoría. Todo el SQL va
 * parametrizado dentro de `ia-datos.server.ts`.
 *
 * NIVELES (política de autonomía, configurable en `ia_config`)
 *   1 · lectura      consultar publicaciones, FAQ, ayudas, leads, tickets, estadísticas
 *   2 · preparación  redactar correos y preparar cambios SIN ejecutarlos (quedan pendientes)
 *   3 · ejecución    escribir de verdad (crear/actualizar lead, ticket, bajas)
 *
 * Además, cada herramienta declara si es SENSIBLE. Una herramienta sensible solo se ejecuta si la
 * petición trae una confirmación explícita con la persona que la autoriza; y esa persona queda
 * registrada en la auditoría. Hoy son sensibles las que envían correo o tocan publicaciones.
 *
 * LO QUE EL AGENTE NO PUEDE HACER, Y NO ES NEGOCIABLE
 *   · SQL libre · leer secretos · cambiar sus permisos · desactivar la auditoría · saltarse la
 *   autenticación · borrar en masa · enviar campañas sin aprobación · modificar o eliminar una
 *   publicación (eso exige ser el titular acreditado, y no se hace desde una conversación).
 */
import {
  actualizarLead,
  actualizarTicket,
  buscarLeads,
  buscarPublicaciones,
  crearLead,
  crearTicket,
  excluirEmail,
  estaExcluido,
  estadisticasCampana,
  estadoEmail,
  obtenerLead,
  obtenerPublicacion,
  obtenerTicket,
  registrarContactoLead,
  yaEstaPublicado,
  type TipoPublicacion,
} from "@/lib/ia-datos.server";
import { ARTICULOS_AYUDA, buscarArticulos, buscarPreguntas } from "@/lib/conocimiento";
import { registrarAccion, configAutonomia, type Nivel } from "@/lib/ia-auditoria.server";

export interface ContextoHerramienta {
  usuarioId?: number | null;
  usuarioEmail?: string | null;
  canal: "admin" | "soporte" | "crm" | "operaciones";
  /** Confirmación explícita para acciones sensibles: quién la autoriza. */
  autorizadoPor?: string | null;
}

export interface Herramienta {
  nombre: string;
  descripcion: string;
  nivel: Nivel;
  sensible: boolean;
  parametros: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
    additionalProperties: false;
  };
  ejecutar: (args: Record<string, unknown>, ctx: ContextoHerramienta) => Promise<unknown>;
}

const TIPOS: TipoPublicacion[] = ["alojamiento", "experiencia", "servicio"];

export const HERRAMIENTAS: Herramienta[] = [
  {
    nombre: "search_publications",
    descripcion:
      "Busca en el catálogo de Hestiat (alojamientos, experiencias y servicios) por texto y provincia. Devuelve un resumen con localidad, precio tal como se muestra en la web y si está publicado. No inventa precios: si no hay precio, devuelve «Consultar».",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        q: { type: "string", description: "Texto a buscar: nombre del negocio, ciudad o parte del nombre" },
        tipo: { type: "string", description: "Limitar a una familia", enum: TIPOS },
        provincia: { type: "string", description: "Provincia exacta, por ejemplo «Alicante»" },
        limite: { type: "string", description: "Cuántos resultados devolver (1-25, por defecto 10)" },
      },
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const items = await buscarPublicaciones({
        q: args.q ? String(args.q).slice(0, 120) : undefined,
        tipo: TIPOS.includes(args.tipo as TipoPublicacion) ? (args.tipo as TipoPublicacion) : undefined,
        provincia: args.provincia ? String(args.provincia).slice(0, 80) : undefined,
        limite: args.limite ? Number(args.limite) : undefined,
      });
      return { total: items.length, resultados: items };
    },
  },
  {
    nombre: "get_publication",
    descripcion:
      "Devuelve la ficha completa de una publicación concreta (alojamiento, experiencia o servicio), con los datos que hay publicados de verdad: localidad, capacidad, precio tal como se muestra, número de fotos, procedencia del dato y estado. No incluye datos que no estén ya publicados.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        tipo: { type: "string", description: "Familia de la publicación", enum: TIPOS },
        id: { type: "string", description: "Identificador de la publicación" },
      },
      required: ["tipo", "id"],
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      if (!TIPOS.includes(args.tipo as TipoPublicacion)) throw new Error("tipo no válido");
      const p = await obtenerPublicacion(args.tipo as TipoPublicacion, Number(args.id));
      if (!p) return { encontrada: false, nota: "No existe ninguna publicación con ese identificador." };
      return { encontrada: true, publicacion: p };
    },
  },
  {
    nombre: "search_public_faq",
    descripcion:
      "Busca en las preguntas frecuentes públicas de Hestiat. Úsala para dudas generales (precios «Consultar» y «orientativo», fotos, de dónde salen los datos, cómo reservar, si publicar cuesta dinero).",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: { consulta: { type: "string", description: "La duda del usuario, con sus palabras" } },
      required: ["consulta"],
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const encontradas = buscarPreguntas(String(args.consulta ?? ""), 5);
      return { total: encontradas.length, preguntas: encontradas.map((p) => ({ pregunta: p.q, respuesta: p.a })) };
    },
  },
  {
    nombre: "get_help_article",
    descripcion:
      "Devuelve el artículo de ayuda de Hestiat que mejor encaja con la consulta (publicar gratis, cómo reservar, registro y acceso, editar una publicación, cancelaciones, fotos y datos, reclamar una ficha, problemas técnicos, contacto, avisos legales). Incluye el enlace a la página real.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: { consulta: { type: "string", description: "El tema que quiere resolver el usuario" } },
      required: ["consulta"],
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const articulos = buscarArticulos(String(args.consulta ?? ""), 3);
      if (articulos.length === 0) {
        return {
          total: 0,
          articulos: [],
          nota: "No hay ningún artículo que encaje. Se puede enseñar el índice completo o pasar el caso a una persona.",
          indice: ARTICULOS_AYUDA.map((a) => a.titulo),
        };
      }
      return {
        total: articulos.length,
        articulos: articulos.map((a) => ({
          titulo: a.titulo,
          resumen: a.resumen,
          fuente: a.fuente,
          informacion_pendiente_de_cerrar: Boolean(a.pendiente),
        })),
      };
    },
  },
  {
    nombre: "search_leads",
    descripcion: "Busca potenciales clientes (CRM) por texto, estado o localidad. Solo devuelve contactos profesionales ya registrados.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        q: { type: "string", description: "Nombre, email o web" },
        estado: {
          type: "string",
          description: "Estado del CRM",
          enum: ["DETECTED", "RESEARCHED", "CONTACT_READY", "CONTACTED", "REPLIED", "INTERESTED", "REGISTERED", "PUBLISHED", "NOT_INTERESTED", "OPT_OUT", "INVALID"],
        },
        localidad: { type: "string", description: "Localidad exacta" },
      },
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const items = await buscarLeads({
        q: args.q ? String(args.q).slice(0, 120) : undefined,
        estado: args.estado ? String(args.estado) : undefined,
        localidad: args.localidad ? String(args.localidad).slice(0, 120) : undefined,
      });
      return { total: items.length, clientes: items };
    },
  },
  {
    nombre: "get_lead",
    descripcion: "Devuelve la ficha de un potencial cliente con su historial de contactos.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: { id: { type: "string", description: "Identificador del potencial cliente" } },
      required: ["id"],
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const l = await obtenerLead(Number(args.id));
      return l ? { encontrado: true, cliente: l } : { encontrado: false, nota: "No existe ese potencial cliente." };
    },
  },
  {
    nombre: "create_lead",
    descripcion:
      "Registra un potencial cliente en el CRM. Antes de crearlo comprueba si ya existe (mismo email, mismo dominio o mismo nombre y localidad) y también si el negocio ya está publicado en Hestiat: si ya está, NO lo crea y lo dice. No se inventan datos de contacto: solo se guarda lo que se aporte.",
    nivel: 3,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        empresa: { type: "string", description: "Nombre del negocio" },
        tipo_negocio: { type: "string", description: "Familia", enum: ["alojamiento", "experiencia", "servicio", "otro"] },
        localidad: { type: "string", description: "Localidad" },
        provincia: { type: "string", description: "Provincia" },
        pais: { type: "string", description: "País (por defecto España)" },
        web: { type: "string", description: "Página web, si se conoce" },
        email: { type: "string", description: "Email profesional, si se conoce" },
        telefono: { type: "string", description: "Teléfono profesional, si se conoce" },
        contacto_nombre: { type: "string", description: "Persona de contacto, si se conoce" },
        notas: { type: "string", description: "Notas internas" },
        fuente: { type: "string", description: "De dónde sale", enum: ["catalogo", "reclamacion", "solicitud", "manual", "agente", "web"] },
      },
      required: ["empresa"],
      additionalProperties: false,
    },
    ejecutar: async (args, ctx) => {
      const empresa = String(args.empresa ?? "").trim();
      const publicado = await yaEstaPublicado({ nombre: empresa, localidad: args.localidad ? String(args.localidad) : null });
      if (publicado.publicado) {
        return {
          creado: false,
          motivo: "Ese negocio ya tiene publicación en Hestiat",
          coincidencias: publicado.coincidencias,
          nota: "No se crea como potencial cliente: ya está publicado.",
        };
      }
      const r = await crearLead({
        empresa,
        tipoNegocio: args.tipo_negocio ? String(args.tipo_negocio) : "otro",
        localidad: args.localidad ? String(args.localidad) : null,
        provincia: args.provincia ? String(args.provincia) : null,
        pais: args.pais ? String(args.pais) : "España",
        web: args.web ? String(args.web) : null,
        email: args.email ? String(args.email) : null,
        telefono: args.telefono ? String(args.telefono) : null,
        contactoNombre: args.contacto_nombre ? String(args.contacto_nombre) : null,
        notas: args.notas ? String(args.notas) : null,
        fuente: args.fuente ? String(args.fuente) : "agente",
        responsable: ctx.usuarioEmail ?? null,
      });
      return r.coincidencias.length > 0
        ? { creado: false, motivo: "Ya existía un potencial cliente muy parecido; no se ha duplicado.", cliente_id: r.id, coincidencias: r.coincidencias }
        : { creado: true, cliente_id: r.id };
    },
  },
  {
    nombre: "update_lead",
    descripcion:
      "Actualiza campos de un potencial cliente (estado del CRM, notas, responsable, datos de contacto conocidos, exclusión). No permite borrar ni vaciar datos sin decirlo: solo cambia los campos que se indiquen, y deja el cambio en el historial.",
    nivel: 3,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identificador del potencial cliente" },
        estado: {
          type: "string",
          description: "Nuevo estado",
          enum: ["DETECTED", "RESEARCHED", "CONTACT_READY", "CONTACTED", "REPLIED", "INTERESTED", "REGISTERED", "PUBLISHED", "NOT_INTERESTED", "OPT_OUT", "INVALID"],
        },
        notas: { type: "string", description: "Notas internas" },
        responsable: { type: "string", description: "Persona responsable" },
        email: { type: "string", description: "Email profesional verificado" },
        telefono: { type: "string", description: "Teléfono profesional verificado" },
        web: { type: "string", description: "Página web" },
        excluido: { type: "string", description: "1 = no recibir comunicaciones", enum: ["0", "1"] },
      },
      required: ["id"],
      additionalProperties: false,
    },
    ejecutar: async (args, ctx) => {
      const cambios: Record<string, unknown> = {};
      for (const campo of ["estado", "notas", "responsable", "email", "telefono", "web"]) {
        if (args[campo] !== undefined) cambios[campo] = String(args[campo]).slice(0, 500);
      }
      if (args.excluido !== undefined) {
        cambios.excluido = args.excluido === "1" ? 1 : 0;
        if (args.excluido === "1") cambios.estado = "OPT_OUT";
      }
      const r = await actualizarLead(Number(args.id), cambios, ctx.usuarioEmail ?? "agente");
      return r;
    },
  },
  {
    nombre: "get_campaign_stats",
    descripcion:
      "Estadísticas de campañas con datos reales: los envíos de la campaña anterior a propietarios (registros, enviados, abiertos, con foto recibida) y los borradores preparados. No estima cifras que no existan.",
    nivel: 1,
    sensible: false,
    parametros: { type: "object", properties: {}, additionalProperties: false },
    ejecutar: async () => estadisticasCampana(),
  },
  {
    nombre: "get_email_status",
    descripcion:
      "Estado del correo: si el servidor de envío está configurado, el remitente, el puerto, cuántas direcciones hay en la lista de exclusión y cuántos envíos se han hecho hoy. También dice si SPF, DKIM y DMARC están comprobados (hoy no lo están).",
    nivel: 1,
    sensible: false,
    parametros: { type: "object", properties: {}, additionalProperties: false },
    ejecutar: async () => estadoEmail(),
  },
  {
    nombre: "check_email_exclusion",
    descripcion: "Comprueba si una dirección está en la lista de exclusión. Hay que llamarla SIEMPRE antes de proponer cualquier envío.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: { email: { type: "string", description: "Dirección a comprobar" } },
      required: ["email"],
      additionalProperties: false,
    },
    ejecutar: async (args) => ({ email: String(args.email ?? ""), excluido: await estaExcluido(String(args.email ?? "")) }),
  },
  {
    nombre: "add_email_exclusion",
    descripcion:
      "Añade una dirección a la lista de exclusión: a partir de ahí no se le propondrá ninguna comunicación. Se usa cuando alguien pide no recibir más correos.",
    nivel: 3,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        email: { type: "string", description: "Dirección que pide no recibir comunicaciones" },
        motivo: { type: "string", description: "Por qué (por ejemplo: «lo ha pedido por correo»)" },
        origen: { type: "string", description: "Quién lo pide", enum: ["usuario", "rebote", "manual", "sistema"] },
      },
      required: ["email", "motivo"],
      additionalProperties: false,
    },
    ejecutar: async (args) => excluirEmail(String(args.email ?? ""), String(args.motivo ?? ""), (args.origen as "usuario" | "rebote" | "manual" | "sistema") ?? "manual"),
  },
  {
    nombre: "draft_outreach_email",
    descripcion:
      "REDACTAR (no enviar) un correo para un potencial cliente y dejarlo PENDIENTE DE APROBACIÓN humana. Nada sale de Hestiat por esta vía: se guarda el borrador y una persona decide. Antes comprueba la lista de exclusión y se niega si la dirección está excluida.",
    nivel: 3,
    sensible: true,
    parametros: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Identificador del potencial cliente" },
        asunto: { type: "string", description: "Asunto del correo" },
        cuerpo: { type: "string", description: "Texto del correo, personalizado" },
      },
      required: ["lead_id", "asunto", "cuerpo"],
      additionalProperties: false,
    },
    ejecutar: async (args, ctx) => {
      const lead = await obtenerLead(Number(args.lead_id));
      if (!lead) return { preparado: false, motivo: "No existe ese potencial cliente." };
      if (Number(lead.excluido) === 1) return { preparado: false, motivo: "Ese contacto está excluido: no se le prepara ningún correo." };
      if (!lead.email) return { preparado: false, motivo: "Ese potencial cliente no tiene email registrado: no se puede preparar el envío." };
      if (await estaExcluido(String(lead.email))) {
        return { preparado: false, motivo: "Esa dirección está en la lista de exclusión." };
      }
      await registrarContactoLead({
        leadId: Number(args.lead_id),
        canal: "email",
        asunto: String(args.asunto).slice(0, 255),
        cuerpo: String(args.cuerpo).slice(0, 20000),
        resultado: null,
        autor: ctx.usuarioEmail ?? "agente",
      });
      return {
        preparado: true,
        estado: "pendiente_de_aprobacion",
        para: lead.email,
        nota: "Borrador guardado. NO se ha enviado: hace falta que una persona lo apruebe.",
      };
    },
  },
  {
    nombre: "create_support_ticket",
    descripcion: "Abre una incidencia de atención al cliente con su identificador, categoría y prioridad. Se usa cuando el agente no puede resolver el caso o el usuario pide hablar con una persona.",
    nivel: 3,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        asunto: { type: "string", description: "Resumen del caso en una línea" },
        categoria: {
          type: "string",
          description: "Categoría del caso",
          enum: ["como_funciona", "publicacion", "alojamiento", "experiencia", "servicio", "registro", "edicion", "reserva", "cancelacion", "cuenta_acceso", "tecnico", "otro"],
        },
        prioridad: { type: "string", description: "Prioridad", enum: ["baja", "normal", "alta", "urgente"] },
        mensaje: { type: "string", description: "Detalle del caso, con lo que ha contado el usuario" },
        contacto_email: { type: "string", description: "Email de contacto del usuario, si lo ha dado" },
        contacto_nombre: { type: "string", description: "Nombre de contacto, si lo ha dado" },
      },
      required: ["asunto", "categoria"],
      additionalProperties: false,
    },
    ejecutar: async (args, ctx) =>
      crearTicket({
        asunto: String(args.asunto ?? "").slice(0, 255),
        categoria: String(args.categoria ?? "otro"),
        prioridad: args.prioridad ? String(args.prioridad) : "normal",
        mensaje: args.mensaje ? String(args.mensaje) : null,
        contactoEmail: args.contacto_email ? String(args.contacto_email) : ctx.usuarioEmail ?? null,
        contactoNombre: args.contacto_nombre ? String(args.contacto_nombre) : null,
        usuarioId: ctx.usuarioId ?? null,
        autor: ctx.usuarioEmail ?? "agente",
      }),
  },
  {
    nombre: "get_support_ticket",
    descripcion: "Consulta una incidencia por su identificador (HT-XXXXXXXX) o por su número, con la conversación.",
    nivel: 1,
    sensible: false,
    parametros: {
      type: "object",
      properties: { codigo: { type: "string", description: "Identificador HT-XXXXXXXX o número de la incidencia" } },
      required: ["codigo"],
      additionalProperties: false,
    },
    ejecutar: async (args) => {
      const t = await obtenerTicket(String(args.codigo ?? "").trim());
      return t ? { encontrada: true, incidencia: t } : { encontrada: false, nota: "No existe ninguna incidencia con ese identificador." };
    },
  },
  {
    nombre: "update_support_ticket",
    descripcion:
      "Actualiza una incidencia: estado (OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED), prioridad, responsable, resolución y añade un mensaje a la conversación. Registrar la resolución y cerrar la incidencia es lo que deja constancia de que se atendió.",
    nivel: 3,
    sensible: false,
    parametros: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Identificador HT-XXXXXXXX o número" },
        estado: { type: "string", description: "Nuevo estado", enum: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"] },
        prioridad: { type: "string", description: "Nueva prioridad", enum: ["baja", "normal", "alta", "urgente"] },
        responsable: { type: "string", description: "Persona responsable" },
        resolucion: { type: "string", description: "Cómo se ha resuelto" },
        mensaje: { type: "string", description: "Mensaje que se añade a la conversación" },
      },
      required: ["codigo"],
      additionalProperties: false,
    },
    ejecutar: async (args, ctx) =>
      actualizarTicket(String(args.codigo ?? "").trim(), {
        estado: args.estado ? String(args.estado) : undefined,
        prioridad: args.prioridad ? String(args.prioridad) : undefined,
        responsable: args.responsable ? String(args.responsable) : undefined,
        resolucion: args.resolucion ? String(args.resolucion) : undefined,
        mensaje: args.mensaje ? String(args.mensaje) : undefined,
        autor: ctx.usuarioEmail ?? "agente",
      }),
  },
];

/* ------------------------------------------------------------ validación -- */

/** Comprueba los argumentos contra el esquema: tipos, campos obligatorios, enums y campos de más. */
export function validarArgumentos(herramienta: Herramienta, args: Record<string, unknown>): string | null {
  const props = herramienta.parametros.properties;
  for (const obligatorio of herramienta.parametros.required ?? []) {
    if (args[obligatorio] === undefined || args[obligatorio] === null || String(args[obligatorio]).trim() === "") {
      return `falta el campo obligatorio «${obligatorio}»`;
    }
  }
  for (const [clave, valor] of Object.entries(args)) {
    const esquema = props[clave];
    if (!esquema) return `el campo «${clave}» no existe en esta herramienta`;
    if (valor === null || valor === undefined) continue;
    if (esquema.type === "string" && typeof valor !== "string") return `«${clave}» debe ser texto`;
    if (esquema.type === "string" && typeof valor === "string" && valor.length > 20000) return `«${clave}» es demasiado largo`;
    if (esquema.enum && !esquema.enum.includes(String(valor))) return `«${clave}» solo admite: ${esquema.enum.join(", ")}`;
  }
  return null;
}

export interface ResultadoHerramienta {
  ok: boolean;
  herramienta: string;
  resultado?: unknown;
  error?: string;
  nivel: Nivel;
}

/** Ejecuta una herramienta con todas las comprobaciones. Es el ÚNICO camino de escritura del agente. */
export async function ejecutarHerramienta(
  nombre: string,
  args: Record<string, unknown>,
  ctx: ContextoHerramienta,
): Promise<ResultadoHerramienta> {
  const herramienta = HERRAMIENTAS.find((h) => h.nombre === nombre);
  if (!herramienta) {
    await registrarAccion({
      accion: "herramienta_inexistente",
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      detalle: { herramienta: nombre, canal: ctx.canal },
    });
    return { ok: false, herramienta: nombre, error: `No existe la herramienta «${nombre}».`, nivel: 1 };
  }

  const autonomia = await configAutonomia();
  if (herramienta.nivel > autonomia.nivelMaximo) {
    await registrarAccion({
      accion: "bloqueada_por_nivel",
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      entidad: "ia_herramienta",
      entidadId: nombre,
      detalle: { nivel_herramienta: herramienta.nivel, nivel_permitido: autonomia.nivelMaximo },
    });
    return {
      ok: false,
      herramienta: nombre,
      error: `La herramienta requiere nivel ${herramienta.nivel} y la autonomía está en ${autonomia.nivelMaximo}. No se ejecuta nada.`,
      nivel: herramienta.nivel,
    };
  }

  if (herramienta.sensible && !ctx.autorizadoPor) {
    await registrarAccion({
      accion: "requiere_confirmacion",
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      entidad: "ia_herramienta",
      entidadId: nombre,
      detalle: { motivo: "acción sensible sin confirmación explícita" },
    });
    return {
      ok: false,
      herramienta: nombre,
      error: `«${nombre}» es una acción sensible y necesita confirmación explícita de una persona.`,
      nivel: herramienta.nivel,
    };
  }

  const problema = validarArgumentos(herramienta, args);
  if (problema) {
    await registrarAccion({
      accion: "argumentos_invalidos",
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      entidad: "ia_herramienta",
      entidadId: nombre,
      detalle: { problema, claves: Object.keys(args).slice(0, 20) },
    });
    return { ok: false, herramienta: nombre, error: problema, nivel: herramienta.nivel };
  }

  try {
    const resultado = await herramienta.ejecutar(args, ctx);
    await registrarAccion({
      accion: `herramienta:${nombre}`,
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      entidad: "ia_herramienta",
      entidadId: nombre,
      detalle: {
        canal: ctx.canal,
        nivel: herramienta.nivel,
        sensible: herramienta.sensible,
        autorizado_por: ctx.autorizadoPor ?? null,
        argumentos: resumenArgumentos(args),
        resultado: resumenResultado(resultado),
      },
    });
    return { ok: true, herramienta: nombre, resultado, nivel: herramienta.nivel };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "error desconocido";
    await registrarAccion({
      accion: `herramienta_fallida:${nombre}`,
      usuarioId: ctx.usuarioId,
      usuarioEmail: ctx.usuarioEmail,
      entidad: "ia_herramienta",
      entidadId: nombre,
      detalle: { error: mensaje.slice(0, 500) },
    });
    return { ok: false, herramienta: nombre, error: mensaje, nivel: herramienta.nivel };
  }
}

/** Resumen para la auditoría: nunca se guardan cuerpos enteros de correo ni conversaciones. */
function resumenArgumentos(args: Record<string, unknown>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(args)) {
    const s = String(v ?? "");
    salida[k] = s.length > 120 ? `${s.slice(0, 120)}…` : s;
  }
  return salida;
}

function resumenResultado(resultado: unknown): string {
  try {
    const s = JSON.stringify(resultado);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return "(resultado no serializable)";
  }
}

/** Esquemas en el formato que espera el modelo (llamadas a funciones). */
export function esquemasParaModelo() {
  return HERRAMIENTAS.map((h) => ({
    type: "function" as const,
    function: {
      name: h.nombre,
      description: h.descripcion,
      parameters: h.parametros,
    },
  }));
}

/** Ficha pública de cada herramienta, para la consola de administración. */
export function catalogoHerramientas() {
  return HERRAMIENTAS.map((h) => ({
    nombre: h.nombre,
    descripcion: h.descripcion,
    nivel: h.nivel,
    sensible: h.sensible,
    campos: Object.keys(h.parametros.properties),
  }));
}
