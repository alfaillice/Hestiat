/**
 * AUDITORÍA, CONSUMO Y LÍMITES DEL AGENTE — SOLO SERVIDOR.
 *
 * Dónde se registra cada cosa, y por qué:
 *
 *   · CADA ACCIÓN va a `admin_auditoria`, la traza que YA usa la administración de Hestiat
 *     (la escribe también el proceso de mantenimiento). No se crea una auditoría paralela: habría
 *     dos historiales y ninguno sería completo. Se distingue por el prefijo `ia:` en la acción.
 *
 *   · EL CONSUMO (modelo, tokens, coste) va a `ia_consumo`, porque son datos que la auditoría
 *     genérica no tiene y que hacen falta para poder frenar el gasto. No es duplicar la auditoría:
 *     una dice QUÉ se hizo, la otra CUÁNTO costó.
 *
 * Nunca se escriben aquí claves, contraseñas ni contenido sensible: el detalle guarda la
 * herramienta, los argumentos acotados y el resultado en una línea, no conversaciones enteras.
 */
import { pool, poolLegacy } from "@/lib/db";

export type Nivel = 1 | 2 | 3;

/** Precios de REFERENCIA por millón de tokens (USD). Son estimaciones configurables: el proveedor
 *  es quien manda, y si algún día cambian sus tarifas hay que ajustar esto o poner las variables
 *  IA_PRECIO_<MODELO>_ENTRADA / _SALIDA en el entorno. */
const PRECIOS_REFERENCIA: Record<string, { entrada: number; salida: number }> = {
  "gpt-4.1-mini": { entrada: 0.4, salida: 1.6 },
  "gpt-4.1": { entrada: 2.0, salida: 8.0 },
  "gpt-4o-mini": { entrada: 0.15, salida: 0.6 },
  "gpt-4o": { entrada: 2.5, salida: 10.0 },
};

export function precioDe(modelo: string): { entrada: number; salida: number } {
  const directo = process.env[`IA_PRECIO_${modelo.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_ENTRADA`];
  const salida = process.env[`IA_PRECIO_${modelo.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_SALIDA`];
  if (directo && salida) return { entrada: Number(directo), salida: Number(salida) };
  return PRECIOS_REFERENCIA[modelo] ?? { entrada: 0, salida: 0 };
}

export function costeEstimado(modelo: string, tokensEntrada: number, tokensSalida: number): number {
  const p = precioDe(modelo);
  return (tokensEntrada / 1_000_000) * p.entrada + (tokensSalida / 1_000_000) * p.salida;
}

/** Registra una acción del agente en la auditoría común. */
export async function registrarAccion(datos: {
  accion: string;
  usuarioId?: number | null;
  usuarioEmail?: string | null;
  entidad?: string | null;
  entidadId?: string | number | null;
  detalle?: Record<string, unknown>;
}): Promise<void> {
  try {
    await poolLegacy.query(
      `INSERT INTO admin_auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
       VALUES (?,?,?,?,?,?)`,
      [
        datos.usuarioId ?? null,
        datos.usuarioEmail ?? "sistema:agente-ia",
        `ia:${datos.accion}`.slice(0, 80),
        (datos.entidad ?? null)?.toString().slice(0, 60) ?? null,
        datos.entidadId != null ? String(datos.entidadId).slice(0, 60) : null,
        JSON.stringify(datos.detalle ?? {}).slice(0, 4000),
      ],
    );
  } catch (error) {
    // Que falle el registro no puede tumbar la acción, pero tiene que quedar rastro en el log.
    console.error("[hestiat] no se pudo registrar la acción del agente:", error instanceof Error ? error.message : error);
  }
}

/** Registra el consumo de una llamada al modelo. */
export async function registrarConsumo(datos: {
  conversacionId?: number | null;
  tarea?: string | null;
  proveedor?: string | null;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}): Promise<number> {
  const coste = costeEstimado(datos.modelo, datos.tokensEntrada, datos.tokensSalida);
  try {
    await pool.query(
      `INSERT INTO ia_consumo (conversacion_id, tarea, proveedor, modelo, tokens_entrada, tokens_salida, coste_estimado)
       VALUES (?,?,?,?,?,?,?)`,
      [
        datos.conversacionId ?? null,
        datos.tarea?.slice(0, 80) ?? null,
        datos.proveedor?.slice(0, 40) ?? null,
        datos.modelo.slice(0, 80),
        datos.tokensEntrada,
        datos.tokensSalida,
        coste,
      ],
    );
  } catch (error) {
    console.error("[hestiat] no se pudo registrar el consumo:", error instanceof Error ? error.message : error);
  }
  return coste;
}

export interface ConsumoHoy {
  llamadas: number;
  tokensEntrada: number;
  tokensSalida: number;
  costeUsd: number;
}

export async function consumoDeHoy(): Promise<ConsumoHoy> {
  const [filas] = await pool.query<any[]>(
    `SELECT COUNT(*) AS llamadas, COALESCE(SUM(tokens_entrada),0) AS te,
            COALESCE(SUM(tokens_salida),0) AS ts, COALESCE(SUM(coste_estimado),0) AS coste
       FROM ia_consumo WHERE creado_en >= CURDATE()`,
  );
  const f = filas[0] ?? {};
  return {
    llamadas: Number(f.llamadas ?? 0),
    tokensEntrada: Number(f.te ?? 0),
    tokensSalida: Number(f.ts ?? 0),
    costeUsd: Number(f.coste ?? 0),
  };
}

export async function consumoUltimaHora(): Promise<number> {
  const [filas] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM ia_consumo WHERE creado_en >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
  );
  return Number(filas[0]?.n ?? 0);
}

export interface Limites {
  permitido: boolean;
  motivo?: string;
  llamadasUltimaHora: number;
  limiteHora: number;
  costeHoyUsd: number;
  presupuestoDiaUsd: number;
}

/**
 * Comprueba los límites antes de llamar al modelo. Si no se puede leer la configuración, se
 * aplican los valores por defecto MÁS ESTRICTOS: un fallo nunca debe abrir la mano.
 */
export async function comprobarLimites(): Promise<Limites> {
  let limiteHora = 120;
  let presupuestoDia = 5;
  try {
    const [filas] = await pool.query<any[]>(`SELECT clave, valor FROM ia_config`);
    for (const f of filas) {
      // `Number(valor) || porDefecto` convertia un 0 en el valor por defecto (el 0 es falsy), asi que
      // un presupuesto de 0 no cortaba el gasto. Se comprueba que sea un numero de verdad.
      const numero = Number(f.valor);
      if (f.clave === "limite_llamadas_por_hora" && Number.isFinite(numero)) limiteHora = numero;
      if (f.clave === "limite_gasto_diario_usd" && Number.isFinite(numero)) presupuestoDia = numero;
    }
  } catch {
    /* se queda con los valores por defecto */
  }
  const [ultimaHora, hoy] = await Promise.all([consumoUltimaHora(), consumoDeHoy()]);
  if (ultimaHora >= limiteHora) {
    return { permitido: false, motivo: `límite de ${limiteHora} llamadas por hora alcanzado`, llamadasUltimaHora: ultimaHora, limiteHora, costeHoyUsd: hoy.costeUsd, presupuestoDiaUsd: presupuestoDia };
  }
  if (hoy.costeUsd >= presupuestoDia) {
    return { permitido: false, motivo: `presupuesto diario de ${presupuestoDia} USD alcanzado (gasto de hoy: ${hoy.costeUsd.toFixed(4)} USD)`, llamadasUltimaHora: ultimaHora, limiteHora, costeHoyUsd: hoy.costeUsd, presupuestoDiaUsd: presupuestoDia };
  }
  return { permitido: true, llamadasUltimaHora: ultimaHora, limiteHora, costeHoyUsd: hoy.costeUsd, presupuestoDiaUsd: presupuestoDia };
}

/** Lee la configuración de autonomía (nivel máximo permitido y si los envíos necesitan aprobación). */
export async function configAutonomia(): Promise<{ nivelMaximo: Nivel; enviosRequierenAprobacion: boolean; valores: Record<string, string> }> {
  const valores: Record<string, string> = {};
  try {
    const [filas] = await pool.query<any[]>(`SELECT clave, valor FROM ia_config`);
    for (const f of filas) valores[f.clave] = String(f.valor);
  } catch {
    /* valores por defecto */
  }
  const nivel = Number(valores.nivel_autonomia ?? 2);
  return {
    nivelMaximo: (nivel === 1 || nivel === 3 ? nivel : 2) as Nivel,
    enviosRequierenAprobacion: (valores.envios_requieren_aprobacion ?? "1") === "1",
    valores,
  };
}
