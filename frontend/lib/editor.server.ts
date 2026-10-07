/**
 * Editor de alojamiento — SOLO SERVIDOR.
 *
 * Un único editor para anfitriones y administradores, como se pidió: la interfaz, los componentes y
 * la lógica son los mismos; lo que cambia es **el permiso**, que se comprueba aquí, en el servidor,
 * en cada guardado (no basta con que la página se haya pintado).
 *
 * Qué identifica a un alojamiento aquí: el **id del esquema antiguo** (`alojamiento.id`). Es el que
 * usan las reservas, la disponibilidad, las fotografías, los servicios y la comprobación de
 * propiedad. La fila del catálogo público (`hestiat2.accommodation`) se localiza por su `legacy_id`.
 *
 * Todo se guarda en los DOS esquemas: el panel y la ficha pública deben mostrar lo mismo. Si solo se
 * escribiera uno, editar aquí no se vería en la web (que es exactamente el fallo que había con las
 * fotografías).
 */
import { pool, poolLegacy } from "@/lib/db";
import { calcularDesglose } from "@/lib/precio.server";
import type { ParametrosPrecio } from "@/lib/precio.server";

export type Rol = "huesped" | "anfitrion" | "admin";

export interface ServicioDiccionario {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface AlojamientoEditable {
  legacyId: number;
  /** id en el catálogo público; null si esa fila no existe. */
  nuevoId: number | null;
  slug: string | null;
  titulo: string;
  descripcion: string;
  descripcionCorta: string;
  tipo: string;
  categoria: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  pais: string;
  lat: number | null;
  lng: number | null;
  ubicacionPrivacidad: "exacta" | "aproximada";
  capacidad: number;
  habitaciones: number;
  camas: number;
  banos: number;
  precioNoche: number | null;
  precioOrientativo: number | null;
  moneda: string;
  limpieza: number | null;
  tasas: number | null;
  impuestosPct: number | null;
  precioMinimo: number | null;
  precioMaximo: number | null;
  precioHuespedExtra: number | null;
  descuentoSemanal: number | null;
  descuentoMensual: number | null;
  estanciaMinima: number | null;
  estanciaMaxima: number | null;
  reservaInmediata: boolean;
  activo: boolean;
  estadoPublico: string;
  priceType: string;
  estrellas: number | null;
  /* Reglas del alojamiento. null = sin especificar, y sin especificar significa que no se muestra. */
  checkIn: string | null;
  checkOut: string | null;
  admiteMascotas: boolean | null;
  admiteFumadores: boolean | null;
  admiteFiestas: boolean | null;
  edadMinima: number | null;
  reglasExtra: string | null;
}

const aNumeroOpcional = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Carga un alojamiento juntando las dos filas (panel y catálogo público). */
export async function cargarParaEditar(legacyId: number): Promise<{
  alojamiento: AlojamientoEditable;
  servicios: ServicioDiccionario[];
} | null> {
  const [filas] = await poolLegacy.query<any[]>(`SELECT * FROM alojamiento WHERE id = ? LIMIT 1`, [legacyId]);
  const a = filas[0];
  if (!a) return null;

  const [nuevas] = await pool.query<any[]>(`SELECT * FROM accommodation WHERE legacy_id = ? LIMIT 1`, [legacyId]);
  const n = nuevas[0] ?? null;

  // El diccionario de servicios es el mismo para todos y es extensible: añadir una característica
  // nueva es añadir una fila, no tocar el código.
  const [dic] = await pool.query<any[]>(`SELECT id, nombre FROM servicio ORDER BY nombre`);
  const [marcadosNuevo] = n
    ? await pool.query<any[]>(`SELECT amenity FROM accommodation_amenity WHERE accommodation_id = ?`, [n.id])
    : [[] as any[]];
  const [marcadosViejo] = await poolLegacy.query<any[]>(
    `SELECT servicio_id FROM alojamiento_servicio WHERE alojamiento_id = ?`,
    [legacyId],
  );
  const activos = new Set<string>([
    ...marcadosNuevo.map((m: any) => String(m.amenity)),
    ...marcadosViejo.map((m: any) => String(m.servicio_id)),
  ]);

  const servicios: ServicioDiccionario[] = dic.map((d: any) => ({
    id: Number(d.id),
    nombre: String(d.nombre),
    activo: activos.has(String(d.id)),
  }));

  const alojamiento: AlojamientoEditable = {
    legacyId,
    nuevoId: n ? Number(n.id) : null,
    slug: n?.slug ?? a.slug ?? null,
    titulo: String(a.titulo ?? ""),
    descripcion: String(a.descripcion ?? ""),
    descripcionCorta: String(a.descripcion_corta ?? n?.short_description ?? ""),
    tipo: String(a.tipo ?? ""),
    categoria: String(a.categoria ?? ""),
    direccion: String(a.direccion ?? ""),
    ciudad: String(a.ciudad ?? ""),
    provincia: String(a.provincia ?? ""),
    codigoPostal: String(a.codigo_postal ?? ""),
    pais: String(a.pais ?? "ES"),
    lat: aNumeroOpcional(a.lat),
    lng: aNumeroOpcional(a.lng),
    ubicacionPrivacidad: String(a.ubicacion_privacidad ?? "exacta") === "aproximada" ? "aproximada" : "exacta",
    capacidad: Number(a.capacidad ?? 0),
    habitaciones: Number(a.habitaciones ?? 0),
    camas: Number(a.camas ?? 0),
    banos: Number(a.banos ?? 0),
    precioNoche: aNumeroOpcional(a.precio_noche),
    precioOrientativo: aNumeroOpcional(a.precio_orientativo),
    moneda: String(a.moneda ?? "EUR"),
    limpieza: aNumeroOpcional(a.limpieza),
    tasas: aNumeroOpcional(a.tasas),
    impuestosPct: aNumeroOpcional(a.impuestos_pct),
    precioMinimo: aNumeroOpcional(a.precio_minimo),
    precioMaximo: aNumeroOpcional(a.precio_maximo),
    precioHuespedExtra: aNumeroOpcional(a.precio_huesped_extra),
    descuentoSemanal: aNumeroOpcional(a.descuento_semanal),
    descuentoMensual: aNumeroOpcional(a.descuento_mensual),
    estanciaMinima: aNumeroOpcional(a.estancia_minima),
    estanciaMaxima: aNumeroOpcional(a.estancia_maxima),
    reservaInmediata: Number(a.reserva_inmediata) === 1,
    activo: Number(a.activo) === 1,
    estadoPublico: String(n?.status ?? (Number(a.activo) === 1 ? "published" : "draft")),
    priceType: String(a.price_type ?? n?.price_type ?? ""),
    estrellas: aNumeroOpcional(a.estrellas),
    checkIn: a.check_in ? String(a.check_in).slice(0, 5) : null,
    checkOut: a.check_out ? String(a.check_out).slice(0, 5) : null,
    // Tres estados posibles por regla: sí, no y sin especificar (null). Sin especificar no se
    // publica nada: la ficha oculta la línea en vez de afirmar algo que nadie ha decidido.
    admiteMascotas: a.admite_mascotas === null || a.admite_mascotas === undefined ? null : Number(a.admite_mascotas) === 1,
    admiteFumadores: a.admite_fumadores === null || a.admite_fumadores === undefined ? null : Number(a.admite_fumadores) === 1,
    admiteFiestas: a.admite_fiestas === null || a.admite_fiestas === undefined ? null : Number(a.admite_fiestas) === 1,
    edadMinima: aNumeroOpcional(a.edad_minima),
    reglasExtra: a.reglas_extra ? String(a.reglas_extra) : null,
  };

  return { alojamiento, servicios };
}

/* ------------------------------------------------------------------ permisos -- */

/** ¿Puede este usuario editar este alojamiento? Devuelve el motivo, para poder explicarlo. */
export async function permisoEdicion(
  usuario: { id: number | string; rol: string } | null,
  legacyId: number,
): Promise<{ puede: boolean; esAdmin: boolean; motivo?: string }> {
  if (!usuario) return { puede: false, esAdmin: false, motivo: "Necesitas iniciar sesión." };
  const esAdmin = usuario.rol === "admin";
  if (esAdmin) return { puede: true, esAdmin };
  if (usuario.rol !== "anfitrion") {
    return { puede: false, esAdmin: false, motivo: "Solo el anfitrión del alojamiento o un administrador pueden editarlo." };
  }
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM alojamiento_anfitrion WHERE usuario_id = ? AND alojamiento_id = ?`,
    [Number(usuario.id), legacyId],
  );
  if (Number(filas[0]?.n ?? 0) === 0) {
    return { puede: false, esAdmin: false, motivo: "Ese alojamiento no es tuyo." };
  }
  return { puede: true, esAdmin: false };
}

/* ------------------------------------------------------------------ guardado -- */

export type ResultadoGuardado = { ok: true; mensaje: string } | { ok: false; error: string };

const texto = (v: FormDataEntryValue | null, max: number): string => String(v ?? "").trim().slice(0, max);
const numero = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const entero = (v: FormDataEntryValue | null): number | null => {
  const n = numero(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

const TIPOS = ["Hotel", "Apartamento", "Casa", "Villa", "Chalet", "Habitación", "Casa rural", "Otros"];

/** Información general, ubicación incluida. Escribe en los dos esquemas. */
export async function guardarGeneral(legacyId: number, f: FormData): Promise<ResultadoGuardado> {
  const titulo = texto(f.get("titulo"), 255);
  if (titulo.length < 4) return { ok: false, error: "El nombre debe tener al menos 4 caracteres." };

  const tipo = texto(f.get("tipo"), 40);
  if (tipo && !TIPOS.includes(tipo)) return { ok: false, error: "Tipo de alojamiento no reconocido." };

  const lat = numero(f.get("lat"));
  const lng = numero(f.get("lng"));
  if (lat !== null && (lat < -90 || lat > 90)) return { ok: false, error: "La latitud está fuera de rango." };
  if (lng !== null && (lng < -180 || lng > 180)) return { ok: false, error: "La longitud está fuera de rango." };

  const privacidad = texto(f.get("ubicacionPrivacidad"), 20) === "aproximada" ? "aproximada" : "exacta";
  const descripcion = texto(f.get("descripcion"), 20000);
  const corta = texto(f.get("descripcionCorta"), 300);
  const ciudad = texto(f.get("ciudad"), 120);
  const provincia = texto(f.get("provincia"), 120);
  const direccion = texto(f.get("direccion"), 255);
  const cp = texto(f.get("codigoPostal"), 16);
  const pais = texto(f.get("pais"), 2) || "ES";

  await poolLegacy.query(
    `UPDATE alojamiento SET titulo=?, tipo=?, descripcion=?, descripcion_corta=?, direccion=?, ciudad=?,
            provincia=?, codigo_postal=?, pais=?, lat=?, lng=?, ubicacion_privacidad=?,
            capacidad=?, habitaciones=?, camas=?, banos=?, actualizado_en=NOW()
      WHERE id=?`,
    [
      titulo, tipo || null, descripcion || null, corta || null, direccion || null, ciudad || null,
      provincia || null, cp || null, pais, lat, lng, privacidad,
      entero(f.get("capacidad")), entero(f.get("habitaciones")), entero(f.get("camas")), entero(f.get("banos")),
      legacyId,
    ],
  );

  // Reflejo en el catálogo público: la ficha debe enseñar exactamente esto.
  await pool.query(
    `UPDATE accommodation SET title=?, type=?, description=?, short_description=?, address=?, city=?,
            province=?, postal_code=?, country=?, lat=?, lng=?, location_visibility=?,
            capacity=?, bedrooms=?, beds=?, baths=?, updated_at=NOW()
      WHERE legacy_id=?`,
    [
      titulo, tipo || null, descripcion || null, corta || null, direccion || null, ciudad || null,
      provincia || null, cp || null, pais, lat, lng, privacidad,
      entero(f.get("capacidad")), entero(f.get("habitaciones")), entero(f.get("camas")), entero(f.get("banos")),
      legacyId,
    ],
  );

  return { ok: true, mensaje: "Información general guardada." };
}

/** Precios y condiciones. La vista previa usa esta misma lógica. */
export async function guardarPrecios(legacyId: number, f: FormData): Promise<ResultadoGuardado> {
  const precio = numero(f.get("precioNoche"));
  const orientativo = numero(f.get("precioOrientativo"));
  if (precio !== null && precio <= 0) return { ok: false, error: "El precio por noche no puede ser 0." };
  const impuestos = numero(f.get("impuestosPct"));
  if (impuestos !== null && (impuestos < 0 || impuestos > 40)) {
    return { ok: false, error: "El porcentaje de impuestos debe estar entre 0 y 40." };
  }
  const descSemanal = numero(f.get("descuentoSemanal"));
  const descMensual = numero(f.get("descuentoMensual"));
  if (descSemanal !== null && (descSemanal < 0 || descSemanal > 90)) {
    return { ok: false, error: "El descuento semanal debe estar entre 0 y 90 %." };
  }
  if (descMensual !== null && (descMensual < 0 || descMensual > 90)) {
    return { ok: false, error: "El descuento mensual debe estar entre 0 y 90 %." };
  }
  const minN = entero(f.get("estanciaMinima"));
  const maxN = entero(f.get("estanciaMaxima"));
  if (minN !== null && maxN !== null && minN > 0 && maxN > 0 && minN > maxN) {
    return { ok: false, error: "La estancia mínima no puede ser mayor que la máxima." };
  }

  const campos = [
    precio, orientativo, numero(f.get("limpieza")), numero(f.get("tasas")), impuestos,
    numero(f.get("precioMinimo")), numero(f.get("precioMaximo")), numero(f.get("precioHuespedExtra")),
    descSemanal, descMensual, minN, maxN,
  ];

  await poolLegacy.query(
    `UPDATE alojamiento SET precio_noche=?, precio_orientativo=?, limpieza=?, tasas=?, impuestos_pct=?,
            precio_minimo=?, precio_maximo=?, precio_huesped_extra=?, descuento_semanal=?, descuento_mensual=?,
            estancia_minima=?, estancia_maxima=?, reserva_inmediata=?, actualizado_en=NOW()
      WHERE id=?`,
    [...campos, Number(f.get("reservaInmediata")) === 1 ? 1 : 0, legacyId],
  );

  // `price_type` se recalcula: si hay precio publicado deja de ser orientativo. Es dato, no adorno.
  const priceType = precio !== null && precio > 0 ? "real" : orientativo !== null && orientativo > 0 ? "indicative" : null;
  await pool.query(
    `UPDATE accommodation SET price_per_night=?, indicative_price=?, cleaning_fee=?, fees=?, tax_pct=?,
            min_price=?, max_price=?, extra_guest_price=?, weekly_discount=?, monthly_discount=?,
            min_nights=?, max_nights=?, instant_booking=?,
            price_type=COALESCE(?, price_type), currency=?, updated_at=NOW()
      WHERE legacy_id=?`,
    [...campos, Number(f.get("reservaInmediata")) === 1 ? 1 : 0, priceType, texto(f.get("moneda"), 3) || "EUR", legacyId],
  );

  return { ok: true, mensaje: "Precios guardados." };
}

/** Características: se guardan en los dos esquemas, para que la ficha pública use exactamente esto. */
export async function guardarCaracteristicas(legacyId: number, f: FormData): Promise<ResultadoGuardado> {
  const ids = f
    .getAll("servicios")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  const [nuevas] = await pool.query<any[]>(`SELECT id FROM accommodation WHERE legacy_id = ? LIMIT 1`, [legacyId]);
  const accommodationId = nuevas[0] ? Number(nuevas[0].id) : null;

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM alojamiento_servicio WHERE alojamiento_id = ?`, [legacyId]);
    for (const id of ids) {
      await conn.query(`INSERT IGNORE INTO alojamiento_servicio (alojamiento_id, servicio_id) VALUES (?,?)`, [legacyId, id]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  if (accommodationId !== null) {
    const conn2 = await pool.getConnection();
    try {
      await conn2.beginTransaction();
      await conn2.query(`DELETE FROM accommodation_amenity WHERE accommodation_id = ?`, [accommodationId]);
      for (const id of ids) {
        await conn2.query(`INSERT IGNORE INTO accommodation_amenity (accommodation_id, amenity) VALUES (?,?)`, [
          accommodationId,
          String(id),
        ]);
      }
      await conn2.commit();
    } catch (e) {
      await conn2.rollback();
      throw e;
    } finally {
      conn2.release();
    }
  }

  return { ok: true, mensaje: `Características guardadas (${ids.length}).` };
}

/** Funciones de administración: publicar, despublicar y reserva inmediata. */
export async function guardarAdmin(legacyId: number, f: FormData): Promise<ResultadoGuardado> {
  const activo = Number(f.get("activo")) === 1 ? 1 : 0;
  await poolLegacy.query(`UPDATE alojamiento SET activo=?, publicado_en=CASE WHEN ?=1 THEN COALESCE(publicado_en, NOW()) ELSE publicado_en END, actualizado_en=NOW() WHERE id=?`, [
    activo, activo, legacyId,
  ]);
  await pool.query(
    `UPDATE accommodation SET status=?, published_at=CASE WHEN ?='published' THEN COALESCE(published_at, NOW()) ELSE published_at END, updated_at=NOW() WHERE legacy_id=?`,
    [activo === 1 ? "published" : "draft", activo === 1 ? "published" : "draft", legacyId],
  );
  return { ok: true, mensaje: activo === 1 ? "Alojamiento publicado." : "Alojamiento despublicado." };
}

/** Vista previa del precio: usa la MISMA función que la reserva, no una copia. */
export async function previsualizarPrecio(
  legacyId: number,
  noches: number,
  huespedes: number,
  valoresDelFormulario?: Partial<ParametrosPrecio>,
): Promise<ReturnType<typeof calcularDesglose> | null> {
  const cargado = await cargarParaEditar(legacyId);
  if (!cargado) return null;
  const a = cargado.alojamiento;
  const desde = new Date().toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + Math.max(1, noches) * 86_400_000).toISOString().slice(0, 10);
  const base: ParametrosPrecio = {
    precioNoche: a.precioNoche ?? a.precioOrientativo ?? 0,
    moneda: a.moneda,
    desde,
    hasta,
    orientativo: a.precioNoche === null,
    limpieza: a.limpieza,
    tasas: a.tasas,
    impuestosPct: a.impuestosPct,
    precioHuespedExtra: a.precioHuespedExtra,
    huespedesIncluidos: a.capacidad,
    huespedes,
    descuentoSemanal: a.descuentoSemanal,
    descuentoMensual: a.descuentoMensual,
    estanciaMinima: a.estanciaMinima,
    estanciaMaxima: a.estanciaMaxima,
  };
  return calcularDesglose({ ...base, ...(valoresDelFormulario ?? {}) });
}
