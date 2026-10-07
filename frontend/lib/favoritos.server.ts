/**
 * Favoritos — SOLO SERVIDOR.
 *
 * El sistema de favoritos NO existía: no había tabla en ninguna de las dos bases. Por eso se
 * implementa de verdad en lugar de pintar corazones que no guardan nada.
 *
 * Dónde vive: en el esquema ANTIGUO (`hestiat`), junto a `usuario`. Es dato de usuario y debe
 * sobrevivir a cualquier reconstrucción del catálogo público. La tabla es NUEVA y solo aditiva: no
 * se toca ninguna tabla existente ni se añaden claves ajenas entre esquemas (el id del alojamiento
 * vive en `hestiat2`, y una FK entre bases distintas no se puede declarar de verdad).
 */
import { poolLegacy } from "@/lib/db";

let tablaLista: Promise<void> | null = null;

async function crearTabla(): Promise<void> {
  await poolLegacy.query(
    `CREATE TABLE IF NOT EXISTS favorito (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       usuario_id BIGINT UNSIGNED NOT NULL,
       accommodation_id BIGINT UNSIGNED NOT NULL,
       creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_favorito_usuario_alojamiento (usuario_id, accommodation_id),
       KEY ix_favorito_usuario (usuario_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

/** Idempotente y memorizado: se comprueba una vez por proceso. */
export function asegurarTablaFavoritos(): Promise<void> {
  if (!tablaLista) tablaLista = crearTabla().catch((e) => { tablaLista = null; throw e; });
  return tablaLista;
}

/** Marca o desmarca. Devuelve el estado final real, leído de la base. */
export async function alternarFavorito(usuarioId: number, accommodationId: number): Promise<boolean> {
  await asegurarTablaFavoritos();
  const [borrados] = await poolLegacy.query<any>(
    `DELETE FROM favorito WHERE usuario_id = ? AND accommodation_id = ?`,
    [usuarioId, accommodationId],
  );
  if (Number((borrados as any)?.affectedRows ?? 0) > 0) return false;
  await poolLegacy.query(
    `INSERT INTO favorito (usuario_id, accommodation_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE creado_en = creado_en`,
    [usuarioId, accommodationId],
  );
  return true;
}

/** Ids de alojamiento guardados por el usuario. */
export async function favoritosDe(usuarioId: number): Promise<number[]> {
  await asegurarTablaFavoritos();
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT accommodation_id FROM favorito WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 500`,
    [usuarioId],
  );
  return filas.map((f) => Number(f.accommodation_id)).filter((n) => Number.isInteger(n) && n > 0);
}

/** De los ids dados, cuáles están guardados (una sola consulta para toda la galería). */
export async function guardadosEntre(usuarioId: number, ids: number[]): Promise<Set<number>> {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (limpios.length === 0) return new Set();
  await asegurarTablaFavoritos();
  const huecos = limpios.map(() => "?").join(",");
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT accommodation_id FROM favorito WHERE usuario_id = ? AND accommodation_id IN (${huecos})`,
    [usuarioId, ...limpios],
  );
  return new Set(filas.map((f) => Number(f.accommodation_id)));
}
