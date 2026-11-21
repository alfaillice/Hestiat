// Motor de dimensionamiento solar y de baterías.
//
// Principio (regla del proyecto): nada inventado. Todo sale de fórmulas estándar del sector y de
// datos de irradiación orientativos; cada supuesto es visible y editable, y el resultado se
// presenta como ESTIMACIÓN, no como un proyecto de ingeniería.

/**
 * Horas Sol Pico (HSP) = irradiación media diaria anual sobre plano inclinado óptimo,
 * en kWh/m²/día. Valores ORIENTATIVOS por provincia (orden de magnitud tipo PVGIS). Sirven para
 * una primera estimación; el valor real depende de inclinación, orientación y sombras.
 */
export const HSP_PROVINCIA: Record<string, number> = {
  "A Coruña": 3.4, "Álava": 3.5, "Albacete": 4.9, "Alicante": 5.1, "Almería": 5.4,
  "Asturias": 3.3, "Ávila": 4.7, "Badajoz": 5.1, "Baleares": 4.9, "Barcelona": 4.4,
  "Bizkaia": 3.3, "Burgos": 4.1, "Cáceres": 5.0, "Cádiz": 5.3, "Cantabria": 3.3,
  "Castellón": 4.7, "Ciudad Real": 5.0, "Córdoba": 5.3, "Cuenca": 4.8, "Gipuzkoa": 3.2,
  "Girona": 4.4, "Granada": 5.2, "Guadalajara": 4.7, "Huelva": 5.4, "Huesca": 4.5,
  "Jaén": 5.2, "La Rioja": 4.2, "Las Palmas": 5.6, "León": 4.2, "Lleida": 4.6,
  "Lugo": 3.4, "Madrid": 4.8, "Málaga": 5.3, "Murcia": 5.2, "Navarra": 3.9,
  "Ourense": 3.7, "Palencia": 4.2, "Pontevedra": 3.6, "Salamanca": 4.6, "Santa Cruz de Tenerife": 5.6,
  "Segovia": 4.6, "Sevilla": 5.3, "Soria": 4.4, "Tarragona": 4.6, "Teruel": 4.6,
  "Toledo": 4.9, "Valencia": 4.9, "Valladolid": 4.4, "Zamora": 4.4, "Zaragoza": 4.5,
  "Ceuta": 5.1, "Melilla": 5.2,
};

export const PROVINCIAS = Object.keys(HSP_PROVINCIA).sort((a, b) => a.localeCompare(b, "es"));

export type Objetivo = "ahorro" | "autoconsumo" | "respaldo" | "aislada";

export interface EntradaCalculo {
  /** Consumo anual en kWh (si se tiene). Alternativa: factura mensual media en €. */
  consumoAnualKwh?: number;
  facturaMensualEur?: number;
  provincia: string;
  objetivo: Objetivo;
  /** Supuestos editables, con valores por defecto razonables (no son promesas). */
  potenciaPanelW?: number;   // Wp por panel
  precioLuzEurKwh?: number;  // €/kWh de la factura
  costeInstalacionEurKwp?: number; // €/kWp instalado llave en mano
  autoconsumoPct?: number;   // % de la producción que se aprovecha directamente
}

export interface ResultadoCalculo {
  consumoAnualKwh: number;
  consumoDiarioKwh: number;
  hsp: number;
  potenciaKwp: number;
  paneles: number;
  potenciaRealKwp: number;
  inversorKw: number;
  bateriaKwh: number | null;
  produccionAnualKwh: number;
  coberturaPct: number;
  ahorroAnualEur: number;
  inversionEur: number;
  amortizacionAnios: number | null;
  supuestos: {
    potenciaPanelW: number;
    prendimiento: number;
    precioLuzEurKwh: number;
    costeInstalacionEurKwp: number;
    autoconsumoPct: number;
  };
  avisos: string[];
}

const PR = 0.8; // performance ratio típico de una instalación bien orientada

export function dimensionar(e: EntradaCalculo): ResultadoCalculo {
  const avisos: string[] = [];
  const potenciaPanelW = e.potenciaPanelW ?? 450;
  const precioLuzEurKwh = e.precioLuzEurKwh ?? 0.18;
  const costeInstalacionEurKwp = e.costeInstalacionEurKwp ?? 1300;
  const autoconsumoPct = clamp(e.autoconsumoPct ?? autoconsumoPorObjetivo(e.objetivo), 10, 100);

  const hsp = HSP_PROVINCIA[e.provincia] ?? 4.6;
  if (!HSP_PROVINCIA[e.provincia]) avisos.push("Provincia no reconocida: se usa una media nacional de 4,6 HSP.");

  // Consumo anual: directo, o estimado desde la factura (orientativo).
  let consumoAnualKwh = e.consumoAnualKwh ?? 0;
  if (!consumoAnualKwh && e.facturaMensualEur) {
    // Estimación grosera: la factura no es solo energía (hay potencia, impuestos, alquiler contador).
    // Se asume que ~60% de la factura es energía consumida.
    consumoAnualKwh = ((e.facturaMensualEur * 12) * 0.6) / precioLuzEurKwh;
    avisos.push("Consumo estimado a partir de la factura (orientativo): mejor usar los kWh reales del año.");
  }
  if (!consumoAnualKwh) {
    consumoAnualKwh = 3500; // media hogar español, solo como punto de partida
    avisos.push("Sin consumo indicado: se usa una media de hogar (3.500 kWh/año). Introduce tu consumo real para afinar.");
  }

  const consumoDiarioKwh = consumoAnualKwh / 365;

  // Potencia fotovoltaica para producir aproximadamente el consumo anual.
  const potenciaKwp = consumoAnualKwh / (hsp * 365 * PR);
  const paneles = Math.max(1, Math.ceil((potenciaKwp * 1000) / potenciaPanelW));
  const potenciaRealKwp = round(paneles * (potenciaPanelW / 1000), 2);
  const inversorKw = round(potenciaRealKwp * 0.9, 1);

  const produccionAnualKwh = Math.round(potenciaRealKwp * hsp * 365 * PR);
  const coberturaPct = Math.round((produccionAnualKwh / consumoAnualKwh) * 100);

  // Batería: solo si el objetivo lo pide. Se dimensiona para cubrir el consumo que NO es diurno.
  let bateriaKwh: number | null = null;
  if (e.objetivo === "autoconsumo" || e.objetivo === "respaldo" || e.objetivo === "aislada") {
    const fraccionNoche = e.objetivo === "aislada" ? 1.0 : e.objetivo === "respaldo" ? 0.6 : 0.45;
    // Capacidad útil necesaria; se añade margen por la profundidad de descarga (LFP ~90%).
    const utilKwh = consumoDiarioKwh * fraccionNoche;
    bateriaKwh = round(Math.min(utilKwh / 0.9, e.objetivo === "aislada" ? 30 : 15), 1);
    if (bateriaKwh >= (e.objetivo === "aislada" ? 30 : 15)) {
      avisos.push("La batería recomendada se ha limitado a un tamaño razonable; para aislada total conviene un estudio específico.");
    }
  }

  // Economía: con supuestos EDITABLES. Es una estimación, nunca una garantía de ahorro.
  const energiaAprovechadaKwh = Math.min(produccionAnualKwh * (autoconsumoPct / 100), consumoAnualKwh);
  const ahorroAnualEur = Math.round(energiaAprovechadaKwh * precioLuzEurKwh);
  const inversionEur = Math.round(potenciaRealKwp * costeInstalacionEurKwp + (bateriaKwh ? bateriaKwh * 400 : 0));
  const amortizacionAnios = ahorroAnualEur > 0 ? round(inversionEur / ahorroAnualEur, 1) : null;

  avisos.push("Resultado orientativo. Un instalador debe confirmar tejado, sombras, orientación, legalización y presupuesto real.");

  return {
    consumoAnualKwh: Math.round(consumoAnualKwh),
    consumoDiarioKwh: round(consumoDiarioKwh, 1),
    hsp,
    potenciaKwp: round(potenciaKwp, 2),
    paneles,
    potenciaRealKwp,
    inversorKw,
    bateriaKwh,
    produccionAnualKwh,
    coberturaPct,
    ahorroAnualEur,
    inversionEur,
    amortizacionAnios,
    supuestos: {
      potenciaPanelW,
      prendimiento: PR,
      precioLuzEurKwh,
      costeInstalacionEurKwp,
      autoconsumoPct,
    },
    avisos,
  };
}

function autoconsumoPorObjetivo(o: Objetivo): number {
  if (o === "ahorro") return 45;
  if (o === "autoconsumo") return 70;
  if (o === "respaldo") return 75;
  return 95; // aislada: casi todo se aprovecha (con batería)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function round(n: number, dec: number) {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}
