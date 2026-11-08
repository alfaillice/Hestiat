/**
 * Lectura y validación de lo imprescindible de una solicitud de reserva.
 *
 * Vive aquí, separado de la ruta, para poder probarlo sin servidor y sin base de datos.
 *
 * Por qué existe: la ruta llegaba a la consulta con un identificador de alojamiento no numérico. La
 * regla es simple — sin un alojamiento válido no se sigue adelante.
 */
export type EntradaReserva = {
  accommodationId: number;
  slug: string;
  desde: string;
  hasta: string;
  huespedes: number;
};

/**
 * Valida la entrada. Devuelve `null` cuando no se puede continuar, y quien llama responde con una
 * negativa limpia. No decide nada más: el precio y la autorización son de otras capas.
 */
export function leerEntradaReserva(bruto: {
  accommodationId?: unknown;
  slug?: unknown;
  desde?: unknown;
  hasta?: unknown;
  huespedes?: unknown;
}): EntradaReserva | null {
  const accommodationId = Number(bruto.accommodationId);
  if (!Number.isInteger(accommodationId) || accommodationId <= 0) return null;
  return {
    accommodationId,
    slug: String(bruto.slug ?? ""),
    desde: String(bruto.desde ?? ""),
    hasta: String(bruto.hasta ?? ""),
    huespedes: Number(bruto.huespedes ?? 1),
  };
}
