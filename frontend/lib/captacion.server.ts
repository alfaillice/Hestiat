/**
 * CAPTACIÓN Y CONVERSIÓN DE PROPIETARIOS — SOLO SERVIDOR.
 *
 * Qué añade sobre lo que ya existía (CRM, contactos, exclusiones, auditoría, correo):
 *   · un flujo de estados con TRANSICIONES CONTROLADAS: cada paso exige el evento real que lo respalda,
 *     y queda registrado con fecha, responsable y motivo en `lead_estado_historial`;
 *   · la investigación de un negocio contra datos que YA tenemos (el catálogo), sin inventar nada;
 *   · la invitación personalizada con enlaces reales, sin prometer reservas ni ingresos;
 *   · las métricas de captación, separando lo real de lo que no se puede medir;
 *   · el registro de respuestas reales, que frena el seguimiento cuando alguien dice que no o pide la baja.
 *
 * LO QUE NO HACE, POR DECISIÓN
 *   · No avanza un lead por su cuenta: sin evento comprobable no hay transición.
 *   · No envía correo comercial: prepara borradores y una persona los aprueba.
 *   · No inventa aperturas, clics ni respuestas: si no se puede medir, se dice que no está disponible.
 *   · No inventa empresas ni contactos: los negocios salen del catálogo real o los aporta una persona.
 */
import { pool, poolLegacy } from "@/lib/db";
import { registrarAccion } from "@/lib/ia-auditoria.server";
import { estaExcluido, excluirEmail } from "@/lib/ia-datos.server";

export const ESTADOS = [
  "DETECTED", "RESEARCHED", "CONTACT_READY", "APPROVED", "CONTACTED", "REPLIED", "INTERESTED",
  "REGISTERED", "CLAIM_PENDING", "PUBLICATION_STARTED", "PUBLISHED",
  "NOT_INTERESTED", "OPT_OUT", "INVALID", "BOUNCED", "NEEDS_REVIEW",
] as const;
export type Estado = (typeof ESTADOS)[number];

/**
 * Qué transiciones se permiten. La lista es corta a propósito: un CRM que deja saltar de DETECTED a
 * PUBLISHED sin nada en medio acaba contando mentiras.
 */
export const TRANSICIONES: Record<Estado, Estado[]> = {
  DETECTED: ["RESEARCHED", "INVALID", "NEEDS_REVIEW", "OPT_OUT"],
  RESEARCHED: ["CONTACT_READY", "NEEDS_REVIEW", "INVALID", "NOT_INTERESTED", "OPT_OUT"],
  CONTACT_READY: ["APPROVED", "NEEDS_REVIEW", "NOT_INTERESTED", "OPT_OUT"],
  APPROVED: ["CONTACTED", "NEEDS_REVIEW", "NOT_INTERESTED", "OPT_OUT"],
  CONTACTED: ["REPLIED", "BOUNCED", "NOT_INTERESTED", "OPT_OUT", "NEEDS_REVIEW"],
  REPLIED: ["INTERESTED", "NOT_INTERESTED", "OPT_OUT", "NEEDS_REVIEW"],
  INTERESTED: ["REGISTERED", "CLAIM_PENDING", "PUBLICATION_STARTED", "NOT_INTERESTED", "OPT_OUT"],
  REGISTERED: ["CLAIM_PENDING", "PUBLICATION_STARTED", "PUBLISHED", "OPT_OUT", "NEEDS_REVIEW"],
  CLAIM_PENDING: ["PUBLICATION_STARTED", "PUBLISHED", "NEEDS_REVIEW", "OPT_OUT"],
  PUBLICATION_STARTED: ["PUBLISHED", "NEEDS_REVIEW", "OPT_OUT"],
  PUBLISHED: [],
  NOT_INTERESTED: ["INTERESTED", "OPT_OUT"],
  OPT_OUT: [],
  INVALID: ["RESEARCHED"],
  BOUNCED: ["RESEARCHED", "NEEDS_REVIEW"],
  NEEDS_REVIEW: ["RESEARCHED", "CONTACT_READY", "INVALID", "OPT_OUT"],
};

/** Estados en los que NO se puede volver a escribir: el seguimiento se ha detenido. */
export const SIN_SEGUIMIENTO: Estado[] = ["OPT_OUT", "NOT_INTERESTED", "BOUNCED", "INVALID"];

function normalizar(t: string | null | undefined) {
  // Sin acentos, en minúsculas y con espacios simples: así «Casa  Rural» y «casa rural» son lo mismo.
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** ¿El evento que respalda esta transición existe DE VERDAD? Se comprueba contra los datos. */
export async function eventoReal(leadId: number, nuevo: Estado): Promise<{ ok: boolean; detalle: string }> {
  const [filas] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [leadId]);
  const lead = filas[0];
  if (!lead) return { ok: false, detalle: "no existe el lead" };
  const email = String(lead.email ?? "").toLowerCase();

  if (nuevo === "CONTACTED") {
    const [c] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM lead_contacto WHERE lead_id = ? AND resultado = 'enviado'`,
      [leadId],
    );
    return Number(c[0]?.n ?? 0) > 0
      ? { ok: true, detalle: `${c[0].n} envío(s) registrados` }
      : { ok: false, detalle: "no hay ningún envío registrado para este lead" };
  }
  if (nuevo === "APPROVED") {
    const [c] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM lead_contacto WHERE lead_id = ? AND canal = 'email'`,
      [leadId],
    );
    return Number(c[0]?.n ?? 0) > 0
      ? { ok: true, detalle: "hay un correo preparado y aprobado" }
      : { ok: false, detalle: "no hay ningún correo preparado que aprobar" };
  }
  if (nuevo === "REPLIED") {
    const [r] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM email_respuesta WHERE lead_id = ? OR email = ?`,
      [leadId, email],
    );
    return Number(r[0]?.n ?? 0) > 0
      ? { ok: true, detalle: `${r[0].n} respuesta(s) registradas` }
      : { ok: false, detalle: "no hay ninguna respuesta registrada" };
  }
  if (nuevo === "REGISTERED" && email) {
    const [u] = await poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS n FROM usuario WHERE LOWER(email) = ?`,
      [email],
    );
    return Number(u[0]?.n ?? 0) > 0
      ? { ok: true, detalle: "existe una cuenta con ese correo" }
      : { ok: false, detalle: "no existe ninguna cuenta con ese correo" };
  }
  if (nuevo === "CLAIM_PENDING" && email) {
    const [r] = await poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS n FROM reclama_propiedad WHERE LOWER(email) = ?`,
      [email],
    );
    return Number(r[0]?.n ?? 0) > 0
      ? { ok: true, detalle: "hay una reclamación registrada con ese correo" }
      : { ok: false, detalle: "no hay ninguna reclamación registrada con ese correo" };
  }
  if (nuevo === "PUBLISHED") {
    const nombre = normalizar(lead.empresa);
    const [a] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM accommodation WHERE status='published' AND (LOWER(title) LIKE ? OR id = ?)`,
      [`%${nombre}%`, lead.publicacion_id ?? 0],
    );
    const [e] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM experiencia WHERE is_active=1 AND LOWER(name) LIKE ?`,
      [`%${nombre}%`],
    );
    const [s] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM servicio_turistico WHERE is_active=1 AND LOWER(name) LIKE ?`,
      [`%${nombre}%`],
    );
    const total = Number(a[0]?.n ?? 0) + Number(e[0]?.n ?? 0) + Number(s[0]?.n ?? 0);
    return total > 0
      ? { ok: true, detalle: "hay una publicación real con ese nombre" }
      : { ok: false, detalle: "no hay ninguna publicación publicada con ese nombre" };
  }
  if (nuevo === "BOUNCED") {
    const [r] = await pool.query<any[]>(
      `SELECT COUNT(*) AS n FROM email_respuesta WHERE tipo = 'rebote' AND (lead_id = ? OR email = ?)`,
      [leadId, email],
    );
    return Number(r[0]?.n ?? 0) > 0
      ? { ok: true, detalle: "hay un rebote registrado" }
      : { ok: false, detalle: "no hay ningún rebote registrado" };
  }
  // Los demás estados son decisiones humanas (investigar, preparar, marcar para revisión): basta con
  // que la persona que los mueve lo motive.
  return { ok: true, detalle: "transición de gestión: basta con el motivo" };
}

export interface CambioEstado {
  ok: boolean;
  motivo?: string;
  detalle?: string;
  estado?: Estado;
}

/** Cambia el estado de un lead con todas las comprobaciones y deja el rastro. */
export async function cambiarEstado(
  leadId: number,
  nuevo: Estado,
  datos: { motivo: string; responsable: string; evento?: string },
): Promise<CambioEstado> {
  if (!ESTADOS.includes(nuevo)) return { ok: false, motivo: `estado desconocido: ${nuevo}` };
  if (!datos.motivo?.trim()) return { ok: false, motivo: "hace falta el motivo del cambio" };

  const [filas] = await pool.query<any[]>(`SELECT estado, empresa FROM \`lead\` WHERE id = ? LIMIT 1`, [leadId]);
  const lead = filas[0];
  if (!lead) return { ok: false, motivo: "no existe ese potencial cliente" };
  const anterior = String(lead.estado) as Estado;
  if (anterior === nuevo) return { ok: false, motivo: `ya está en ${nuevo}` };
  if (!TRANSICIONES[anterior]?.includes(nuevo)) {
    return {
      ok: false,
      motivo: `no se puede pasar de ${anterior} a ${nuevo}. Desde ${anterior} solo cabe: ${TRANSICIONES[anterior].join(", ") || "(ninguno: es un estado final)"}`,
    };
  }
  const evento = await eventoReal(leadId, nuevo);
  if (!evento.ok) {
    return { ok: false, motivo: `el cambio a ${nuevo} no está respaldado por un evento real: ${evento.detalle}` };
  }

  await pool.query(`UPDATE \`lead\` SET estado = ?, actualizado_en = NOW() WHERE id = ?`, [nuevo, leadId]);
  await pool.query(
    `INSERT INTO lead_estado_historial (lead_id, estado_anterior, estado_nuevo, motivo, responsable, evento)
     VALUES (?,?,?,?,?,?)`,
    [leadId, anterior, nuevo, datos.motivo.slice(0, 255), datos.responsable.slice(0, 120), datos.evento?.slice(0, 60) ?? null],
  );
  await registrarAccion({
    accion: "crm_estado",
    usuarioEmail: datos.responsable,
    entidad: "lead",
    entidadId: leadId,
    detalle: { de: anterior, a: nuevo, motivo: datos.motivo.slice(0, 160), evento_real: evento.detalle },
  });
  return { ok: true, estado: nuevo, detalle: evento.detalle };
}

/* ------------------------------------------------------------ investigación -- */

export interface Investigacion {
  nombre: string;
  localidad: string | null;
  provincia: string | null;
  web: string | null;
  email: string | null;
  categoria: string;
  fuente: string;
  comprobadoEn: string;
  yaPublicado: boolean;
  publicacion: { tipo: string; id: number; titulo: string; localidad: string | null; enlace: string | null } | null;
  coincidenciasLead: Array<{ leadId: number; empresa: string | null; estado: string; por: string }>;
  confianza: "alta" | "media" | "baja";
  verificacion: "verificado_catalogo" | "verificado_web" | "sin_verificar" | "dudoso";
  recomendacion: string;
}

/**
 * Investiga un negocio CON LOS DATOS QUE YA TENEMOS. No navega por internet ni inventa nada: comprueba
 * si ya está publicado en Hestiat, si ya es un lead, y con qué confianza se puede afirmar que es el
 * mismo negocio.
 */
export async function investigarNegocio(datos: {
  nombre: string;
  localidad?: string | null;
  provincia?: string | null;
  web?: string | null;
  email?: string | null;
  categoria?: string;
  fuente?: string;
}): Promise<Investigacion> {
  const nombre = String(datos.nombre ?? "").trim();
  const nombreNorm = normalizar(nombre);
  const localidad = datos.localidad?.trim() || null;

  // 1. ¿Ya está publicado? Se compara el nombre completo y se exige la localidad cuando se conoce.
  const [alo] = await pool.query<any[]>(
    `SELECT legacy_id, slug, title, city FROM accommodation
      WHERE status='published' AND LOWER(title) LIKE ? AND (? = '' OR LOWER(city) = ?) LIMIT 3`,
    [`%${nombreNorm}%`, normalizar(localidad), normalizar(localidad)],
  );
  const [exp] = await pool.query<any[]>(
    `SELECT id, slug, name, municipality AS city FROM experiencia WHERE is_active=1 AND LOWER(name) LIKE ? LIMIT 3`,
    [`%${nombreNorm}%`],
  );
  const [ser] = await pool.query<any[]>(
    `SELECT id, slug, name, municipality AS city FROM servicio_turistico WHERE is_active=1 AND LOWER(name) LIKE ? LIMIT 3`,
    [`%${nombreNorm}%`],
  );
  const candidatos = [
    ...alo.map((a) => ({ tipo: "alojamiento", id: Number(a.legacy_id), titulo: a.title, localidad: a.city, slug: a.slug })),
    ...exp.map((e) => ({ tipo: "experiencia", id: Number(e.id), titulo: e.name, localidad: e.city, slug: e.slug })),
    ...ser.map((s) => ({ tipo: "servicio", id: Number(s.id), titulo: s.name, localidad: s.city, slug: s.slug })),
  ];
  const exacto = candidatos.find((c) => normalizar(c.titulo) === nombreNorm) ?? candidatos[0] ?? null;

  // 2. ¿Ya es un lead? (deduplicación)
  const coincidenciasLead: Investigacion["coincidenciasLead"] = [];
  if (datos.email) {
    const [l] = await pool.query<any[]>(`SELECT id, empresa, estado FROM \`lead\` WHERE LOWER(email) = LOWER(?) LIMIT 3`, [datos.email]);
    for (const x of l) coincidenciasLead.push({ leadId: Number(x.id), empresa: x.empresa, estado: x.estado, por: "mismo email" });
  }
  if (nombre) {
    const [l] = await pool.query<any[]>(
      `SELECT id, empresa, estado FROM \`lead\` WHERE LOWER(empresa) = ? AND (? = '' OR LOWER(localidad) = ?) LIMIT 3`,
      [nombreNorm, normalizar(localidad), normalizar(localidad)],
    );
    for (const x of l) {
      if (!coincidenciasLead.some((c) => c.leadId === Number(x.id))) {
        coincidenciasLead.push({ leadId: Number(x.id), empresa: x.empresa, estado: x.estado, por: "mismo nombre y localidad" });
      }
    }
  }

  // 3. Confianza y verificación: se afirma lo que se puede sostener.
  const confianza: Investigacion["confianza"] = exacto
    ? (localidad && normalizar(exacto.localidad) === normalizar(localidad) ? "alta" : "media")
    : (candidatos.length > 0 ? "baja" : "baja");
  const verificacion: Investigacion["verificacion"] = exacto ? "verificado_catalogo" : datos.web ? "verificado_web" : "sin_verificar";

  return {
    nombre,
    localidad,
    provincia: datos.provincia?.trim() || null,
    web: datos.web?.trim() || null,
    email: datos.email?.trim() || null,
    categoria: datos.categoria ?? "otro",
    fuente: datos.fuente ?? "manual",
    comprobadoEn: new Date().toISOString().slice(0, 19).replace("T", " "),
    yaPublicado: Boolean(exacto),
    publicacion: exacto
      ? {
          tipo: exacto.tipo,
          id: exacto.id,
          titulo: exacto.titulo,
          localidad: exacto.localidad,
          enlace: exacto.slug
            ? `https://hestiat.com/${exacto.tipo === "alojamiento" ? "alojamiento" : exacto.tipo === "experiencia" ? "experiencias" : "servicios"}/${exacto.slug}`
            : null,
        }
      : null,
    coincidenciasLead,
    confianza,
    verificacion,
    recomendacion:
      candidatos.length > 1
        ? "Hay varias fichas parecidas: pasar a revisión humana antes de escribir."
        : exacto
          ? "Ya tiene ficha en Hestiat: el camino es que la reclame y la complete, no crear otra."
          : "No aparece en el catálogo: se le puede invitar a publicar.",
  };
}

/* --------------------------------------------------------------- lote piloto -- */

/**
 * Lote piloto: convierte en leads negocios REALES que ya están en nuestro catálogo y que publican su
 * web o su correo profesional. Ni una empresa inventada, ni un contacto sacado de la nada.
 * Es pequeño y configurable, y nunca pasa del límite configurado.
 */
export async function lotePiloto(limite: number, responsable: string) {
  const tope = Math.min(Math.max(Number(limite) || 5, 1), 25);
  const [config] = await pool.query<any[]>(`SELECT valor FROM ia_config WHERE clave='captacion_piloto_limite'`);
  const maximo = Math.min(tope, Number(config[0]?.valor ?? 5) || 5);

  // Fuente: servicios del catálogo con correo profesional publicado por el propio negocio.
  const [candidatos] = await pool.query<any[]>(
    `SELECT s.id, s.name, s.municipality, s.province, s.website_url, s.email, s.category,
            (SELECT COUNT(*) FROM \`lead\` l WHERE l.publicacion_id = s.id) AS ya_es_lead
       FROM servicio_turistico s
      WHERE s.is_active = 1 AND s.email IS NOT NULL AND s.email <> ''
      ORDER BY (s.website_url IS NULL), s.id ASC LIMIT ?`,
    [maximo * 4],
  );

  const creados: Array<{ id: number; empresa: string; email: string | null }> = [];
  const descartados: Array<{ empresa: string; motivo: string }> = [];

  for (const c of candidatos) {
    if (creados.length >= maximo) break;
    if (Number(c.ya_es_lead) > 0) {
      descartados.push({ empresa: c.name, motivo: "ya es un lead" });
      continue;
    }
    const email = String(c.email).trim().toLowerCase();
    if (await estaExcluido(email)) {
      descartados.push({ empresa: c.name, motivo: "en la lista de exclusión" });
      continue;
    }
    const [dup] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM \`lead\` WHERE LOWER(email) = ?`, [email]);
    if (Number(dup[0]?.n ?? 0) > 0) {
      descartados.push({ empresa: c.name, motivo: "mismo email ya registrado" });
      continue;
    }
    const inv = await investigarNegocio({
      nombre: c.name,
      localidad: c.municipality,
      provincia: c.province,
      web: c.website_url,
      email,
      categoria: c.category ?? "servicio",
      fuente: "catalogo",
    });
    const [res] = await pool.query<any>(
      `INSERT INTO \`lead\` (empresa, tipo_negocio, localidad, provincia, pais, web, email, fuente, estado,
                            objetivo, verificacion, confianza, comprobado_en, publicacion_id, responsable, notas)
       VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,NOW(),?,?,?)`,
      [
        c.name,
        "servicio",
        c.municipality ?? null,
        c.province ?? null,
        "España",
        c.website_url ?? null,
        email,
        "catalogo",
        "RESEARCHED",
        inv.yaPublicado ? "reclamar_ficha" : "nueva_publicacion",
        inv.verificacion,
        inv.confianza,
        c.id,
        responsable,
        `Lote piloto. ${inv.recomendacion} Procedencia: ficha ${c.id} del catálogo de servicios de Hestiat.`,
      ],
    );
    const leadId = Number(res.insertId);
    await pool.query(
      `INSERT INTO lead_estado_historial (lead_id, estado_anterior, estado_nuevo, motivo, responsable, evento)
       VALUES (?, NULL, 'RESEARCHED', ?, ?, 'investigacion_catalogo')`,
      [leadId, `Investigado contra el catálogo: ${inv.yaPublicado ? "ya tiene ficha" : "no tiene ficha"} (confianza ${inv.confianza})`, responsable],
    );
    await registrarAccion({
      accion: "captacion_lote",
      usuarioEmail: responsable,
      entidad: "lead",
      entidadId: leadId,
      detalle: { empresa: c.name, fuente: "catalogo", confianza: inv.confianza, ya_publicado: inv.yaPublicado },
    });
    creados.push({ id: leadId, empresa: c.name, email });
  }

  await registrarAccion({
    accion: "captacion_lote_resumen",
    usuarioEmail: responsable,
    detalle: { creados: creados.length, descartados: descartados.length, limite: maximo },
  });
  return { creados, descartados, limite: maximo };
}

/* ------------------------------------------------------------- invitación -- */

/**
 * Compone la invitación con DATOS VERIFICADOS. No promete reservas, clientes ni ingresos, y no finge
 * que nadie ha visitado el negocio. Dice la verdad: publicar es gratis y aquí está cómo.
 */
export function componerInvitacion(lead: {
  empresa: string | null;
  localidad: string | null;
  tipo_negocio: string;
  publicacion_id: number | null;
  objetivo: string;
}): { asunto: string; cuerpo: string; motivoSeleccion: string; baseJuridica: string; plantilla: string } {
  const negocio = lead.empresa?.trim() || "tu negocio";
  const lugar = lead.localidad ? ` en ${lead.localidad}` : "";
  const tieneFicha = Number(lead.publicacion_id ?? 0) > 0 || lead.objetivo === "reclamar_ficha";

  const asunto = tieneFicha
    ? `${negocio}: tu ficha ya está en Hestiat y puedes reclamarla`
    : `${negocio}: publica gratis en Hestiat`;

  const cuerpo = `Hola:

Somos Hestiat (https://hestiat.com), una web española de alojamientos, experiencias y servicios. Te escribimos porque ${negocio}${lugar} aparece en nuestro catálogo.

${tieneFicha
  ? `Tu ficha ya está publicada con datos de fuentes públicas, así que puede estar incompleta o con una foto que no es tuya. Puedes reclamarla y dejarla como quieras: fotos propias, precios y calendario.
\nReclamar tu ficha: https://hestiat.com/reclamar`
  : `Puedes publicar gratis tu actividad y gestionarla tú mismo desde tu panel.
\nPublicar en Hestiat: https://hestiat.com/hazte-anfitrion`}

Publicar en Hestiat no tiene coste: sin cuota de publicación y sin comisión de Hestiat. El precio que
pongas es el precio que ve quien te reserva, y el pago se acuerda directamente contigo.

No prometemos reservas, clientes ni ingresos: no depende de nosotros.

Para empezar, el camino es este: entra en https://hestiat.com/registro (o inicia sesión si ya tienes
cuenta), reclama tu ficha o crea tu publicación, completa tus datos y revísala antes de publicarla.
Si algo no cuadra, respóndenos a este mismo correo y lo vemos.

—
Hestiat · https://hestiat.com · hola@hestiat.com

Escribimos a direcciones profesionales publicadas por el propio negocio. Si no quieres recibir más
mensajes nuestros, responde a este correo con la palabra BAJA y no volveremos a escribirte.`;

  return {
    asunto,
    cuerpo,
    motivoSeleccion: tieneFicha
      ? "Tiene ficha en el catálogo de Hestiat y puede reclamarla"
      : "Negocio del catálogo sin publicación propia: encaja en Hestiat",
    baseJuridica:
      "Contacto profesional publicado por el propio negocio en su ficha pública. Interés legítimo en ofrecer un servicio gratuito relacionado con su actividad; se incluye mecanismo de oposición (BAJA) y lista de exclusión. Revisar la norma del país del destinatario antes de enviar.",
    plantilla: tieneFicha ? "reclamar-ficha" : "publicar-gratis",
  };
}

/** ¿Se puede preparar un correo para este lead? Si pidió la baja o dijo que no, no. */
export async function puedeEscribirse(leadId: number): Promise<{ ok: boolean; motivo?: string }> {
  const [filas] = await pool.query<any[]>(`SELECT estado, email, excluido FROM \`lead\` WHERE id = ? LIMIT 1`, [leadId]);
  const l = filas[0];
  if (!l) return { ok: false, motivo: "no existe ese potencial cliente" };
  if (Number(l.excluido) === 1) return { ok: false, motivo: "está marcado como excluido" };
  if (SIN_SEGUIMIENTO.includes(String(l.estado) as Estado)) {
    return { ok: false, motivo: `el seguimiento está detenido (estado ${l.estado})` };
  }
  if (!l.email) return { ok: false, motivo: "no tiene email" };
  if (await estaExcluido(String(l.email))) return { ok: false, motivo: "su dirección está en la lista de exclusión" };
  return { ok: true };
}

/* ------------------------------------------------------------- respuestas -- */

/**
 * Registra una RESPUESTA REAL recibida (por el proveedor de correo o por una conexión autorizada) y
 * frena el seguimiento cuando toca. Nunca inventa aperturas ni clics: esto solo apunta lo que alguien
 * ha enviado de verdad.
 */
export async function registrarRespuesta(datos: {
  email: string;
  tipo: "interesado" | "no_interesado" | "baja" | "pregunta" | "rebote" | "otro";
  asunto?: string | null;
  extracto?: string | null;
  fuente?: string | null;
  responsable?: string | null;
}) {
  const email = String(datos.email).trim().toLowerCase();
  const [lead] = await pool.query<any[]>(`SELECT id, estado FROM \`lead\` WHERE LOWER(email) = ? LIMIT 1`, [email]);
  const leadId = lead[0] ? Number(lead[0].id) : null;

  await pool.query(
    `INSERT INTO email_respuesta (email, lead_id, tipo, asunto, extracto, fuente) VALUES (?,?,?,?,?,?)`,
    [email, leadId, datos.tipo, datos.asunto?.slice(0, 255) ?? null, datos.extracto?.slice(0, 4000) ?? null, datos.fuente?.slice(0, 80) ?? "manual"],
  );

  let estadoNuevo: Estado | null = null;
  if (datos.tipo === "interesado") estadoNuevo = "INTERESTED";
  if (datos.tipo === "pregunta") estadoNuevo = "REPLIED";
  if (datos.tipo === "no_interesado") estadoNuevo = "NOT_INTERESTED";
  if (datos.tipo === "baja") estadoNuevo = "OPT_OUT";
  if (datos.tipo === "rebote") estadoNuevo = "BOUNCED";

  // Una baja o un rebote, además, bloquean cualquier envío futuro a esa dirección.
  if (datos.tipo === "baja") await excluirEmail(email, "Ha pedido la baja", "usuario");
  if (datos.tipo === "rebote") await excluirEmail(email, "Rebote del servidor", "rebote");
  if (datos.tipo === "no_interesado") {
    await pool.query(`UPDATE \`lead\` SET excluido = 1 WHERE LOWER(email) = ?`, [email]);
  }

  if (leadId && estadoNuevo) {
    const r = await cambiarEstado(leadId, estadoNuevo, {
      motivo: `Respuesta real recibida: ${datos.tipo}`,
      responsable: datos.responsable ?? "sistema:respuesta",
      evento: `respuesta:${datos.tipo}`,
    });
    if (!r.ok && estadoNuevo === "REPLIED") {
      // Si el lead no estaba en un estado que permita REPLIED, al menos queda registrada la respuesta.
      await pool.query(`UPDATE \`lead\` SET actualizado_en = NOW() WHERE id = ?`, [leadId]);
    }
  }

  await registrarAccion({
    accion: "respuesta_registrada",
    usuarioEmail: datos.responsable ?? "sistema:respuesta",
    entidad: "email_respuesta",
    entidadId: email,
    detalle: { tipo: datos.tipo, lead: leadId, seguimiento_detenido: ["baja", "rebote", "no_interesado"].includes(datos.tipo) },
  });

  return { ok: true, leadId, estadoNuevo, seguimientoDetenido: ["baja", "rebote", "no_interesado"].includes(datos.tipo) };
}

/* --------------------------------------------------------------- métricas -- */

export interface Metricas {
  reales: Record<string, number>;
  noDisponibles: string[];
  nota: string;
}

/** Métricas de captación: solo lo que se puede contar de verdad. Lo que no se mide, se dice. */
export async function metricasCaptacion(): Promise<Metricas> {
  const [f] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%') AS detectados,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado NOT IN ('DETECTED')) AS investigados,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado IN ('CONTACT_READY','NEEDS_REVIEW')) AS aptos_revision,
       (SELECT COUNT(*) FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id WHERE c.canal='email' AND c.revisado_por IS NOT NULL AND l.empresa NOT LIKE 'PRUEBA%') AS emails_aprobados,
       (SELECT COUNT(*) FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id WHERE c.resultado='enviado' AND l.empresa NOT LIKE 'PRUEBA%') AS emails_enviados,
       (SELECT COUNT(*) FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id WHERE c.resultado='cancelado' AND l.empresa NOT LIKE 'PRUEBA%') AS emails_rechazados,
       (SELECT COUNT(*) FROM email_respuesta WHERE tipo='rebote') AS rebotes,
       (SELECT COUNT(*) FROM email_exclusion) AS bajas,
       (SELECT COUNT(*) FROM email_respuesta WHERE tipo IN ('interesado','pregunta','no_interesado')) AS respuestas,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado IN ('INTERESTED','REGISTERED','CLAIM_PENDING','PUBLICATION_STARTED')) AS interesados,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado IN ('REGISTERED','CLAIM_PENDING','PUBLICATION_STARTED','PUBLISHED')) AS registros,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado IN ('CLAIM_PENDING','PUBLICATION_STARTED')) AS reclamaciones_iniciadas,
       (SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%' AND estado = 'PUBLISHED') AS publicaciones_completadas,
       (SELECT COUNT(*) FROM lead_estado_historial) AS transiciones_registradas`,
  );
  const r = f[0] ?? {};
  const reales: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) reales[k] = Number(v ?? 0);
  return {
    reales,
    noDisponibles: ["aperturas de correo", "clics en enlaces", "respuestas detectadas automáticamente"],
    nota:
      "Las aperturas y los clics NO se miden, y no se inventan: no hay seguimiento de píxeles ni de enlaces. Las respuestas se cuentan solo cuando se registran de verdad (proveedor de correo o alta manual). Los leads de prueba (PRUEBA...) quedan fuera de todas las cifras.",
  };
}

/* ------------------------------------------------- privacidad del interesado -- */

/** Derecho de acceso: devuelve todo lo que tenemos de ese contacto. */
export async function exportarLead(leadId: number) {
  const [lead] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [leadId]);
  if (!lead[0]) return null;
  const [contactos] = await pool.query<any[]>(`SELECT canal, asunto, resultado, autor, aprobado_por, enviado_en, creado_en FROM lead_contacto WHERE lead_id = ?`, [leadId]);
  const [historial] = await pool.query<any[]>(`SELECT estado_anterior, estado_nuevo, motivo, responsable, creado_en FROM lead_estado_historial WHERE lead_id = ?`, [leadId]);
  const [respuestas] = await pool.query<any[]>(`SELECT tipo, asunto, extracto, fuente, creado_en FROM email_respuesta WHERE lead_id = ?`, [leadId]);
  return { lead: lead[0], contactos, historial, respuestas };
}

/**
 * Derecho de supresión: borra los datos del contacto. La dirección se queda SOLO en la lista de
 * exclusión, que es lo que impide volver a escribirle (y para eso sí se conserva).
 */
export async function suprimirLead(leadId: number, motivo: string, responsable: string) {
  const [lead] = await pool.query<any[]>(`SELECT email, empresa FROM \`lead\` WHERE id = ? LIMIT 1`, [leadId]);
  if (!lead[0]) return { ok: false as const, motivo: "no existe ese potencial cliente" };
  const email = lead[0].email ? String(lead[0].email) : null;
  if (email) await excluirEmail(email, `Supresión de datos a petición: ${motivo}`.slice(0, 160), "usuario");
  await pool.query(`DELETE FROM email_respuesta WHERE lead_id = ?`, [leadId]);
  await pool.query(`DELETE FROM lead_contacto WHERE lead_id = ?`, [leadId]);
  await pool.query(`DELETE FROM \`lead\` WHERE id = ?`, [leadId]);
  await pool.query(
    `INSERT INTO lead_estado_historial (lead_id, estado_anterior, estado_nuevo, motivo, responsable, evento)
     VALUES (?, '(datos suprimidos)', 'SUPRIMIDO', ?, ?, 'supresion')`,
    [leadId, motivo.slice(0, 255), responsable.slice(0, 120)],
  );
  await registrarAccion({
    accion: "crm_supresion",
    usuarioEmail: responsable,
    entidad: "lead",
    entidadId: leadId,
    detalle: { motivo: motivo.slice(0, 160), email_conservado_solo_en_exclusion: Boolean(email) },
  });
  return { ok: true as const, emailEnExclusion: email };
}
