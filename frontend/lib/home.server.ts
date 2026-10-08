/**
 * Datos de la portada. Todo sale de la base real: nada de datos de ejemplo.
 *
 * Tres decisiones que conviene tener claras:
 *
 *  · DESTINOS. Se eligen ciudades que existen de verdad en el catálogo, con su recuento real de
 *    alojamientos publicados. El enlace lleva a Explorar ya filtrado por ese destino, así que el
 *    número que se enseña es el que se ve al entrar. Alicante se ofrece por provincia
 *    (`Alacant/Alicante`), no por ciudad, porque en la ciudad solo hay 9 alojamientos y la
 *    provincia tiene 496: se dice cuál de las dos cosas es cada destino.
 *
 *  · CATEGORÍAS. Servicios y Experiencias se sacan de sus tablas reales (34.075 servicios y
 *    253.005 experiencias) agrupadas por su categoría, ordenadas por cuántas hay. No se inventa
 *    ninguna categoría ni ningún recuento.
 *
 *  · ALOJAMIENTOS. Se reutiliza la misma consulta y la misma tarjeta que usa Explorar, así que el
 *    precio que se ve aquí es exactamente el mismo, con el mismo formateador.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { IMAGEN_DESTINO, categoryImageMap } from "@/lib/imagenes-home";

/* ------------------------------------------------------------- destinos -- */

export interface DestinoHome {
  nombre: string;
  /** Enlace a Explorar ya filtrado. */
  href: string;
  total: number;
  imagen: string | null;
  /** Qué es realmente cada destino: se dice, no se disimula. */
  ambito: "ciudad" | "provincia";
  /** El valor exacto que hay en la base. */
  valor: string;
}

/**
 * Destinos curados: ciudades reales del catálogo, con alojamientos publicados y con su monumento
 * fotografiado. El orden es de izquierda a derecha en la portada.
 */
const DESTINOS: { nombre: string; campo: "city" | "province"; valor: string }[] = [
  { nombre: "Madrid", campo: "city", valor: "Madrid" },
  { nombre: "Barcelona", campo: "city", valor: "Barcelona" },
  { nombre: "Granada", campo: "city", valor: "Granada" },
  { nombre: "Sevilla", campo: "city", valor: "Sevilla" },
  { nombre: "València", campo: "city", valor: "València" },
  { nombre: "Málaga", campo: "city", valor: "Málaga" },
  { nombre: "Bilbao", campo: "city", valor: "Bilbao" },
  { nombre: "Córdoba", campo: "city", valor: "Córdoba" },
  { nombre: "Santiago de Compostela", campo: "city", valor: "Santiago de Compostela" },
  { nombre: "Salamanca", campo: "city", valor: "Salamanca" },
  // La ciudad de Alicante tiene 9 alojamientos; la provincia, 496. Se ofrece la provincia y se dice.
  { nombre: "Alicante", campo: "province", valor: "Alacant/Alicante" },
];

/** Ciudades y provincias del catálogo con su recuento real, ya con su foto verificada. */
export async function destinosParaTi(): Promise<DestinoHome[]> {
  const ciudades = DESTINOS.filter((d) => d.campo === "city").map((d) => d.valor);
  const provincias = DESTINOS.filter((d) => d.campo === "province").map((d) => d.valor);
  const marcasC = ciudades.map(() => "?").join(",");
  const marcasP = provincias.length ? provincias.map(() => "?").join(",") : null;

  const consultas = [
    pool.query<mysql.RowDataPacket[]>(
      `SELECT city AS valor, COUNT(*) AS total FROM accommodation
        WHERE status = 'published' AND city IN (${marcasC}) GROUP BY city`,
      ciudades,
    ),
  ];
  if (marcasP) {
    consultas.push(
      pool.query<mysql.RowDataPacket[]>(
        `SELECT province AS valor, COUNT(*) AS total FROM accommodation
          WHERE status = 'published' AND province IN (${marcasP}) GROUP BY province`,
        provincias,
      ),
    );
  }
  const resultados = (await Promise.all(consultas)).flatMap(([filas]) => filas);

  const cuenta = new Map<string, number>();
  for (const f of resultados) cuenta.set(String(f.valor), Number(f.total ?? 0));

  return DESTINOS.map((d) => {
    const total = cuenta.get(d.valor) ?? 0;
    return {
      nombre: d.nombre,
      total,
      ambito: d.campo === "city" ? ("ciudad" as const) : ("provincia" as const),
      valor: d.valor,
      href:
        d.campo === "city"
          ? `/search?q=${encodeURIComponent(d.valor)}`
          : `/search?provincia=${encodeURIComponent(d.valor)}`,
      imagen: IMAGEN_DESTINO[d.nombre]?.url ?? null,
    };
  }).filter((d) => d.total > 0);
}

/* ---------------------------------------------------------- categorías -- */

export interface CategoriaHome {
  /** El valor real de la categoría (el que se usa para filtrar). */
  valor: string;
  /** El nombre que se enseña. */
  nombre: string;
  total: number;
  /** Cadena de imágenes propias de la categoría, en orden: WebP → PNG → otras → respaldo. */
  imagenes: string[];
  href: string;
}

/** Categorías de SERVICIOS con más oferta real, ya con la clasificación de Hestiat. */
export async function categoriasServicio(limite = 8): Promise<CategoriaHome[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    // `servicio_turistico.category` guarda el nombre de la categoría original (OpenStreetMap). La web
    // usa la clasificación de Hestiat, que es la que tiene sus propias categorías y subcategorías.
    `SELECT c.slug AS valor, c.nombre AS nombre, COUNT(*) AS total
       FROM servicio_turistico s
       JOIN servicio_clasificacion cl ON cl.servicio_id = s.id
       JOIN serv_categoria c ON c.id = cl.categoria_id
      WHERE s.is_active = 1
      GROUP BY c.id, c.slug, c.nombre, c.orden
      ORDER BY total DESC LIMIT ?`,
    [limite],
  );
  return filas.map((f) => {
    const valor = String(f.valor);
    return {
      valor,
      nombre: valor,
      total: Number(f.total ?? 0),
      imagenes: categoryImageMap("servicio", valor),
      href: `/servicios?categoria=${encodeURIComponent(valor)}`,
    };
  });
}

/** Categorías de EXPERIENCIAS con más oferta real, con su nombre propio. */
export async function categoriasExperiencia(limite = 8): Promise<CategoriaHome[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    // `experiencia.category` guarda el NOMBRE de la categoría (por ejemplo «Naturaleza»), no un
    // identificador: la unión por `slug` que había antes no encontraba nada y se enseñaba el valor
    // en crudo. Ahora se usa la clasificación nueva de Hestiat, que es la que manda en toda la web.
    `SELECT c.slug AS valor, c.nombre AS nombre, COUNT(*) AS total
       FROM experiencia e
       JOIN experiencia_clasificacion cl ON cl.experiencia_id = e.id
       JOIN exp_categoria c ON c.id = cl.categoria_id
      WHERE e.is_active = 1
      GROUP BY c.id, c.slug, c.nombre
      ORDER BY total DESC LIMIT ?`,
    [limite],
  );
  return filas.map((f) => {
    const valor = String(f.valor);
    return {
      valor,
      nombre: String(f.nombre ?? valor),
      total: Number(f.total ?? 0),
      imagenes: categoryImageMap("experiencia", valor),
      href: `/experiencias?categoria=${encodeURIComponent(valor)}`,
    };
  });
}
