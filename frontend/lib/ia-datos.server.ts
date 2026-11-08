/**
 * ACCESO A DATOS DEL AGENTE — SOLO SERVIDOR.
 *
 * Todo lo que el agente sabe de Hestiat pasa por aquí. El modelo NUNCA escribe SQL: solo puede
 * pedir estas funciones, con parámetros ya validados. Cada consulta va parametrizada (nunca se
 * concatena texto en el SQL) y ninguna devuelve secretos ni datos de contacto de terceros que no
 * sean ya públicos en la ficha.
 *
 * Por qué consultas propias y no el buscador público: el agente necesita buscar por nombre y
 * localidad y recibir un resumen corto. Reutilizar el buscador de la web habría atado el agente a
 * la capa de presentación (filtros de URL, orden de tarjetas, textos de la interfaz). Lo que SÍ se
 * reutiliza es el formato de precio («orientativo» y «Consultar»), que es la misma regla de negocio
 * en todas partes.
 */
import { pool, poolLegacy } from "@/lib/db";
import { precioDe } from "@/lib/experiencias.server";

export type TipoPublicacion = "alojamiento" | "experiencia" | "servicio";

export interface PublicacionResumen {
  tipo: TipoPublicacion;
  id: number;
  titulo: string;
  localidad: string | null;
  provincia: string | null;
  precio: string;
  estado: "publicado" | "oculto" | "otro";
  enlace: string | null;
}

function estadoDePublicacion(activo: boolean, estado?: string | null): PublicacionResumen["estado"] {
  if (estado) return estado === "published" ? "publicado" : estado === "paused" ? "oculto" : "otro";
  return activo ? "publicado" : "oculto";
}

/** Texto de precio reutilizando la MISMA regla que la web: nada de inventar ni de redondear. */
function textoPrecioAlojamiento(fila: Record<string, unknown>): string {
  const valor = Number(fila.price_per_night ?? 0) || Number(fila.indicative_price ?? 0) || 0;
  const tipo = String(fila.price_type ?? "").toLowerCase();
  const moneda = String(fila.currency ?? "EUR") === "EUR" ? "€" : String(fila.currency ?? "");
  if (valor > 0 && tipo === "exact") return `${valor.toFixed(2)} ${moneda} por noche`;
  if (valor > 0) return `${valor.toFixed(2)} ${moneda} orientativo por noche`;
  return "Consultar";
}

export async function buscarPublicaciones(f: {
  q?: string;
  tipo?: TipoPublicacion;
  provincia?: string;
  limite?: number;
}): Promise<PublicacionResumen[]> {
  const limite = Math.min(Math.max(Number(f.limite ?? 10), 1), 25);
  const q = (f.q ?? "").trim();
  const provincia = (f.provincia ?? "").trim();
  const salida: PublicacionResumen[] = [];

  const quiereAlojamiento = !f.tipo || f.tipo === "alojamiento";
  if (quiereAlojamiento) {
    const condiciones = ["1=1"];
    const valores: unknown[] = [];
    if (q) {
      condiciones.push("(title LIKE ? OR city LIKE ?)");
      valores.push(`%${q}%`, `%${q}%`);
    }
    if (provincia) {
      // Coincidencia parcial: en el catálogo la provincia puede venir como «Alicante», «Alicante/Alacant»
      // o «Alacant», y con igualdad exacta la búsqueda del agente no encontraba nada.
      condiciones.push("province LIKE ?");
      valores.push(`%${provincia}%`);
    }
    valores.push(limite);
    const [filas] = await pool.query<any[]>(
      `SELECT id, legacy_id, slug, title, city, province, status, price_per_night, indicative_price, currency, price_type
         FROM accommodation WHERE ${condiciones.join(" AND ")}
        ORDER BY (status = 'published') DESC, review_count DESC, id ASC LIMIT ?`,
      valores,
    );
    for (const a of filas) {
      salida.push({
        tipo: "alojamiento",
        id: Number(a.legacy_id ?? a.id),
        titulo: String(a.title ?? "").slice(0, 160),
        localidad: a.city ?? null,
        provincia: a.province ?? null,
        precio: textoPrecioAlojamiento(a),
        estado: estadoDePublicacion(false, a.status),
        enlace: a.slug ? `https://hestiat.com/alojamiento/${a.slug}` : null,
      });
    }
  }

  if (!f.tipo || f.tipo === "experiencia") {
    const [filas] = await pool.query<any[]>(
      `SELECT id, slug, name, municipality, province, is_active, price, currency, price_type, price_text
         FROM experiencia
        WHERE (? = '' OR name LIKE ? OR municipality LIKE ?) AND (? = '' OR province LIKE ?)
        ORDER BY is_active DESC, rating_count DESC, id ASC LIMIT ?`,
      [q, `%${q}%`, `%${q}%`, provincia, `%${provincia}%`, limite],
    );
    for (const e of filas) {
      const p = precioDe(e);
      salida.push({
        tipo: "experiencia",
        id: Number(e.id),
        titulo: String(e.name ?? "").slice(0, 160),
        localidad: e.municipality ?? null,
        provincia: e.province ?? null,
        precio: p.texto ?? "Consultar",
        estado: estadoDePublicacion(Number(e.is_active) === 1),
        enlace: e.slug ? `https://hestiat.com/experiencias/${e.slug}` : null,
      });
    }
  }

  if (!f.tipo || f.tipo === "servicio") {
    const [filas] = await pool.query<any[]>(
      `SELECT id, slug, name, municipality, province, is_active, price, currency, price_type, price_text
         FROM servicio_turistico
        WHERE (? = '' OR name LIKE ? OR municipality LIKE ?) AND (? = '' OR province LIKE ?)
        ORDER BY is_active DESC, rating_count DESC, id ASC LIMIT ?`,
      [q, `%${q}%`, `%${q}%`, provincia, `%${provincia}%`, limite],
    );
    for (const s of filas) {
      const p = precioDe(s);
      salida.push({
        tipo: "servicio",
        id: Number(s.id),
        titulo: String(s.name ?? "").slice(0, 160),
        localidad: s.municipality ?? null,
        provincia: s.province ?? null,
        precio: p.texto ?? "Consultar",
        estado: estadoDePublicacion(Number(s.is_active) === 1),
        enlace: s.slug ? `https://hestiat.com/servicios/${s.slug}` : null,
      });
    }
  }

  return salida.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "publicado" ? -1 : 1)).slice(0, limite);
}

export async function obtenerPublicacion(tipo: TipoPublicacion, id: number) {
  if (tipo === "alojamiento") {
    const [filas] = await pool.query<any[]>(
      `SELECT a.id, a.legacy_id, a.slug, a.title, a.type, a.category, a.city, a.province, a.country,
              a.address, a.description, a.status, a.capacity, a.bedrooms, a.baths, a.price_per_night,
              a.indicative_price, a.currency, a.price_type, a.price_source, a.review_score, a.review_count,
              a.created_at, a.updated_at,
              (SELECT COUNT(*) FROM accommodation_photo p WHERE p.accommodation_id = a.id) AS fotos
         FROM accommodation a WHERE a.legacy_id = ? OR a.id = ? LIMIT 1`,
      [id, id],
    );
    const a = filas[0];
    if (!a) return null;
    return {
      tipo,
      id: Number(a.legacy_id ?? a.id),
      titulo: a.title,
      slug: a.slug,
      tipo_negocio: a.type ?? null,
      categoria: a.category ?? null,
      localidad: a.city ?? null,
      provincia: a.province ?? null,
      pais: a.country ?? null,
      direccion_publica: a.address ?? null,
      descripcion: String(a.description ?? "").slice(0, 1200),
      capacidad: a.capacity ?? null,
      habitaciones: a.bedrooms ?? null,
      banos: a.baths ?? null,
      precio: textoPrecioAlojamiento(a),
      procedencia_precio: a.price_source ?? null,
      valoracion_fuente: a.review_score ?? null,
      valoraciones: a.review_count ?? null,
      fotos: Number(a.fotos ?? 0),
      estado: estadoDePublicacion(false, a.status),
      creado: a.created_at ?? null,
      actualizado: a.updated_at ?? null,
      enlace: a.slug ? `https://hestiat.com/alojamiento/${a.slug}` : null,
      nota: "Los datos son los que hay publicados en la ficha. Si algo no cuadra, el camino es que el titular reclame la ficha.",
    };
  }
  if (tipo === "experiencia") {
    const [filas] = await pool.query<any[]>(
      `SELECT id, slug, name, category, subcategory, municipality, province, website_url, phone,
              description, short_description, price, currency, price_type, price_text, rating,
              rating_count, is_active, source_name, creado_en, updated_at, image_type, main_image
         FROM experiencia WHERE id = ? LIMIT 1`,
      [id],
    );
    const e = filas[0];
    if (!e) return null;
    const p = precioDe(e);
    return {
      tipo,
      id: Number(e.id),
      titulo: e.name,
      slug: e.slug,
      categoria: e.category ?? null,
      subcategoria: e.subcategory ?? null,
      localidad: e.municipality ?? null,
      provincia: e.province ?? null,
      descripcion: String(e.short_description ?? e.description ?? "").slice(0, 1200),
      precio: p.texto ?? "Consultar",
      orientativo: p.orientativo,
      procedencia: e.source_name ?? null,
      fotos: e.main_image ? 1 : 0,
      tipo_imagen: e.image_type ?? null,
      telefono: e.phone ?? null,
      web: e.website_url ?? null,
      estado: estadoDePublicacion(Number(e.is_active) === 1),
      enlace: e.slug ? `https://hestiat.com/experiencias/${e.slug}` : null,
    };
  }
  const [filas] = await pool.query<any[]>(
    `SELECT id, slug, name, category, subcategory, municipality, province, phone, email, website_url,
            short_description, price, currency, price_type, price_text, rating, rating_count,
            is_active, source_name, created_at, updated_at, main_image, image_type
       FROM servicio_turistico WHERE id = ? LIMIT 1`,
    [id],
  );
  const s = filas[0];
  if (!s) return null;
  const p = precioDe(s);
  return {
    tipo: "servicio" as const,
    id: Number(s.id),
    titulo: s.name,
    slug: s.slug,
    categoria: s.category ?? null,
    subcategoria: s.subcategory ?? null,
    localidad: s.municipality ?? null,
    provincia: s.province ?? null,
    descripcion: String(s.short_description ?? "").slice(0, 1200),
    precio: p.texto ?? "Consultar",
    orientativo: p.orientativo,
    procedencia: s.source_name ?? null,
    fotos: s.main_image ? 1 : 0,
    telefono: s.phone ?? null,
    web: s.website_url ?? null,
    estado: estadoDePublicacion(Number(s.is_active) === 1),
    enlace: s.slug ? `https://hestiat.com/servicios/${s.slug}` : null,
  };
}

/* ------------------------------------------------------------------ CRM -- */

export interface CoincidenciaLead {
  leadId: number;
  empresa: string | null;
  estado: string;
  tipo: "exacta" | "probable";
  por: string;
}

const normalizar = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

/** Deduplica por email (exacto), dominio (probable) y nombre+localidad (probable). */
export async function buscarCoincidenciasLead(datos: {
  email?: string | null;
  dominio?: string | null;
  empresa?: string | null;
  localidad?: string | null;
}): Promise<CoincidenciaLead[]> {
  const coincidencias: CoincidenciaLead[] = [];
  const email = normalizar(datos.email);
  const dominio = normalizar(datos.dominio);
  const empresa = normalizar(datos.empresa);
  const localidad = normalizar(datos.localidad);

  const [porEmail] = await pool.query<any[]>(
    `SELECT id, empresa, estado FROM \`lead\` WHERE email IS NOT NULL AND LOWER(email) = ? LIMIT 5`,
    [email],
  );
  for (const l of porEmail) coincidencias.push({ leadId: Number(l.id), empresa: l.empresa, estado: l.estado, tipo: "exacta", por: "mismo email" });

  if (dominio) {
    const [porDominio] = await pool.query<any[]>(
      `SELECT id, empresa, estado FROM \`lead\` WHERE dominio IS NOT NULL AND LOWER(dominio) = ? LIMIT 5`,
      [dominio],
    );
    for (const l of porDominio) {
      if (!coincidencias.some((c) => c.leadId === Number(l.id))) {
        coincidencias.push({ leadId: Number(l.id), empresa: l.empresa, estado: l.estado, tipo: "probable", por: "mismo dominio" });
      }
    }
  }
  if (empresa && localidad) {
    const [porNombre] = await pool.query<any[]>(
      `SELECT id, empresa, estado FROM \`lead\` WHERE LOWER(empresa) = ? AND LOWER(localidad) = ? LIMIT 5`,
      [empresa, localidad],
    );
    for (const l of porNombre) {
      if (!coincidencias.some((c) => c.leadId === Number(l.id))) {
        coincidencias.push({ leadId: Number(l.id), empresa: l.empresa, estado: l.estado, tipo: "probable", por: "mismo nombre y localidad" });
      }
    }
  }
  return coincidencias;
}

export async function crearLead(datos: {
  empresa?: string | null;
  tipoNegocio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  web?: string | null;
  email?: string | null;
  telefono?: string | null;
  contactoNombre?: string | null;
  fuente?: string | null;
  notas?: string | null;
  responsable?: string | null;
  publicadoId?: number | null;
}): Promise<{ id: number; coincidencias: CoincidenciaLead[] }> {
  const dominio = datos.web ? extraerDominio(datos.web) : datos.email ? extraerDominio(datos.email) : null;
  const coincidencias = await buscarCoincidenciasLead({
    email: datos.email,
    dominio,
    empresa: datos.empresa,
    localidad: datos.localidad,
  });
  if (coincidencias.length > 0) return { id: coincidencias[0].leadId, coincidencias };

  const [res] = await pool.query<any>(
    `INSERT INTO \`lead\` (empresa, tipo_negocio, localidad, provincia, pais, web, dominio, email, telefono,
                       contacto_nombre, fuente, notas, responsable, publicacion_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      datos.empresa ?? null,
      datos.tipoNegocio ?? "otro",
      datos.localidad ?? null,
      datos.provincia ?? null,
      datos.pais ?? "España",
      datos.web ?? null,
      dominio,
      datos.email ? String(datos.email).toLowerCase().slice(0, 200) : null,
      datos.telefono ?? null,
      datos.contactoNombre ?? null,
      datos.fuente ?? "agente",
      datos.notas ?? null,
      datos.responsable ?? null,
      datos.publicadoId ?? null,
    ],
  );
  return { id: Number(res.insertId), coincidencias: [] };
}

export function extraerDominio(valor: string): string | null {
  try {
    const conProtocolo = valor.includes("://") ? valor : `https://${valor}`;
    const host = new URL(conProtocolo).hostname.replace(/^www\./i, "").toLowerCase();
    return host.includes(".") ? host.slice(0, 160) : null;
  } catch {
    return null;
  }
}

export async function buscarLeads(f: { q?: string; estado?: string; localidad?: string; limite?: number }) {
  const limite = Math.min(Math.max(Number(f.limite ?? 10), 1), 50);
  const condiciones = ["1=1"];
  const valores: unknown[] = [];
  if (f.q) {
    condiciones.push("(empresa LIKE ? OR email LIKE ? OR web LIKE ?)");
    valores.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }
  if (f.estado) {
    condiciones.push("estado = ?");
    valores.push(f.estado);
  }
  if (f.localidad) {
    condiciones.push("localidad = ?");
    valores.push(f.localidad);
  }
  valores.push(limite);
  const [filas] = await pool.query<any[]>(
    `SELECT id, empresa, tipo_negocio, localidad, provincia, email, web, telefono, fuente, estado,
            excluido, notas, responsable, detectado_en, actualizado_en
       FROM \`lead\` WHERE ${condiciones.join(" AND ")} ORDER BY actualizado_en DESC LIMIT ?`,
    valores,
  );
  return filas.map((l) => ({
    id: Number(l.id),
    empresa: l.empresa,
    tipo_negocio: l.tipo_negocio,
    localidad: l.localidad,
    provincia: l.provincia,
    email: l.email,
    web: l.web,
    telefono: l.telefono,
    fuente: l.fuente,
    estado: l.estado,
    excluido: Number(l.excluido) === 1,
    notas: l.notas,
    responsable: l.responsable,
    detectado: l.detectado_en,
    actualizado: l.actualizado_en,
  }));
}

export async function obtenerLead(id: number) {
  const [filas] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [id]);
  const l = filas[0];
  if (!l) return null;
  const [contactos] = await pool.query<any[]>(
    `SELECT canal, asunto, resultado, autor, aprobado_por, enviado_en, creado_en FROM lead_contacto
      WHERE lead_id = ? ORDER BY id DESC LIMIT 20`,
    [id],
  );
  return { ...l, contactos };
}

const CAMPOS_LEAD_PERMITIDOS = [
  "empresa", "tipo_negocio", "localidad", "provincia", "pais", "web", "dominio", "email", "telefono",
  "contacto_nombre", "fuente", "estado", "excluido", "notas", "responsable",
] as const;

export async function actualizarLead(id: number, cambios: Record<string, unknown>, autor: string) {
  const [antes] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [id]);
  if (!antes[0]) return { ok: false as const, motivo: "no existe ese potencial cliente" };

  const sets: string[] = [];
  const valores: unknown[] = [];
  for (const [clave, valor] of Object.entries(cambios)) {
    if (!CAMPOS_LEAD_PERMITIDOS.includes(clave as (typeof CAMPOS_LEAD_PERMITIDOS)[number])) continue;
    if (valor === undefined) continue;
    sets.push(`${clave} = ?`);
    valores.push(valor);
  }
  if (sets.length === 0) return { ok: false as const, motivo: "no hay ningún campo válido que cambiar" };

  valores.push(id);
  await pool.query(`UPDATE \`lead\` SET ${sets.join(", ")} WHERE id = ?`, valores);
  const [despues] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [id]);
  await pool.query(
    `INSERT INTO lead_contacto (lead_id, canal, asunto, resultado, autor) VALUES (?, 'otro', ?, 'cancelado', ?)`,
    [id, `Cambio de ficha por ${autor}`.slice(0, 255), autor.slice(0, 120)],
  );
  return { ok: true as const, antes: antes[0], despues: despues[0] };
}

export async function registrarContactoLead(datos: {
  leadId: number;
  canal: "email" | "telefono" | "web" | "otro";
  asunto?: string | null;
  cuerpo?: string | null;
  resultado?: string | null;
  autor: string;
}) {
  await pool.query(
    `INSERT INTO lead_contacto (lead_id, canal, asunto, cuerpo, resultado, autor, enviado_en)
     VALUES (?,?,?,?,?,?, IF(? = 'enviado', NOW(), NULL))`,
    [
      datos.leadId,
      datos.canal,
      datos.asunto?.slice(0, 255) ?? null,
      datos.cuerpo?.slice(0, 20000) ?? null,
      datos.resultado ?? null,
      datos.autor.slice(0, 120),
      datos.resultado ?? "",
    ],
  );
  return { ok: true as const };
}

/* ------------------------------------------------- campañas y correo -- */

/** Estadísticas de campaña con DATOS REALES: los envíos de la campaña que ya existía. */
export async function estadisticasCampana() {
  const [legado] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS total,
            SUM(estado = 'enviado' OR enviado_en IS NOT NULL) AS enviados,
            SUM(abierto_en IS NOT NULL) AS abiertos,
            SUM(foto_recibida_en IS NOT NULL) AS con_foto
       FROM campana_envio`,
  );
  const l = legado[0] ?? {};
  let borradores = 0;
  let pendientes = 0;
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT SUM(estado = 'borrador') AS b, SUM(estado = 'pendiente_aprobacion') AS p FROM ia_campana`,
    );
    borradores = Number(filas[0]?.b ?? 0);
    pendientes = Number(filas[0]?.p ?? 0);
  } catch {
    /* si aún no hay campañas nuevas, se informa de cero */
  }
  return {
    campana_anterior_a_propietarios: {
      total_registros: Number(l.total ?? 0),
      enviados: Number(l.enviados ?? 0),
      abiertos: Number(l.abiertos ?? 0),
      con_foto_recibida: Number(l.con_foto ?? 0),
      nota: "Son los envíos de la campaña que se hizo para pedir fotos a los alojamientos del catálogo. El dato sale de la tabla real de envíos, no de una estimación.",
    },
    borradores_preparados: borradores,
    pendientes_de_aprobacion: pendientes,
    envios_de_esta_fase: 0,
    nota_envios: "En esta fase el agente NO envía nada: prepara borradores y los deja pendientes de aprobación humana.",
  };
}

export async function estadoEmail() {
  const configurado = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const [exclusiones] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM email_exclusion`).catch(() => [[{ n: 0 }]]);
  const [enviadosHoy] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM lead_contacto WHERE resultado = 'enviado' AND enviado_en >= CURDATE()`,
  ).catch(() => [[{ n: 0 }]]);
  return {
    servidor_configurado: configurado,
    remitente: process.env.SMTP_FROM ? String(process.env.SMTP_FROM).replace(/<.*?>/, "").trim() : null,
    puerto: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
    cifrado_implicito: (process.env.SMTP_SECURE ?? "") === "true",
    exclusiones_registradas: Number((exclusiones as any)[0]?.n ?? 0),
    enviados_hoy: Number((enviadosHoy as any)[0]?.n ?? 0),
    envio_automatico: false,
    nota: "El correo transaccional (reservas y verificación) funciona. Los envíos comerciales NO salen solos: requieren aprobación humana y respetar la lista de exclusión.",
    spf_dkim_dmarc: "No comprobados desde aquí: son registros DNS del dominio y hay que verificarlos con acceso al panel del dominio.",
  };
}

export async function estaExcluido(email: string): Promise<boolean> {
  const [filas] = await pool.query<any[]>(
    `SELECT 1 FROM email_exclusion WHERE LOWER(email) = LOWER(?) LIMIT 1`,
    [String(email).trim()],
  );
  return filas.length > 0;
}

export async function excluirEmail(email: string, motivo: string, origen: "usuario" | "rebote" | "manual" | "sistema" = "manual") {
  await pool.query(
    `INSERT INTO email_exclusion (email, motivo, origen) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE motivo = VALUES(motivo)`,
    [String(email).trim().toLowerCase().slice(0, 200), motivo.slice(0, 160), origen],
  );
  return { ok: true as const, email: String(email).trim().toLowerCase() };
}

/* -------------------------------------------------------- incidencias -- */

function codigoTicket(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i += 1) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `HT-${s}`;
}

const CATEGORIAS = new Set([
  "como_funciona", "publicacion", "alojamiento", "experiencia", "servicio", "registro", "edicion",
  "reserva", "cancelacion", "cuenta_acceso", "tecnico", "otro",
]);
const PRIORIDADES = new Set(["baja", "normal", "alta", "urgente"]);
const ESTADOS_TICKET = new Set(["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"]);

export async function crearTicket(datos: {
  asunto: string;
  categoria?: string;
  prioridad?: string;
  usuarioId?: number | null;
  contactoEmail?: string | null;
  contactoNombre?: string | null;
  mensaje?: string | null;
  autor?: string;
}) {
  const categoria = CATEGORIAS.has(String(datos.categoria)) ? String(datos.categoria) : "otro";
  const prioridad = PRIORIDADES.has(String(datos.prioridad)) ? String(datos.prioridad) : "normal";
  let codigo = codigoTicket();
  for (let intento = 0; intento < 3; intento += 1) {
    const [existe] = await pool.query<any[]>(`SELECT 1 FROM ticket WHERE codigo = ? LIMIT 1`, [codigo]);
    if (existe.length === 0) break;
    codigo = codigoTicket();
  }
  const [res] = await pool.query<any>(
    `INSERT INTO ticket (codigo, usuario_id, contacto_email, contacto_nombre, asunto, categoria, prioridad, estado)
     VALUES (?,?,?,?,?,?,?, 'OPEN')`,
    [
      codigo,
      datos.usuarioId ?? null,
      datos.contactoEmail ? String(datos.contactoEmail).slice(0, 200) : null,
      datos.contactoNombre?.slice(0, 160) ?? null,
      String(datos.asunto).slice(0, 255),
      categoria,
      prioridad,
    ],
  );
  const id = Number(res.insertId);
  if (datos.mensaje) {
    await pool.query(`INSERT INTO ticket_mensaje (ticket_id, autor, contenido) VALUES (?, 'usuario', ?)`, [
      id,
      String(datos.mensaje).slice(0, 20000),
    ]);
  }
  return { id, codigo, categoria, prioridad, estado: "OPEN" as const };
}

export async function obtenerTicket(codigoOId: string) {
  const esCodigo = /^HT-/i.test(codigoOId);
  const [filas] = await pool.query<any[]>(
    `SELECT * FROM ticket WHERE ${esCodigo ? "codigo = ?" : "id = ?"} LIMIT 1`,
    [esCodigo ? codigoOId.toUpperCase() : Number(codigoOId)],
  );
  const t = filas[0];
  if (!t) return null;
  const [mensajes] = await pool.query<any[]>(
    `SELECT autor, contenido, creado_en FROM ticket_mensaje WHERE ticket_id = ? ORDER BY id ASC LIMIT 50`,
    [t.id],
  );
  return { ...t, mensajes };
}

export async function actualizarTicket(
  codigoOId: string,
  cambios: { estado?: string; prioridad?: string; responsable?: string; resolucion?: string; mensaje?: string; autor?: string },
) {
  const t = await obtenerTicket(codigoOId);
  if (!t) return { ok: false as const, motivo: "no existe ese ticket" };

  const sets: string[] = [];
  const valores: unknown[] = [];
  if (cambios.estado) {
    if (!ESTADOS_TICKET.has(cambios.estado)) {
      return { ok: false as const, motivo: `estado no válido: ${cambios.estado}. Válidos: ${[...ESTADOS_TICKET].join(", ")}` };
    }
    sets.push("estado = ?");
    valores.push(cambios.estado);
    if (cambios.estado === "CLOSED" || cambios.estado === "RESOLVED") sets.push("cerrado_en = NOW()");
  }
  if (cambios.prioridad) {
    if (!PRIORIDADES.has(cambios.prioridad)) return { ok: false as const, motivo: `prioridad no válida: ${cambios.prioridad}` };
    sets.push("prioridad = ?");
    valores.push(cambios.prioridad);
  }
  if (cambios.responsable !== undefined) {
    sets.push("responsable = ?");
    valores.push(String(cambios.responsable).slice(0, 120));
  }
  if (cambios.resolucion !== undefined) {
    sets.push("resolucion = ?");
    valores.push(String(cambios.resolucion).slice(0, 20000));
  }
  if (sets.length === 0 && !cambios.mensaje) return { ok: false as const, motivo: "no hay ningún cambio que aplicar" };

  if (sets.length > 0) {
    valores.push(t.id);
    await pool.query(`UPDATE ticket SET ${sets.join(", ")} WHERE id = ?`, valores);
  }
  if (cambios.mensaje) {
    await pool.query(`INSERT INTO ticket_mensaje (ticket_id, autor, contenido) VALUES (?, ?, ?)`, [
      t.id,
      cambios.autor === "agente" ? "agente" : "persona",
      String(cambios.mensaje).slice(0, 20000),
    ]);
  }
  return { ok: true as const, ticket: await obtenerTicket(String(t.id)) };
}

/** Consulta si un negocio ya está publicado (para no proponer como lead algo que ya está). */
export async function yaEstaPublicado(datos: { nombre: string; localidad?: string | null }) {
  const nombre = String(datos.nombre).trim();
  if (!nombre) return { publicado: false as const, coincidencias: [] };
  const [alo] = await pool.query<any[]>(
    `SELECT legacy_id, slug, title, city FROM accommodation WHERE title LIKE ? AND (? = '' OR city = ?) LIMIT 5`,
    [`%${nombre}%`, datos.localidad ?? "", datos.localidad ?? ""],
  );
  const [exp] = await pool.query<any[]>(
    `SELECT id, slug, name, municipality FROM experiencia WHERE name LIKE ? LIMIT 5`,
    [`%${nombre}%`],
  );
  const [ser] = await pool.query<any[]>(
    `SELECT id, slug, name, municipality FROM servicio_turistico WHERE name LIKE ? LIMIT 5`,
    [`%${nombre}%`],
  );
  const coincidencias = [
    ...alo.map((a) => ({ tipo: "alojamiento", id: Number(a.legacy_id), titulo: a.title, localidad: a.city })),
    ...exp.map((e) => ({ tipo: "experiencia", id: Number(e.id), titulo: e.name, localidad: e.municipality })),
    ...ser.map((s) => ({ tipo: "servicio", id: Number(s.id), titulo: s.name, localidad: s.municipality })),
  ];
  return { publicado: coincidencias.length > 0, coincidencias };
}
