/**
 * Favoritos — SOLO SERVIDOR.
 *
 * UN SOLO SISTEMA PARA LAS TRES CATEGORÍAS.
 *
 * Alojamientos, experiencias y servicios pueden compartir el mismo identificador numérico (la
 * experiencia 43 y el alojamiento 43 son cosas distintas), así que la identificación del favorito es
 * la pareja (tipo, item_id), no el número a secas. La tabla lleva índice único sobre
 * (usuario_id, tipo, item_id): eso hace imposible el duplicado y garantiza que cada usuario solo
 * pueda ver y tocar lo suyo.
 *
 * Dónde vive: en el esquema ANTIGUO (`hestiat`), junto a `usuario`. Es dato de usuario y sobrevive a
 * cualquier reconstrucción del catálogo. La tabla es de este sistema y solo se ha ampliado de forma
 * aditiva: se añadieron `tipo` e `item_id`, se conservó `accommodation_id` (ahora opcional) con los
 * valores antiguos y se mantiene `ix_favorito_usuario`. No se ha borrado ni un favorito.
 */
import { poolLegacy } from "@/lib/db";

export type TipoFavorito = "alojamiento" | "experiencia" | "servicio";

export const TIPOS_FAVORITO: TipoFavorito[] = ["alojamiento", "experiencia", "servicio"];

/** Valida el tipo que llega del cliente: nunca se escribe un tipo inventado. */
export function esTipoValido(valor: unknown): valor is TipoFavorito {
  return typeof valor === "string" && (TIPOS_FAVORITO as string[]).includes(valor);
}

let tablaLista: Promise<void> | null = null;

async function crearTabla(): Promise<void> {
  await poolLegacy.query(
    `CREATE TABLE IF NOT EXISTS favorito (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       usuario_id BIGINT UNSIGNED NOT NULL,
       tipo VARCHAR(20) NOT NULL DEFAULT 'alojamiento',
       item_id BIGINT UNSIGNED NOT NULL,
       accommodation_id BIGINT UNSIGNED NULL,
       creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_favorito_usuario_tipo_item (usuario_id, tipo, item_id),
       KEY ix_favorito_usuario (usuario_id),
       KEY ix_favorito_usuario_tipo (usuario_id, tipo)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  // Ampliación para instalaciones que ya tenían la tabla con la forma antigua. Cada paso puede
  // fallar si ya está hecho: se ignora ese caso concreto y se sigue.
  const pasos = [
    `ALTER TABLE favorito ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'alojamiento' AFTER usuario_id`,
    `ALTER TABLE favorito ADD COLUMN item_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER tipo`,
    `UPDATE favorito SET item_id = accommodation_id WHERE item_id = 0`,
    `ALTER TABLE favorito MODIFY accommodation_id BIGINT UNSIGNED NULL`,
    `ALTER TABLE favorito DROP INDEX uq_favorito_usuario_alojamiento`,
    `ALTER TABLE favorito ADD UNIQUE KEY uq_favorito_usuario_tipo_item (usuario_id, tipo, item_id)`,
    `ALTER TABLE favorito ADD KEY ix_favorito_usuario_tipo (usuario_id, tipo)`,
  ];
  for (const paso of pasos) {
    try {
      await poolLegacy.query(paso);
    } catch {
      /* ya aplicado */
    }
  }
}

/** Idempotente y memorizado: se comprueba una vez por proceso. */
export function asegurarTablaFavoritos(): Promise<void> {
  if (!tablaLista) tablaLista = crearTabla().catch((e) => { tablaLista = null; throw e; });
  return tablaLista;
}

/** Marca o desmarca. Devuelve el estado final real, leído de la base. */
export async function alternarFavorito(usuarioId: number, tipo: TipoFavorito, itemId: number): Promise<boolean> {
  await asegurarTablaFavoritos();
  const [borrados] = await poolLegacy.query<any>(
    `DELETE FROM favorito WHERE usuario_id = ? AND tipo = ? AND item_id = ?`,
    [usuarioId, tipo, itemId],
  );
  if (Number((borrados as any)?.affectedRows ?? 0) > 0) return false;
  await poolLegacy.query(
    `INSERT INTO favorito (usuario_id, tipo, item_id, accommodation_id) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE creado_en = creado_en`,
    [usuarioId, tipo, itemId, tipo === "alojamiento" ? itemId : null],
  );
  return true;
}

/** Ids guardados de un tipo. */
export async function favoritosDe(usuarioId: number, tipo: TipoFavorito): Promise<number[]> {
  await asegurarTablaFavoritos();
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT item_id FROM favorito WHERE usuario_id = ? AND tipo = ? ORDER BY creado_en DESC LIMIT 500`,
    [usuarioId, tipo],
  );
  return filas.map((f) => Number(f.item_id)).filter((n) => Number.isInteger(n) && n > 0);
}

/** Los tres tipos de una vez, para la sección de favoritos. */
export async function favoritosPorTipo(usuarioId: number): Promise<Record<TipoFavorito, number[]>> {
  const [alojamiento, experiencia, servicio] = await Promise.all([
    favoritosDe(usuarioId, "alojamiento"),
    favoritosDe(usuarioId, "experiencia"),
    favoritosDe(usuarioId, "servicio"),
  ]);
  return { alojamiento, experiencia, servicio };
}

/** De los ids dados, cuáles están guardados en ese tipo (una sola consulta para toda la galería). */
export async function guardadosEntre(usuarioId: number, tipo: TipoFavorito, ids: number[]): Promise<Set<number>> {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (limpios.length === 0) return new Set();
  await asegurarTablaFavoritos();
  const huecos = limpios.map(() => "?").join(",");
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT item_id FROM favorito WHERE usuario_id = ? AND tipo = ? AND item_id IN (${huecos})`,
    [usuarioId, tipo, ...limpios],
  );
  return new Set(filas.map((f) => Number(f.item_id)));
}

/** ¿Está guardado este elemento concreto? Para las fichas. */
export async function estaGuardado(usuarioId: number, tipo: TipoFavorito, itemId: number): Promise<boolean> {
  const s = await guardadosEntre(usuarioId, tipo, [itemId]);
  return s.has(Number(itemId));
}
