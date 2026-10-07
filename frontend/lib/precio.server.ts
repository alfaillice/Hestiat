/**
 * Cálculo del precio de una estancia — SOLO SERVIDOR, y **una sola implementación**.
 *
 * Esta función es la única que sabe cuánto cuesta una estancia. La usan:
 *   · la solicitud de reserva (importe definitivo que se guarda),
 *   · la vista previa del editor de alojamientos,
 *   · cualquier futura pantalla que enseñe un precio.
 *
 * Duplicar esta lógica en el navegador sería garantizar que un día la vista previa y lo que se
 * cobra no coincidan. Aquí no se duplica: el editor pregunta al servidor.
 *
 * Sobre los conceptos: Hestiat no cobra comisión ninguna. La limpieza, las tasas y los impuestos
 * son importes **del anfitrión**, no de la plataforma, y solo se suman si el anfitrión los ha
 * definido. Mientras estén vacíos (hoy lo están en los 27.359 alojamientos), el total es
 * exactamente noches × precio, igual que antes de este cambio.
 */
import { nochesEntre } from "@/lib/fechas";

export interface ParametrosPrecio {
  precioNoche: number;
  moneda: string;
  desde: string;
  hasta: string;
  orientativo?: boolean;
  /** Importe fijo de limpieza por estancia. */
  limpieza?: number | null;
  /** Tasas u otros importes fijos por estancia. */
  tasas?: number | null;
  /** Impuestos en porcentaje sobre la base (noches + limpieza + tasas). */
  impuestosPct?: number | null;
  /** Precio por noche de cada huésped que exceda el número incluido. */
  precioHuespedExtra?: number | null;
  /** Huéspedes incluidos en el precio base. */
  huespedesIncluidos?: number | null;
  huespedes?: number | null;
  descuentoSemanal?: number | null;
  descuentoMensual?: number | null;
  estanciaMinima?: number | null;
  estanciaMaxima?: number | null;
}

export interface DesglosePrecio {
  noches: number;
  precioNoche: number;
  base: number;
  limpieza: number;
  tasas: number;
  huespedesExtra: number;
  importeHuespedesExtra: number;
  descuentoPct: number;
  descuentoMotivo: string | null;
  importeDescuento: number;
  impuestosPct: number;
  impuestos: number;
  /** Base después de descuentos y antes de impuestos: lo que se guarda como subtotal. */
  baseImponible: number;
  total: number;
  moneda: string;
  orientativo: boolean;
  /** Avisos reales (estancia mínima/máxima incumplida), no decorativos. */
  avisos: string[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const red = (n: number): number => Math.round(n * 100) / 100;

export function calcularDesglose(p: ParametrosPrecio): DesglosePrecio {
  const noches = Math.max(0, nochesEntre(p.desde, p.hasta));
  const precioNoche = num(p.precioNoche);
  const moneda = p.moneda || "EUR";
  const avisos: string[] = [];

  const estanciaMinima = Math.round(num(p.estanciaMinima));
  const estanciaMaxima = Math.round(num(p.estanciaMaxima));
  if (noches > 0 && estanciaMinima > 0 && noches < estanciaMinima) {
    avisos.push(`Este alojamiento pide un mínimo de ${estanciaMinima} noches.`);
  }
  if (noches > 0 && estanciaMaxima > 0 && noches > estanciaMaxima) {
    avisos.push(`Este alojamiento admite como máximo ${estanciaMaxima} noches seguidas.`);
  }

  const base = red(precioNoche * noches);
  const limpieza = noches > 0 ? num(p.limpieza) : 0;
  const tasas = noches > 0 ? num(p.tasas) : 0;

  // Huéspedes por encima de los incluidos: se cobra por noche y por huésped de más.
  const incluidos = num(p.huespedesIncluidos);
  const huespedes = num(p.huespedes);
  const extra = num(p.precioHuespedExtra);
  const deMas = incluidos > 0 && huespedes > incluidos ? huespedes - incluidos : 0;
  const huespedesExtra = extra > 0 ? deMas : 0;
  const importeHuespedesExtra = red(extra * deMas * noches);

  // Descuento por duración: se aplica el mayor de los dos que corresponda, nunca los dos a la vez.
  let descuentoPct = 0;
  let descuentoMotivo: string | null = null;
  if (noches >= 28 && num(p.descuentoMensual) > 0) {
    descuentoPct = num(p.descuentoMensual);
    descuentoMotivo = "descuento por estancia larga";
  } else if (noches >= 7 && num(p.descuentoSemanal) > 0) {
    descuentoPct = num(p.descuentoSemanal);
    descuentoMotivo = "descuento semanal";
  }
  const sobreQueDescuenta = base + limpieza + tasas + importeHuespedesExtra;
  const importeDescuento = red((sobreQueDescuenta * descuentoPct) / 100);

  const impuestosPct = num(p.impuestosPct);
  const baseImponible = red(sobreQueDescuenta - importeDescuento);
  const impuestos = red((baseImponible * impuestosPct) / 100);

  return {
    noches,
    precioNoche: red(precioNoche),
    base,
    limpieza: red(limpieza),
    tasas: red(tasas),
    huespedesExtra,
    importeHuespedesExtra,
    descuentoPct,
    descuentoMotivo,
    importeDescuento,
    impuestosPct,
    impuestos,
    baseImponible,
    total: red(baseImponible + impuestos),
    moneda,
    orientativo: Boolean(p.orientativo),
    avisos,
  };
}
