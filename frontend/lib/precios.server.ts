/**
 * Precios del alojamiento — SOLO servidor.
 *
 * DETALLE IMPORTANTE DE INTEGRACIÓN: el catálogo público (portada, buscador y fichas) lee el
 * esquema NUEVO (`accommodation`), mientras que los paneles leen el esquema antiguo
 * (`alojamiento`). Si al cambiar el precio solo se actualizara una de las dos tablas, el anfitrión
 * vería el precio nuevo en su panel y los visitantes seguirían viendo el viejo. Aquí se escriben
 * las dos, enlazadas por `legacy_id`.
 *
 * CONFLICTO CON RESERVAS: una reserva guarda su propio precio y su total en el momento de
 * crearse, así que cambiar la tarifa **no altera ninguna reserva existente** — y eso es
 * exactamente lo que debe pasar: el precio acordado no se toca.
 *
 * Lo que sí hace el sistema es avisar: si hay reservas futuras, el anfitrión tiene que confirmar
 * expresamente que entiende que la tarifa nueva se aplica a las reservas NUEVAS y no a las ya
 * hechas. Es un aviso, no un bloqueo, porque cambiar el precio es legítimo.
 */
import { poolLegacy } from "@/lib/db";

/**
 * La tabla del catálogo público vive en la base NUEVA, mientras que esta conexión (`poolLegacy`)
 * apunta a la base antigua. Hay que cualificar el nombre del esquema o la consulta falla con
 * «table doesn't exist» — un fallo que solo aparece al guardar y que quedó destapado en las pruebas.
 */
const BD_CATALOGO = /^[A-Za-z0-9_]+$/.test(process.env.DB_NAME_NEW ?? "") ? (process.env.DB_NAME_NEW as string) : "hestiat2";

export interface PrecioAlojamiento {
  alojamientoId: number;
  titulo: string;
  precioNoche: number | null;
  precioOrientativo: number | null;
  reservasFuturas: number;
}

export async function alojamientoConPrecio(usuarioId: number, alojamientoId: number): Promise<PrecioAlojamiento | null> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id, a.titulo, a.precio_noche, a.precio_orientativo
       FROM alojamiento a
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = a.id
      WHERE a.id = ? AND af.usuario_id = ? LIMIT 1`,
    [alojamientoId, usuarioId],
  );
  const a = filas[0];
  if (!a) return null;

  const [res] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM reserva
      WHERE alojamiento_id = ? AND llegada >= CURDATE() AND estado IN ('pendiente','confirmada')`,
    [alojamientoId],
  );

  return {
    alojamientoId: Number(a.id),
    titulo: String(a.titulo),
    precioNoche: a.precio_noche === null ? null : Number(a.precio_noche),
    precioOrientativo: a.precio_orientativo === null ? null : Number(a.precio_orientativo),
    reservasFuturas: Number(res[0]?.n ?? 0),
  };
}

export type ResultadoPrecio =
  | { ok: true; precioNoche: number | null; precioOrientativo: number | null }
  | { ok: false; aviso: string; reservasFuturas: number }
  | { ok: false; error: string };

function importe(v: FormDataEntryValue | null): number | null {
  const bruto = String(v ?? "").trim();
  if (bruto === "") return null;
  const n = Number(bruto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function cambiarPrecio(usuarioId: number, alojamientoId: number, formulario: FormData): Promise<ResultadoPrecio> {
  const actual = await alojamientoConPrecio(usuarioId, alojamientoId);
  if (!actual) return { ok: false, error: "Ese alojamiento no es tuyo." };

  const precioNoche = importe(formulario.get("precio_noche"));
  const precioOrientativo = importe(formulario.get("precio_orientativo"));
  if (precioNoche === null && precioOrientativo === null) {
    return { ok: false, error: "Indica al menos un precio (por noche u orientativo)." };
  }
  if ((precioNoche ?? 0) > 100000 || (precioOrientativo ?? 0) > 100000) {
    return { ok: false, error: "El precio parece demasiado alto. Revísalo." };
  }

  // Aviso si hay reservas futuras y no se ha confirmado que se entiende que no se tocan.
  if (actual.reservasFuturas > 0 && formulario.get("confirmado") !== "1") {
    return {
      ok: false,
      reservasFuturas: actual.reservasFuturas,
      aviso: `Tienes ${actual.reservasFuturas} ${actual.reservasFuturas === 1 ? "reserva futura" : "reservas futuras"}. El precio nuevo se aplicará a las reservas nuevas: las ya hechas mantienen el importe acordado. Confirma que quieres cambiar la tarifa.`,
    };
  }

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE alojamiento SET precio_noche = ?, precio_orientativo = ? WHERE id = ?`, [
      precioNoche, precioOrientativo, alojamientoId,
    ]);

    // Espejo en el esquema nuevo: es el que ven los visitantes. `price_type` pasa a 'real' solo si
    // hay tarifa por noche, porque a partir de ahí el precio deja de ser una estimación.
    const tipo = precioNoche !== null ? "real" : "indicative";
    await conn.query(
      `UPDATE ${BD_CATALOGO}.accommodation
          SET price_per_night = ?, indicative_price = ?, price_type = ?, price_source = 'anfitrion', price_checked_at = NOW()
        WHERE legacy_id = ?`,
      [precioNoche, precioOrientativo, tipo, alojamientoId],
    );

    await conn.commit();
    return { ok: true, precioNoche, precioOrientativo };
  } catch (error) {
    await conn.rollback();
    console.error("[hestiat] cambiarPrecio", error);
    return { ok: false, error: "No se ha podido guardar el precio." };
  } finally {
    conn.release();
  }
}
