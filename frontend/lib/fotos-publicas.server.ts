/**
 * Reflejo de las fotografías del panel en el catálogo público — SOLO SERVIDOR.
 *
 * El problema que resuelve: el gestor de medios escribía SOLO en `alojamiento_foto` (esquema
 * antiguo) mientras la ficha pública lee `accommodation_photo` (esquema nuevo). Resultado: un
 * anfitrión subía una foto y **su página pública no la mostraba**. Aquí se mantienen las dos
 * tablas en el mismo estado con cada operación del gestor.
 *
 * Se empareja por la URL del objeto (`storage_key`/`origin_url`), que es única por fichero: así
 * nunca se toca la fotografía de otro alojamiento, que es lo que había que garantizar. Las fotos
 * migradas que no gestiona el panel no se tocan.
 */
import { pool } from "@/lib/db";

async function accommodationIdDe(legacyId: number): Promise<number | null> {
  const [filas] = await pool.query<any[]>(`SELECT id FROM accommodation WHERE legacy_id = ? LIMIT 1`, [legacyId]);
  return filas[0] ? Number(filas[0].id) : null;
}

export async function reflejarSubida(
  legacyId: number,
  foto: { url: string; alt: string | null; ancho: number | null; alto: number | null; orden: number },
): Promise<void> {
  const id = await accommodationIdDe(legacyId);
  if (id === null) return;
  const [previas] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM accommodation_photo WHERE accommodation_id = ?`, [id]);
  const esPrimera = Number(previas[0]?.n ?? 0) === 0;
  await pool.query(
    `INSERT INTO accommodation_photo
       (accommodation_id, storage_key, origin_url, alt, width, height, sort_order, is_primary, license, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [id, foto.url, foto.url, foto.alt, foto.ancho, foto.alto, foto.orden, esPrimera ? 1 : 0, "propia"],
  );
  if (esPrimera) await marcarPrimera(id, foto.url);
}

/** Reordena el catálogo público siguiendo el orden del panel. La primera es la principal. */
export async function reflejarOrden(legacyId: number, urls: string[]): Promise<void> {
  const id = await accommodationIdDe(legacyId);
  if (id === null || urls.length === 0) return;
  for (let i = 0; i < urls.length; i += 1) {
    await pool.query(
      `UPDATE accommodation_photo SET sort_order = ?, is_primary = ?
        WHERE accommodation_id = ? AND (storage_key = ? OR origin_url = ?)`,
      [i, i === 0 ? 1 : 0, id, urls[i], urls[i]],
    );
  }
}

export async function reflejarBorrado(legacyId: number, url: string): Promise<void> {
  const id = await accommodationIdDe(legacyId);
  if (id === null) return;
  await pool.query(`DELETE FROM accommodation_photo WHERE accommodation_id = ? AND (storage_key = ? OR origin_url = ?)`, [
    id,
    url,
    url,
  ]);
  // Si se ha borrado la que era principal, la primera que quede pasa a serlo: la ficha nunca se
  // queda sin imagen de portada por un borrado.
  const [resto] = await pool.query<any[]>(
    `SELECT COALESCE(storage_key, origin_url) AS url FROM accommodation_photo
      WHERE accommodation_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1`,
    [id],
  );
  const [principal] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM accommodation_photo WHERE accommodation_id = ? AND is_primary = 1`,
    [id],
  );
  if (Number(principal[0]?.n ?? 0) === 0 && resto[0]?.url) await marcarPrimera(id, String(resto[0].url));
}

/** Fija cuál es la foto principal del catálogo público. */
export async function marcarPrimera(accommodationId: number, url: string): Promise<void> {
  await pool.query(`UPDATE accommodation_photo SET is_primary = 0 WHERE accommodation_id = ?`, [accommodationId]);
  await pool.query(
    `UPDATE accommodation_photo SET is_primary = 1, sort_order = 0
      WHERE accommodation_id = ? AND (storage_key = ? OR origin_url = ?)`,
    [accommodationId, url, url],
  );
}

/** Marca como principal una foto del panel (por su id antiguo), y la pone la primera. */
export async function marcarPrincipalDelPanel(legacyId: number, urlsEnOrden: string[]): Promise<void> {
  await reflejarOrden(legacyId, urlsEnOrden);
}
