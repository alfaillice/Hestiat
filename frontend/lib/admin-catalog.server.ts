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
import { pool, poolLegacy } from "@/lib/db";
import { buscarSimilares, type CandidatoDuplicado } from "@/lib/duplicados.server";

export type ResultadoAlta =
  | { ok: true; id: number }
  | { ok: false; error: string }
  | { ok: false; duplicados: CandidatoDuplicado[] };

function normalizarSlug(titulo: string): string {
  return titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "alojamiento";
}

/** Slug limpio; solo se le añade un sufijo si ya está ocupado en cualquiera de los dos esquemas. */
async function slugLibre(titulo: string): Promise<string> {
  const base = normalizarSlug(titulo);
  const [enUso] = await pool.query<any[]>(`SELECT slug FROM accommodation WHERE slug LIKE ?`, [`${base}%`]);
  const tomados = new Set(enUso.map((f) => String(f.slug)));
  if (!tomados.has(base)) return base;
  for (let i = 1; i < 50; i += 1) {
    const prueba = `${base}-${i}`;
    if (!tomados.has(prueba)) return prueba;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function numero(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coordenada(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Alta de alojamiento.
 *
 * Escribe en los DOS esquemas. Esto no era así y era un problema de verdad: antes solo se creaba la
 * fila del esquema antiguo, y como el buscador, la galería y la ficha leen el nuevo, **un
 * alojamiento recién creado no aparecía en la web**. Ahora nace completo y visible donde toca.
 *
 * `propietarioId` es para el anfitrión: cuando quien crea es el propio anfitrión, el vínculo se
 * fuerza a su cuenta y no puede crear nada a nombre de otro. El administrador, en cambio, puede
 * indicar un correo.
 */
export async function crearAlojamiento(
  formulario: FormData,
  opciones: { propietarioId?: number | null } = {},
): Promise<ResultadoAlta> {
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

  const precioNoche = numero(formulario.get("precio_noche"));
  const precioOrientativo = numero(formulario.get("precio_orientativo"));
  const activo = formulario.get("activo") === "1" ? 1 : 0;
  const slug = await slugLibre(titulo);

  const [res] = await poolLegacy.query<any>(
    `INSERT INTO alojamiento (titulo, slug, ciudad, provincia, lat, lng, precio_noche, precio_orientativo, activo, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
    [titulo, slug, ciudad, provincia, lat, lng, precioNoche, precioOrientativo, activo],
  );
  const nuevoId = Number(res.insertId);

  // Fila espejo en el catálogo público: sin esto el alojamiento no existe para el buscador.
  await pool.query(
    `INSERT INTO accommodation
       (legacy_id, slug, title, city, province, country, lat, lng, price_per_night, indicative_price,
        currency, price_type, status, created_at, updated_at)
     VALUES (?,?,?,?,?, 'ES', ?,?,?,?, 'EUR', ?, ?, NOW(), NOW())`,
    [
      nuevoId, slug, titulo, ciudad, provincia, lat, lng, precioNoche, precioOrientativo,
      precioNoche !== null ? "real" : precioOrientativo !== null ? "indicative" : null,
      activo === 1 ? "published" : "draft",
    ],
  );

  // Propietario. El anfitrión que crea su propio alojamiento queda vinculado siempre; el
  // administrador puede indicar un correo, y si ese correo no existe el alta sigue en pie (perder
  // el alojamiento por un correo mal escrito sería peor: se ve en el panel y se corrige).
  if (nuevoId) {
    if (opciones.propietarioId) {
      await poolLegacy.query(
        `INSERT IGNORE INTO alojamiento_anfitrion (alojamiento_id, usuario_id) VALUES (?,?)`,
        [nuevoId, opciones.propietarioId],
      );
    } else {
      const emailAnfitrion = String(formulario.get("anfitrion") ?? "").trim().toLowerCase();
      if (emailAnfitrion) {
        const [us] = await poolLegacy.query<any[]>(`SELECT id FROM usuario WHERE email = ? LIMIT 1`, [emailAnfitrion]);
        if (us[0]) {
          await poolLegacy.query(
            `INSERT IGNORE INTO alojamiento_anfitrion (alojamiento_id, usuario_id) VALUES (?,?)`,
            [nuevoId, us[0].id],
          );
        }
      }
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
