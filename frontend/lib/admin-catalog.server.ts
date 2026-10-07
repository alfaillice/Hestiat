/**
 * Alta y edición de alojamientos desde la administración — SOLO servidor.
 *
 * Una sola implementación para la ruta de API y para la comprobación de duplicados de la página:
 * la lógica no puede vivir en dos sitios.
 *
 * Reglas:
 *  · Lista blanca de columnas: no se acepta del formulario ninguna columna que no esté aquí, para
 *    que un campo añadido en el navegador no pueda escribir donde no debe.
 *  · La comprobación de duplicados se hace ANTES de crear, y si hay candidatos no se crea nada
 *    hasta que alguien confirme expresamente que son alojamientos distintos.
 *  · Nunca se inventan coordenadas: si no se dan, se guarda NULL y el mapa no lo pinta.
 */
import { poolLegacy } from "@/lib/db";
import { buscarSimilares, type CandidatoDuplicado } from "@/lib/duplicados.server";

export type ResultadoAlta =
  | { ok: true; id: number }
  | { ok: false; error: string }
  | { ok: false; duplicados: CandidatoDuplicado[] };

function aSlug(titulo: string): string {
  const base = titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return `${base || "alojamiento"}-${Math.random().toString(36).slice(2, 7)}`;
}

function numero(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coordenada(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function crearAlojamiento(formulario: FormData): Promise<ResultadoAlta> {
  const titulo = String(formulario.get("titulo") ?? "").trim().slice(0, 255);
  if (!titulo) return { ok: false, error: "El título es obligatorio." };

  const ciudad = String(formulario.get("ciudad") ?? "").trim().slice(0, 120) || null;
  const provincia = String(formulario.get("provincia") ?? "").trim().slice(0, 120) || null;
  const lat = coordenada(formulario.get("lat"));
  const lng = coordenada(formulario.get("lng"));
  if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
    return { ok: false, error: "Las coordenadas no son válidas: latitud de -90 a 90 y longitud de -180 a 180." };
  }

  if (formulario.get("confirmado") !== "1") {
    const similares = await buscarSimilares({ titulo, ciudad, lat, lng });
    if (similares.length > 0) return { ok: false, duplicados: similares };
  }

  const [res] = await poolLegacy.query<any>(
    `INSERT INTO alojamiento (titulo, slug, ciudad, provincia, lat, lng, precio_noche, precio_orientativo, activo)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [titulo, aSlug(titulo), ciudad, provincia, lat, lng,
     numero(formulario.get("precio_noche")), numero(formulario.get("precio_orientativo")),
     formulario.get("activo") === "1" ? 1 : 0],
  );
  const nuevoId = Number(res.insertId);

  // Si se indica un anfitrión y existe, se vincula. Si no existe, el alta se mantiene igual: perder
  // el alojamiento entero por un correo mal escrito sería peor.
  const emailAnfitrion = String(formulario.get("anfitrion") ?? "").trim().toLowerCase();
  if (emailAnfitrion && nuevoId) {
    const [us] = await poolLegacy.query<any[]>(`SELECT id FROM usuario WHERE email = ? LIMIT 1`, [emailAnfitrion]);
    if (us[0]) {
      await poolLegacy.query(
        `INSERT IGNORE INTO alojamiento_anfitrion (alojamiento_id, usuario_id) VALUES (?,?)`,
        [nuevoId, us[0].id],
      );
    }
  }
  return { ok: true, id: nuevoId };
}

export async function actualizarAlojamiento(id: number, formulario: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Alojamiento no válido." };
  const titulo = String(formulario.get("titulo") ?? "").trim().slice(0, 255);
  if (!titulo) return { ok: false, error: "El título es obligatorio." };

  await poolLegacy.query(
    `UPDATE alojamiento SET titulo = ?, precio_noche = ?, precio_orientativo = ?, activo = ? WHERE id = ?`,
    [titulo, numero(formulario.get("precio_noche")), numero(formulario.get("precio_orientativo")),
     formulario.get("activo") === "1" ? 1 : 0, id],
  );
  return { ok: true };
}
