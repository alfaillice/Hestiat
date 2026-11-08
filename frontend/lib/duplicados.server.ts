/**
 * Detección de duplicados — SOLO servidor (puntos 10, 11 y 36 de la especificación).
 *
 * Objetivo: que Hestiat no cree dos publicaciones para el mismo alojamiento real. Se comprueba
 * ANTES de insertar, y la comprobación vive en el servidor (no en el navegador, que se puede
 * manipular).
 *
 * Cómo se decide: la similitud NO es una sola señal. Un título genérico como «Casa rural» se
 * repite legítimamente decenas de veces en toda España; lo que delata un duplicado real es la
 * combinación de título parecido + misma localidad, o directamente las mismas coordenadas.
 * Por eso se puntúa y se explica el motivo, en vez de bloquear por una coincidencia suelta.
 */
import { poolLegacy } from "@/lib/db";

export interface CandidatoDuplicado {
  id: number;
  titulo: string;
  slug: string | null;
  ciudad: string | null;
  provincia: string | null;
  motivo: string;
  puntos: number;
}

/** Normaliza un texto para comparar: sin acentos, sin puntuación y sin espacios de más. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de Levenshtein, para parecidos que no son idénticos («Can Noves» / «Can Nova»). */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previa = actual;
  }
  return previa[b.length];
}

/**
 * Busca publicaciones que podrían ser el mismo alojamiento.
 *
 * `excluirId` se usa al EDITAR: no tiene sentido avisar de que se parece a sí misma.
 */
export async function buscarSimilares(entrada: {
  titulo: string;
  ciudad?: string | null;
  lat?: number | null;
  lng?: number | null;
  excluirId?: number | null;
}): Promise<CandidatoDuplicado[]> {
  const titulo = normalizar(entrada.titulo ?? "");
  if (titulo.length < 4) return [];
  const candidatos = new Map<number, CandidatoDuplicado>();

  const anotar = (fila: Record<string, unknown>, motivo: string, puntos: number) => {
    const id = Number(fila.id);
    if (entrada.excluirId && id === Number(entrada.excluirId)) return;
    const previo = candidatos.get(id);
    if (previo) {
      previo.puntos += puntos;
      if (!previo.motivo.includes(motivo)) previo.motivo += ` y ${motivo}`;
      return;
    }
    candidatos.set(id, {
      id,
      titulo: String(fila.titulo ?? ""),
      slug: fila.slug ? String(fila.slug) : null,
      ciudad: fila.ciudad ? String(fila.ciudad) : null,
      provincia: fila.provincia ? String(fila.provincia) : null,
      motivo,
      puntos,
    });
  };

  // 1. Mismas coordenadas: la señal más fuerte que existe. Dos alojamientos no pueden estar en
  //    el mismo punto exacto salvo que sean el mismo.
  if (typeof entrada.lat === "number" && typeof entrada.lng === "number") {
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT id, titulo, slug, ciudad, provincia FROM alojamiento
        WHERE lat IS NOT NULL AND lng IS NOT NULL
          AND ABS(lat - ?) < 0.0005 AND ABS(lng - ?) < 0.0005 LIMIT 25`,
      [entrada.lat, entrada.lng],
    );
    for (const f of filas) anotar(f, "mismas coordenadas", 5);
  }

  // 2. Título idéntico en la misma localidad.
  if (entrada.ciudad && entrada.ciudad.trim()) {
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT id, titulo, slug, ciudad, provincia FROM alojamiento
        WHERE LOWER(TRIM(titulo)) = ? AND LOWER(TRIM(ciudad)) = ? LIMIT 25`,
      [entrada.titulo.trim().toLowerCase(), entrada.ciudad.trim().toLowerCase()],
    );
    for (const f of filas) anotar(f, "mismo título en la misma localidad", 5);
  }

  // 3. Título igual en cualquier parte: se avisa, pero pesa menos (los nombres genéricos se
  //    repiten de verdad entre pueblos distintos).
  const [mismos] = await poolLegacy.query<any[]>(
    `SELECT id, titulo, slug, ciudad, provincia FROM alojamiento
      WHERE LOWER(TRIM(titulo)) = ? LIMIT 25`,
    [entrada.titulo.trim().toLowerCase()],
  );
  for (const f of mismos) anotar(f, "mismo título", 2);

  // 4. Títulos muy parecidos (una letra, un plural, una errata) en la misma localidad.
  if (entrada.ciudad && entrada.ciudad.trim()) {
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT id, titulo, slug, ciudad, provincia FROM alojamiento
        WHERE LOWER(TRIM(ciudad)) = ? AND titulo IS NOT NULL AND titulo <> '' LIMIT 400`,
      [entrada.ciudad.trim().toLowerCase()],
    );
    for (const f of filas) {
      const otro = normalizar(String(f.titulo ?? ""));
      if (otro.length < 4) continue;
      const d = distancia(titulo, otro);
      const largo = Math.max(titulo.length, otro.length);
      const parecido = 1 - d / largo;
      if (parecido >= 0.86) anotar(f, "título muy parecido en la misma zona", 3);
    }
  }

  return [...candidatos.values()]
    .filter((c) => c.puntos >= 2)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 12);
}

/* --------------------------------------------------------------- auditoría -- */

export interface BloqueAuditoria {
  clave: string;
  titulo: string;
  descripcion: string;
  total: number;
  muestra: Record<string, unknown>[];
}

/**
 * Auditoría automática de la base (punto 36). Solo lectura: cuenta y muestra. No corrige nada sola.
 */
export async function auditoria(): Promise<BloqueAuditoria[]> {
  const definiciones: [string, string, string, string][] = [
    ["slugs_duplicados", "Slugs duplicados",
      "Dos publicaciones con la misma URL: es lo que rompe el SEO y crea páginas duplicadas.",
      `SELECT slug, COUNT(*) AS veces FROM alojamiento WHERE slug IS NOT NULL AND slug <> ''
        GROUP BY slug HAVING veces > 1 ORDER BY veces DESC LIMIT 25`],
    ["slugs_invalidos", "Slugs con formato inválido",
      "URLs que no cumplen el formato limpio (minúsculas, números y guiones).",
      `SELECT id, slug FROM alojamiento
        WHERE slug IS NOT NULL AND slug <> '' AND slug NOT REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' LIMIT 25`],
    ["fotos_compartidas", "Fotografías compartidas entre alojamientos",
      "Una misma imagen usada como foto de varias propiedades distintas: contenido duplicado.",
      `SELECT url, COUNT(*) AS veces, COUNT(DISTINCT alojamiento_id) AS propiedades FROM alojamiento_foto
        WHERE url IS NOT NULL AND url <> '' GROUP BY url HAVING propiedades > 1
        ORDER BY propiedades DESC LIMIT 25`],
    ["fotos_huerfanas", "Fotografías huérfanas",
      "Filas de foto cuyo alojamiento ya no existe: residuo de borrados.",
      `SELECT COUNT(*) AS total FROM alojamiento_foto f
        LEFT JOIN alojamiento a ON a.id = f.alojamiento_id WHERE a.id IS NULL`],
    ["sin_foto", "Alojamientos sin ninguna foto",
      "Aparecen en los resultados sin imagen: pierden casi todo el interés para el visitante.",
      `SELECT COUNT(*) AS total FROM alojamiento a
        WHERE NOT EXISTS (SELECT 1 FROM alojamiento_foto f WHERE f.alojamiento_id = a.id)`],
    ["sin_anfitrion", "Alojamientos sin anfitrión asociado",
      "Nadie puede gestionarlos: no aparecen en ningún panel de anfitrión.",
      `SELECT COUNT(*) AS total FROM alojamiento a
        WHERE NOT EXISTS (SELECT 1 FROM alojamiento_anfitrion af WHERE af.alojamiento_id = a.id)`],
    ["sin_precio", "Alojamientos sin precio",
      "Ni precio por noche ni orientativo: la ficha no puede mostrar tarifa.",
      `SELECT COUNT(*) AS total FROM alojamiento
        WHERE (precio_noche IS NULL OR precio_noche = 0)
          AND (precio_orientativo IS NULL OR precio_orientativo = 0)`],
    ["sin_ubicacion", "Alojamientos sin coordenadas",
      "No pueden salir en el mapa, que es una parte central del producto.",
      `SELECT COUNT(*) AS total FROM alojamiento WHERE lat IS NULL OR lng IS NULL`],
    ["titulos_genericos", "Títulos genéricos o de prueba",
      "Títulos vacíos o de relleno que no describen el alojamiento.",
      `SELECT id, titulo, ciudad FROM alojamiento
        WHERE titulo IS NULL OR titulo = ''
           OR LOWER(TRIM(titulo)) IN ('casa','alojamiento','sin titulo','test','prueba','alojamiento sin titulo')
        LIMIT 25`],
    ["mismas_coordenadas", "Varios alojamientos en el mismo punto exacto",
      "Comparten latitud y longitud idénticas: posible duplicado real.",
      `SELECT lat, lng, ciudad, COUNT(*) AS veces FROM alojamiento
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        GROUP BY lat, lng, ciudad HAVING veces > 1 ORDER BY veces DESC LIMIT 25`],
  ];

  const bloques: BloqueAuditoria[] = [];
  for (const [clave, titulo, descripcion, sql] of definiciones) {
    try {
      const [filas] = await poolLegacy.query<any[]>(sql);
      const esRecuento = filas.length === 1 && "total" in (filas[0] ?? {});
      bloques.push({
        clave,
        titulo,
        descripcion,
        total: esRecuento ? Number(filas[0].total) : filas.length,
        muestra: esRecuento ? [] : (filas as Record<string, unknown>[]),
      });
    } catch (error) {
      bloques.push({
        clave,
        titulo,
        descripcion,
        total: -1,
        muestra: [{ error: error instanceof Error ? error.message.slice(0, 140) : "error" }],
      });
    }
  }
  return bloques;
}
