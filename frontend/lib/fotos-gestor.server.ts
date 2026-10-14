/**
 * GESTOR DE FOTOGRAFÍAS — UN SOLO SISTEMA PARA LOS TRES TIPOS. SOLO SERVIDOR.
 *
 * ── QUÉ REUTILIZA, Y CON QUÉ FIRMA ──────────────────────────────────────────────────────────────
 * Nada de esto es nuevo, y las firmas están comprobadas en el código:
 *   · `guardarImagenOptimizada(datos, extension, carpeta)` de `lib/almacen.server.ts`: sube el
 *     original, una versión optimizada y las miniaturas (sharp + R2). Devuelve `{ principal,
 *     original, variantes, aviso }`, así que la URL que se publica es `resultado.principal.url`.
 *   · `extensionDeMime` del mismo sitio, que trabaja con nombres cortos: "jpg", "png", "webp".
 *   · `borrarImagen(url)` para retirar un archivo del almacén.
 *   · `registrarAccion` para la auditoría común de la administración.
 *   · La tabla `imagen_compartida` para no borrar nunca un archivo que usen otras publicaciones.
 *
 * ── TIPO DE ARCHIVO POR BYTES DE CABECERA ───────────────────────────────────────────────────────
 * Nada de creerse lo que dice el navegador ni de instalar un paquete: se leen los primeros bytes.
 * JPEG empieza por FF D8 FF · PNG por 89 50 4E 47 · WebP por "RIFF" y "WEBP" en los bytes 8-11.
 *
 * ── UN REGISTRO, TRES TIPOS ─────────────────────────────────────────────────────────────────────
 * `publicacion_foto` es el modelo de `accommodation_photo` (orden, principal, alt, variantes) más
 * una columna de tipo. Las 207 fotos que ya existen NO se tocan ni se migran: se leen donde están.
 *
 * ── NO ES UNA GALERÍA DE VISUALIZACIÓN ──────────────────────────────────────────────────────────
 * `galeria.tsx` (ficha, con lightbox) y `galeria-alojamientos.tsx` (listado, scroll infinito) son
 * de VISUALIZACIÓN pública. Este es de GESTIÓN: subir, ordenar, marcar principal y borrar.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { extensionDeMime, guardarImagenOptimizada, borrarImagen } from "@/lib/almacen.server";
import { registrarAccion } from "@/lib/ia-auditoria.server";

export type TipoPublicacion = "alojamiento" | "experiencia" | "servicio";

export const MAX_FOTO_BYTES = 12 * 1024 * 1024;
export const MAX_FOTOS = 30;
/** Carpeta del almacén donde viven estas fotos. */
const CARPETA = "fotos";

export interface FotoPublicacion {
  id: number;
  url: string;
  orden: number;
  principal: boolean;
  alt: string | null;
}

/** Tipo de imagen por BYTES DE CABECERA. Una sola implementación, en un módulo puro y probado. */
export { tipoPorCabecera } from "@/lib/fotos-tipos";
import { tipoPorCabecera } from "@/lib/fotos-tipos";

/** Crea la tabla si no existe. Aditiva e idempotente: no cambia nada de lo anterior. */
let tablaAsegurada = false;
export async function asegurarTablaFotos(): Promise<void> {
  if (tablaAsegurada) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS publicacion_foto (
        id          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        tipo        enum('alojamiento','experiencia','servicio') NOT NULL,
        item_id     bigint(20) unsigned NOT NULL,
        storage_key varchar(255) NOT NULL DEFAULT '',
        url_publica varchar(1024) NOT NULL,
        alt         varchar(255) DEFAULT NULL,
        orden       int(11) NOT NULL DEFAULT 0,
        principal   tinyint(1) NOT NULL DEFAULT 0,
        subida_por  bigint(20) unsigned DEFAULT NULL,
        creado_en   datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY ix_foto_tipo_item (tipo, item_id, orden),
        KEY ix_foto_principal (tipo, item_id, principal)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  tablaAsegurada = true;
}

/** Las fotos de una publicación, con la principal primero. */
export async function fotosDe(tipo: TipoPublicacion, itemId: number): Promise<FotoPublicacion[]> {
  await asegurarTablaFotos();
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, url_publica, orden, principal, alt FROM publicacion_foto
      WHERE tipo = ? AND item_id = ? ORDER BY principal DESC, orden ASC, id ASC`,
    [tipo, itemId],
  );
  return filas.map((f) => ({
    id: Number(f.id),
    url: String(f.url_publica),
    orden: Number(f.orden),
    principal: Number(f.principal) === 1,
    alt: f.alt == null ? null : String(f.alt),
  }));
}

/** ¿La usa alguna otra publicación? Si hay duda, se considera compartida y NO se borra el archivo. */
export async function estaCompartida(url: string, excluyendoFotoId?: number): Promise<boolean> {
  try {
    const [registro] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT n FROM imagen_compartida WHERE url = ? LIMIT 1`,
      [url],
    );
    if (Number(registro[0]?.n ?? 0) > 1) return true;
  } catch {
    return true;
  }
  const [propias] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM publicacion_foto WHERE url_publica = ? AND id <> ?`,
    [url, excluyendoFotoId ?? 0],
  );
  return Number(propias[0]?.n ?? 0) > 0;
}

async function auditar(datos: {
  accion: string;
  tipo: TipoPublicacion;
  itemId: number;
  quien?: { usuarioId?: number | null; usuarioEmail?: string | null };
  detalle: Record<string, unknown>;
}) {
  await registrarAccion({
    accion: datos.accion,
    usuarioId: datos.quien?.usuarioId ?? null,
    usuarioEmail: datos.quien?.usuarioEmail ?? null,
    entidad: `publicacion_${datos.tipo}`,
    entidadId: datos.itemId,
    detalle: datos.detalle,
  }).catch(() => undefined);
}

/** SUBIR una fotografía. Todo se valida en el SERVIDOR. */
export async function subirFoto(datos: {
  tipo: TipoPublicacion;
  itemId: number;
  archivo: File;
  alt?: string | null;
  quien?: { usuarioId?: number | null; usuarioEmail?: string | null };
}): Promise<{ ok: true; foto: FotoPublicacion } | { ok: false; error: string }> {
  await asegurarTablaFotos();
  const { archivo } = datos;

  if (!archivo || typeof archivo.arrayBuffer !== "function") return { ok: false, error: "No ha llegado ningún archivo." };
  if (archivo.size === 0) return { ok: false, error: "El archivo está vacío." };
  if (archivo.size > MAX_FOTO_BYTES) {
    return { ok: false, error: `La imagen supera el máximo de ${Math.round(MAX_FOTO_BYTES / 1024 / 1024)} MB.` };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const formato = tipoPorCabecera(bytes);
  if (!formato || !extensionDeMime(formato)) {
    return { ok: false, error: "El archivo no es una imagen admitida (JPG, PNG o WebP)." };
  }

  const [cuantas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM publicacion_foto WHERE tipo = ? AND item_id = ?`,
    [datos.tipo, datos.itemId],
  );
  const existentes = Number(cuantas[0]?.n ?? 0);
  if (existentes >= MAX_FOTOS) return { ok: false, error: `Esta publicación ya tiene el máximo de ${MAX_FOTOS} fotografías.` };

  let guardada;
  try {
    guardada = await guardarImagenOptimizada(bytes, formato, CARPETA);
  } catch {
    return { ok: false, error: "No se ha podido guardar la imagen en el almacén." };
  }
  const principal = guardada?.principal;
  if (!principal?.url) return { ok: false, error: "El almacén no ha devuelto ninguna dirección para la imagen." };

  const esPrimera = existentes === 0;
  const [res] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO publicacion_foto (tipo, item_id, storage_key, url_publica, alt, orden, principal, subida_por)
     VALUES (?,?,?,?,?,?,?,?)`,
    [datos.tipo, datos.itemId, principal.clave ?? "", principal.url, datos.alt ?? null, existentes, esPrimera ? 1 : 0, datos.quien?.usuarioId ?? null],
  );

  await auditar({ accion: "foto_subida", tipo: datos.tipo, itemId: datos.itemId, quien: datos.quien, detalle: { foto_id: res.insertId, principal: esPrimera } });
  return { ok: true, foto: { id: res.insertId, url: principal.url, orden: existentes, principal: esPrimera, alt: datos.alt ?? null } };
}

/** Marca una foto como principal (y solo esa). */
export async function marcarPrincipal(
  tipo: TipoPublicacion,
  itemId: number,
  fotoId: number,
  quien?: { usuarioId?: number | null; usuarioEmail?: string | null },
): Promise<boolean> {
  await asegurarTablaFotos();
  const [res] = await pool.query<mysql.ResultSetHeader>(
    `UPDATE publicacion_foto SET principal = (id = ?) WHERE tipo = ? AND item_id = ?`,
    [fotoId, tipo, itemId],
  );
  if (res.affectedRows > 0) await auditar({ accion: "foto_principal", tipo, itemId, quien, detalle: { foto_id: fotoId } });
  return res.affectedRows > 0;
}

/** Reordena según la lista de identificadores recibida. */
export async function reordenar(
  tipo: TipoPublicacion,
  itemId: number,
  ids: number[],
  quien?: { usuarioId?: number | null; usuarioEmail?: string | null },
): Promise<boolean> {
  await asegurarTablaFotos();
  let orden = 0;
  for (const id of ids) {
    await pool.query(`UPDATE publicacion_foto SET orden = ? WHERE id = ? AND tipo = ? AND item_id = ?`, [orden++, id, tipo, itemId]);
  }
  await auditar({ accion: "foto_orden", tipo, itemId, quien, detalle: { cuantas: ids.length } });
  return true;
}

/**
 * ELIMINAR una fotografía: se quita SIEMPRE la referencia; el archivo solo si no lo usa nadie más.
 * Si era la principal, la siguiente pasa a serlo. La operación queda auditada.
 */
export async function eliminarFoto(
  tipo: TipoPublicacion,
  itemId: number,
  fotoId: number,
  quien?: { usuarioId?: number | null; usuarioEmail?: string | null },
): Promise<{ ok: boolean; archivoBorrado: boolean; quedan: number; motivo?: string }> {
  await asegurarTablaFotos();
  const [fila] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, url_publica, principal FROM publicacion_foto WHERE id = ? AND tipo = ? AND item_id = ? LIMIT 1`,
    [fotoId, tipo, itemId],
  );
  if (!fila[0]) return { ok: false, archivoBorrado: false, quedan: 0, motivo: "Esa fotografía no es de esta publicación." };

  const url = String(fila[0].url_publica);
  const eraPrincipal = Number(fila[0].principal) === 1;

  await pool.query(`DELETE FROM publicacion_foto WHERE id = ? AND tipo = ? AND item_id = ?`, [fotoId, tipo, itemId]);

  if (eraPrincipal) {
    const [siguiente] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM publicacion_foto WHERE tipo = ? AND item_id = ? ORDER BY orden ASC, id ASC LIMIT 1`,
      [tipo, itemId],
    );
    if (siguiente[0]) await marcarPrincipal(tipo, itemId, Number(siguiente[0].id), quien);
  }

  let archivoBorrado = false;
  if (!(await estaCompartida(url, fotoId))) {
    archivoBorrado = await borrarImagen(url).catch(() => false);
  }

  const [restantes] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM publicacion_foto WHERE tipo = ? AND item_id = ?`,
    [tipo, itemId],
  );

  await auditar({ accion: "foto_eliminada", tipo, itemId, quien, detalle: { foto_id: fotoId, archivo_borrado: archivoBorrado, era_principal: eraPrincipal } });
  return { ok: true, archivoBorrado, quedan: Number(restantes[0]?.n ?? 0) };
}
