import { pool, poolLegacy } from "@/lib/db";

/**
 * FOTOS DE LOS ANUNCIOS DE UN ANFITRIÓN.
 *
 * Cuenta cuántos de sus alojamientos publicados no tienen ninguna foto propia. Se cuenta sobre el
 * catálogo público (`accommodation`) y el vínculo del anfitrión, que guarda el identificador antiguo
 * del alojamiento (`legacy_id`). Una sola implementación: la usa el panel, no la interfaz.
 */
export async function fotosDeMisAnuncios(usuarioId: number): Promise<{ total: number; sinFotos: number }> {
  try {
    const [vinculos] = await poolLegacy.query<any[]>(
      `SELECT alojamiento_id FROM alojamiento_anfitrion WHERE usuario_id = ? LIMIT 200`,
      [usuarioId],
    );
    const legacyIds = vinculos.map((v) => Number(v.alojamiento_id)).filter((n) => Number.isInteger(n) && n > 0);
    if (legacyIds.length === 0) return { total: 0, sinFotos: 0 };
    const marcas = legacyIds.map(() => "?").join(",");
    const [filas] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id = a.id) THEN 1 ELSE 0 END) AS sin_fotos
         FROM accommodation a
        WHERE a.legacy_id IN (${marcas}) AND a.status = 'published'`,
      legacyIds,
    );
    return { total: Number(filas[0]?.total ?? 0), sinFotos: Number(filas[0]?.sin_fotos ?? 0) };
  } catch (error) {
    // Que una cuenta no sepa cuántas fotos le faltan no puede tumbar su panel.
    console.error("[hestiat] fotos de mis anuncios", error);
    return { total: 0, sinFotos: 0 };
  }
}
