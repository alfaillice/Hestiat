/**
 * Utilidades de fechas compartidas (puras, sin acceso a datos).
 *
 * Viven aquí y no en `reservas.server` porque las necesitan tanto el cálculo de precios como las
 * reservas: dejarlas en un módulo que importa al otro crearía una dependencia circular.
 */

/** Noches entre dos fechas ISO (la salida no cuenta como noche). */
export function nochesEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Todas las noches del intervalo [desde, hasta). */
export function nochesDe(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const a = new Date(`${desde}T00:00:00Z`);
  const b = new Date(`${hasta}T00:00:00Z`);
  for (let d = new Date(a); d < b; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
