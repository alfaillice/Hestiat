/**
 * «Cerca de ti»: la lógica real de proximidad, en un solo sitio.
 *
 * Dos formas de proximidad, y ninguna inventada:
 *
 *  · Con un PUNTO (la ubicación que la persona ha autorizado): se ordena por la distancia real,
 *    calculada en la base con las coordenadas que ya tienen los alojamientos y las experiencias.
 *    Solo en este caso se dice «a 3,2 km», porque solo aquí hay una distancia de verdad.
 *
 *  · Con un DESTINO (una ciudad elegida o la última buscada): se ordena por ese destino. No es
 *    proximidad a la persona, así que NO se muestra ninguna distancia: el título lo dice tal cual
 *    («cerca de Madrid»).
 *
 * Lo que no hay coordenadas no entra en el orden por distancia: nunca se coloca nada en un punto
 * inventado ni se rellena un hueco con datos falsos. Y si hay menos de los 13 pedidos, se devuelven
 * los que haya.
 */
import * as mysql from "mysql2/promise";
import { pool, buscar } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import type { AlojamientoCerca, ExperienciaCerca } from "@/lib/cerca.tipos";

// Las formas de los datos viven en `cerca.tipos` para que el navegador pueda usarlas sin arrastrar
// el acceso a la base. Se reexportan para que quien importe de aquí siga encontrándolas.
export type { AlojamientoCerca, ExperienciaCerca } from "@/lib/cerca.tipos";

export interface PuntoCerca {
  lat: number;
  lng: number;
}

/** El máximo por sección: 13, como se pidió. Si hay menos, se enseñan los que haya. */
export const MAXIMO = 13;

/** Distancia en metros calculada por la base (haversine), para alojamientos. */
export const DISTANCIA_ALOJAMIENTO = `(6371000 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(a.lat)) * COS(RADIANS(a.lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(a.lat)))))`;
/** La misma fórmula, para experiencias. */
const DISTANCIA_EXPERIENCIA = `(6371000 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(e.latitude)) * COS(RADIANS(e.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(e.latitude)))))`;

/** «a 3,2 km» o «a 850 m». Solo se usa cuando hay una distancia calculada de verdad. */
export function distanciaLegible(metros: unknown): string | undefined {
  const m = Number(metros);
  if (!Number.isFinite(m) || m < 0) return undefined;
  if (m < 950) return `a ${Math.round(m / 10) * 10} m`;
  return `a ${(m / 1000).toFixed(1).replace(".", ",")} km`;
}


/* ---------------------------------------------------------- alojamientos -- */

export async function alojamientosCerca(
  opciones: { punto?: PuntoCerca; destino?: string },
  limite = MAXIMO,
): Promise<{ total: number; items: AlojamientoCerca[]; cercaniaMetros: number | null }> {
  const r = opciones.punto
    ? await buscar({ cerca: opciones.punto, orden: "recomendados", pagina: 1, porPagina: limite })
    : await buscar({ q: (opciones.destino ?? "").trim(), pagina: 1, porPagina: limite });

  // La distancia del más cercano: es lo que permite decidir si «cerca de ti» significa algo.
  const distancias = r.items
    .map((fila) => Number((fila as unknown as Record<string, unknown>).distancia_m))
    .filter((m) => Number.isFinite(m));

  return {
    total: r.total,
    cercaniaMetros: distancias.length > 0 ? Math.min(...distancias) : null,
    items: r.items.map((fila) => {
      const f = fila as unknown as Record<string, unknown>;
      const tarjeta = aTarjeta(f) as AlojamientoCerca;
      // La distancia SOLO se dice cuando hay un punto de referencia real.
      if (opciones.punto) tarjeta.nota = distanciaLegible(f.distancia_m);
      return tarjeta;
    }),
  };
}

/* --------------------------------------------------------- experiencias -- */

/**
 * Experiencias cercanas: por distancia real si hay punto; por municipio o provincia si hay destino.
 * Sin coordenadas no se ordena por distancia, y sin destino no se inventa uno: en ese caso devuelve
 * una selección del catálogo, que es lo que se enseña como «Experiencias que pueden interesarte».
 */
export async function experienciasCerca(
  opciones: { punto?: PuntoCerca; destino?: string },
  limite = MAXIMO,
): Promise<ExperienciaCerca[]> {
  const campos = `e.id, e.name AS nombre, e.category AS categoria, e.municipality AS municipio,
                  e.province AS provincia, e.main_image AS imagen, e.price AS precio, e.currency AS moneda`;
  const selec = `SELECT ${campos}${opciones.punto ? `, ${DISTANCIA_EXPERIENCIA} AS distancia_m` : ", NULL AS distancia_m"}`;

  const where: string[] = ["e.is_active = 1"];
  const valores: unknown[] = [];
  if (opciones.punto) {
    where.push("e.latitude IS NOT NULL AND e.longitude IS NOT NULL");
    valores.push(opciones.punto.lat, opciones.punto.lng, opciones.punto.lat);
  }
  const destino = (opciones.destino ?? "").trim();
  if (!opciones.punto && destino) {
    // El destino puede guardarse como municipio o como provincia: se aceptan los dos.
    where.push("(e.municipality = ? OR e.province = ?)");
    valores.push(destino, destino);
  }

  const orden = opciones.punto
    ? `ORDER BY ${DISTANCIA_EXPERIENCIA} ASC, e.id ASC`
    : "ORDER BY (e.main_image IS NULL) ASC, (e.rating_count > 0) DESC, e.rating_count DESC, e.id ASC";
  const params = opciones.punto ? [...valores, ...valores.slice(0, 3)] : valores;

  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `${selec} FROM experiencia e WHERE ${where.join(" AND ")} ${orden} LIMIT ?`,
    [...params, limite],
  );

  return filas.map((f) => ({
    id: Number(f.id),
    nombre: String(f.nombre ?? "").slice(0, 70),
    categoria: f.categoria ?? null,
    municipio: f.municipio ?? null,
    provincia: f.provincia ?? null,
    imagen: f.imagen ?? null,
    precio: f.precio !== null && f.precio !== undefined ? String(f.precio) : null,
    nota: opciones.punto ? distanciaLegible(f.distancia_m) : undefined,
    href: f.provincia ? `/experiencias?provincia=${encodeURIComponent(String(f.provincia))}` : "/experiencias",
  }));
}
