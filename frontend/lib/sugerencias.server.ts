import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { sugerenciasDestino } from "@/lib/db";

/**
 * SUGERENCIAS GENERALES — las de la cabecera.
 *
 * La barra de la cabecera busca en toda la web, así que al escribir se ofrecen las tres cosas:
 * destinos y alojamientos (lo que ya sabía hacer el buscador de alojamientos) y, además,
 * experiencias y servicios reales del catálogo.
 *
 * No hay lista escrita a mano: cada sugerencia sale de una consulta y lleva su recuento real.
 * Si una de las tres consultas falla, se devuelven las otras: la barra nunca se queda sin nada por
 * culpa de una parte.
 */
export interface SugerenciaGeneral {
  tipo: "ciudad" | "provincia" | "alojamiento" | "experiencia" | "servicio";
  texto: string;
  total: number;
}

async function deExperiencias(q: string, limite: number): Promise<SugerenciaGeneral[]> {
  const like = `%${q}%`;
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT name AS texto, COUNT(*) AS total
       FROM experiencia
      WHERE is_active = 1 AND name LIKE ?
      GROUP BY name
      ORDER BY (name LIKE ?) DESC, CHAR_LENGTH(name) ASC, total DESC
      LIMIT ?`,
    [like, `${q}%`, limite],
  );
  return filas.map((f) => ({ tipo: "experiencia" as const, texto: String(f.texto), total: Number(f.total) }));
}

async function deServicios(q: string, limite: number): Promise<SugerenciaGeneral[]> {
  const like = `%${q}%`;
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT name AS texto, COUNT(*) AS total
       FROM servicio_turistico
      WHERE is_active = 1 AND name LIKE ?
      GROUP BY name
      ORDER BY (name LIKE ?) DESC, CHAR_LENGTH(name) ASC, total DESC
      LIMIT ?`,
    [like, `${q}%`, limite],
  );
  return filas.map((f) => ({ tipo: "servicio" as const, texto: String(f.texto), total: Number(f.total) }));
}

export async function sugerenciasGenerales(q: string, limite = 8): Promise<SugerenciaGeneral[]> {
  const consulta = q.trim();
  if (consulta.length < 2) return [];

  // Los destinos y alojamientos ya tenían su consulta: se reutiliza tal cual, sin duplicar nada.
  const [destinos, experiencias, servicios] = await Promise.all([
    sugerenciasDestino(consulta, 4).catch(() => []),
    deExperiencias(consulta, 3).catch(() => []),
    deServicios(consulta, 3).catch(() => []),
  ]);

  const destinosTipados = destinos as SugerenciaGeneral[];

  // Se mezclan alternando: primero lo que empieza por lo escrito, y luego el resto, para que la
  // lista no se llene solo de un tipo.
  const empiezaPor = (s: SugerenciaGeneral) =>
    s.texto.toLowerCase().startsWith(consulta.toLowerCase()) ? 0 : 1;
  const todas = [...destinosTipados, ...experiencias, ...servicios]
    .filter((s, i, arr) => arr.findIndex((o) => o.tipo === s.tipo && o.texto === s.texto) === i)
    .sort((a, b) => empiezaPor(a) - empiezaPor(b) || b.total - a.total);

  const porTipo = new Map<string, number>();
  const salida: SugerenciaGeneral[] = [];
  for (const s of todas) {
    const n = porTipo.get(s.tipo) ?? 0;
    if (n >= 3) continue;
    porTipo.set(s.tipo, n + 1);
    salida.push(s);
    if (salida.length >= limite) break;
  }
  return salida;
}
