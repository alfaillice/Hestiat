/**
 * Catálogo de experiencias y servicios turísticos — SOLO servidor.
 *
 * Qué son estos datos, dicho sin adornos: **no son registros creados por anfitriones**. Son un
 * catálogo importado (experiencias y servicios de fuentes públicas, con su autoría original en
 * `source_name`/`source_url`), y por eso **no tienen dueño**. Fingir que un anfitrión «gestiona»
 * un registro importado sería mentir sobre el modelo.
 *
 * Lo que sí puede hacer un anfitrión, y es lo que se implementa aquí:
 *  · buscar en ese catálogo lo que hay cerca de SU alojamiento (por provincia y municipio);
 *  · **vincular** experiencias y servicios a sus alojamientos para ofrecérselos a sus huéspedes;
 *  · desvincularlos cuando quiera.
 *
 * Las tablas de vínculo son aditivas y con clave primaria compuesta, así que no se puede duplicar
 * una vinculación. Y todo pasa por `alojamiento_anfitrion`: un anfitrión solo toca lo suyo.
 */
import { poolLegacy } from "@/lib/db";

export type TipoCatalogo = "experiencia" | "servicio";

const TABLAS: Record<TipoCatalogo, { origen: string; vinculo: string }> = {
  experiencia: { origen: "experiencia", vinculo: "alojamiento_experiencia" },
  servicio: { origen: "servicio_turistico", vinculo: "alojamiento_servicio_turistico" },
};

let esquema: Promise<void> | undefined;

export async function asegurarEsquemaCatalogo(): Promise<void> {
  if (!esquema) {
    esquema = (async () => {
      for (const t of Object.values(TABLAS)) {
        await poolLegacy.query(
          `CREATE TABLE IF NOT EXISTS ${t.vinculo} (
             alojamiento_id BIGINT NOT NULL,
             ${t.origen === "experiencia" ? "experiencia_id" : "servicio_id"} BIGINT NOT NULL,
             creado_en DATETIME NOT NULL,
             PRIMARY KEY (alojamiento_id, ${t.origen === "experiencia" ? "experiencia_id" : "servicio_id"})
           ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        );
      }
    })().catch((e) => {
      esquema = undefined;
      throw e;
    });
  }
  return esquema;
}

/** Comprueba propiedad del alojamiento. Devuelve su provincia y municipio para poder buscar cerca. */
export async function alojamientoPropio(usuarioId: number, alojamientoId: number) {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id, a.titulo, a.provincia, a.ciudad
       FROM alojamiento a
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = a.id
      WHERE a.id = ? AND af.usuario_id = ? LIMIT 1`,
    [alojamientoId, usuarioId],
  );
  const a = filas[0];
  return a ? { id: Number(a.id), titulo: String(a.titulo), provincia: a.provincia ?? null, ciudad: a.ciudad ?? null } : null;
}

export interface FichaCatalogo {
  id: number;
  nombre: string;
  categoria: string | null;
  municipio: string | null;
  provincia: string | null;
  descripcion: string | null;
  precio: string | null;
  web: string | null;
  fuente: string | null;
  enlazada: boolean;
}

/**
 * Busca en el catálogo. Se construye el SELECT solo con las columnas que existen de verdad, para
 * que un cambio de esquema no rompa la pantalla.
 */
async function columnasDe(tabla: string): Promise<Set<string>> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabla],
  );
  return new Set(filas.map((f) => String(f.COLUMN_NAME).toLowerCase()));
}

export async function buscarCatalogo(
  tipo: TipoCatalogo,
  opciones: { provincia?: string | null; q?: string; limite?: number; pagina?: number; categoria?: string | null } = {},
): Promise<FichaCatalogo[]> {
  await asegurarEsquemaCatalogo();
  const tabla = TABLAS[tipo].origen;
  const cols = await columnasDe(tabla);
  const puede = (c: string) => (cols.has(c) ? c : `NULL AS ${c}`);

  const select = [
    "id",
    puede("name") + " AS nombre",
    puede("category") + " AS categoria",
    puede("municipality") + " AS municipio",
    puede("province") + " AS provincia",
    puede("short_description") + " AS descripcion",
    puede("price") + " AS precio",
    puede("website_url") + " AS web",
    puede("source_name") + " AS fuente",
  ].join(", ");

  const where: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (opciones.provincia && cols.has("province")) {
    where.push("province = ?");
    valores.push(opciones.provincia);
  }
  const q = (opciones.q ?? "").trim();
  if (q.length >= 2 && cols.has("name")) {
    where.push("name LIKE ?");
    valores.push(`%${q}%`);
  }
  if (opciones.categoria && cols.has("category")) {
    where.push("category = ?");
    valores.push(opciones.categoria);
  }
  const limite = Math.min(Math.max(opciones.limite ?? 40, 1), 100);
  const desplazamiento = Math.max(0, (Math.max(1, opciones.pagina ?? 1) - 1) * limite);

  // Paginación real: sin esto, un catálogo de 262.000 filas solo mostraría las primeras.
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT ${select} FROM ${tabla} WHERE ${where.join(" AND ")} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...valores, limite, desplazamiento],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    nombre: String(f.nombre ?? "(sin nombre)"),
    categoria: f.categoria ?? null,
    municipio: f.municipio ?? null,
    provincia: f.provincia ?? null,
    descripcion: f.descripcion ? String(f.descripcion).slice(0, 200) : null,
    precio: f.precio === null || f.precio === undefined ? null : String(f.precio),
    web: f.web ?? null,
    fuente: f.fuente ?? null,
    enlazada: false,
  }));
}

/** Cuántas hay en el catálogo, por provincia (para dar contexto real). */
export async function totalCatalogo(tipo: TipoCatalogo, provincia?: string | null): Promise<number> {
  await asegurarEsquemaCatalogo();
  const tabla = TABLAS[tipo].origen;
  const cols = await columnasDe(tabla);
  if (provincia && cols.has("province")) {
    const [f] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM ${tabla} WHERE province = ?`, [provincia]);
    return Number(f[0]?.n ?? 0);
  }
  const [f] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM ${tabla}`);
  return Number(f[0]?.n ?? 0);
}

export async function listarEnlazadas(usuarioId: number, alojamientoId: number, tipo: TipoCatalogo): Promise<number[]> {
  await asegurarEsquemaCatalogo();
  const propio = await alojamientoPropio(usuarioId, alojamientoId);
  if (!propio) return [];
  const t = TABLAS[tipo];
  const col = tipo === "experiencia" ? "experiencia_id" : "servicio_id";
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT ${col} AS id FROM ${t.vinculo} WHERE alojamiento_id = ?`,
    [alojamientoId],
  );
  return filas.map((f) => Number(f.id));
}

export type ResultadoCatalogo = { ok: true; hechas: number } | { ok: false; error: string };

export async function enlazar(
  usuarioId: number,
  alojamientoId: number,
  tipo: TipoCatalogo,
  ids: number[],
  accion: "agregar" | "quitar",
): Promise<ResultadoCatalogo> {
  await asegurarEsquemaCatalogo();
  const propio = await alojamientoPropio(usuarioId, alojamientoId);
  if (!propio) return { ok: false, error: "Ese alojamiento no es tuyo." };

  const lista = ids.filter((n) => Number.isFinite(n) && n > 0).slice(0, 200);
  if (lista.length === 0) return { ok: false, error: "No has seleccionado nada." };

  const t = TABLAS[tipo];
  const col = tipo === "experiencia" ? "experiencia_id" : "servicio_id";
  let hechas = 0;

  for (const id of lista) {
    if (accion === "agregar") {
      // INSERT IGNORE + clave primaria compuesta: vincular dos veces no duplica nada.
      const [res] = await poolLegacy.query<any>(
        `INSERT IGNORE INTO ${t.vinculo} (alojamiento_id, ${col}, creado_en) VALUES (?,?, NOW())`,
        [alojamientoId, id],
      );
      if (Number(res.affectedRows ?? 0) > 0) hechas += 1;
    } else {
      const [res] = await poolLegacy.query<any>(
        `DELETE FROM ${t.vinculo} WHERE alojamiento_id = ? AND ${col} = ?`,
        [alojamientoId, id],
      );
      if (Number(res.affectedRows ?? 0) > 0) hechas += 1;
    }
  }
  return { ok: true, hechas };
}


/**
 * Experiencias y servicios que el anfitrión ha vinculado a un alojamiento.
 * Se usa en la ficha pública: el huésped ve qué se puede hacer y contratar cerca.
 * Devuelve listas vacías si no hay vínculos o si algo falla: una ficha nunca se cae por esto.
 */
export async function enlazadasDelAlojamiento(legacyId: number): Promise<{ experiencias: FichaCatalogo[]; servicios: FichaCatalogo[] }> {
  const res: { experiencias: FichaCatalogo[]; servicios: FichaCatalogo[] } = { experiencias: [], servicios: [] };
  if (!Number.isFinite(legacyId) || legacyId <= 0) return res;
  try {
    await asegurarEsquemaCatalogo();
    for (const tipo of ["experiencia", "servicio"] as TipoCatalogo[]) {
      const t = TABLAS[tipo];
      const col = tipo === "experiencia" ? "experiencia_id" : "servicio_id";
      const [vinculos] = await poolLegacy.query<any[]>(
        `SELECT ${col} AS id FROM ${t.vinculo} WHERE alojamiento_id = ? LIMIT 20`,
        [legacyId],
      );
      const ids = vinculos.map((f) => Number(f.id)).filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) continue;

      const cols = await columnasDe(t.origen);
      const puede = (c: string) => (cols.has(c) ? c : `NULL AS ${c}`);
      const select = ["id", puede("name") + " AS nombre", puede("category") + " AS categoria",
        puede("municipality") + " AS municipio", puede("province") + " AS provincia",
        puede("short_description") + " AS descripcion", puede("price") + " AS precio",
        puede("website_url") + " AS web", puede("source_name") + " AS fuente"].join(", ");
      const [filas] = await poolLegacy.query<any[]>(
        `SELECT ${select} FROM ${t.origen} WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      const fichas: FichaCatalogo[] = filas.map((f) => ({
        id: Number(f.id), nombre: String(f.nombre ?? "(sin nombre)"),
        categoria: f.categoria ?? null, municipio: f.municipio ?? null, provincia: f.provincia ?? null,
        descripcion: f.descripcion ? String(f.descripcion).slice(0, 200) : null,
        precio: f.precio === null || f.precio === undefined ? null : String(f.precio),
        web: f.web ?? null, fuente: f.fuente ?? null, enlazada: true,
      }));
      if (tipo === "experiencia") res.experiencias = fichas; else res.servicios = fichas;
    }
  } catch (e) {
    console.error("[hestiat] enlazadasDelAlojamiento", e);
  }
  return res;
}
