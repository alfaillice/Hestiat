/**
 * Acceso a datos del ESQUEMA ANTIGUO — SOLO servidor.
 *
 * Los ficheros de medios y canales se han portado **copiando la implementación original** de la
 * aplicación antigua, que llamaba a `query` / `queryOne` / `withTransaction`. En vez de reescribir
 * esa lógica (y arriesgar diferencias de comportamiento), se le da exactamente la misma interfaz
 * sobre el pool de la base ORIGINAL, que es donde viven las fotos, los canales y las sesiones.
 *
 * Todo pasa por consultas parametrizadas: nunca se interpola un valor en el SQL.
 */
import type { PoolConnection } from "mysql2/promise";
import { poolLegacy } from "@/lib/db";

export { poolLegacy as getPool };

export async function query<T = Record<string, unknown>>(sql: string, valores: unknown[] = []): Promise<T[]> {
  const [filas] = await poolLegacy.query<any[]>(sql, valores);
  return filas as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, valores: unknown[] = []): Promise<T | null> {
  const filas = await query<T>(sql, valores);
  return filas[0] ?? null;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
