/**
 * CONTACTO DE UNA PUBLICACIÓN — validación, procedencia y datos publicables.
 *
 * ── DE DÓNDE SALE ESTE DISEÑO ───────────────────────────────────────────────────────────────────
 * No es nuevo: es el que Hestiat ya usaba para los alojamientos. Cada dato de contacto lleva su
 * PROCEDENCIA (`email_source`, `phone_source`, `website_source`), su CONFIANZA, la fecha en que se
 * verificó y un ESTADO (`missing` · `found` · `verified` · `needs_review`). Se replica igual en
 * experiencias y servicios, en vez de inventar un segundo modelo.
 *
 * ── LA REGLA QUE GOBIERNA TODO ──────────────────────────────────────────────────────────────────
 * NADA se publica por el hecho de existir. Solo se enseña lo que está marcado como publicable, y
 * cada botón de la ficha aparece únicamente si tiene un destino VÁLIDO. Un dato sin procedencia
 * conocida no se publica: puede ser un teléfono privado que alguien no autorizó a mostrar.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

export type TipoPublicacion = "alojamiento" | "experiencia" | "servicio";

/** Estados de contacto, los mismos que usa el alojamiento. */
export type EstadoContacto = "missing" | "found" | "verified" | "needs_review";
export type ConfianzaContacto = "high" | "medium" | "low" | "unverified";

export interface ContactoPublicacion {
  nombre: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  web: string | null;
  direccion: string | null;
  enlace: string | null;
  estado: EstadoContacto;
  confianza: ConfianzaContacto;
  verificadoEn: string | null;
  nota: string | null;
}

/** Tabla real de cada tipo. Los alojamientos viven en la base ORIGINAL: aquí solo se leen. */
const TABLA: Record<TipoPublicacion, { tabla: string; base: "legacy" | "nueva" }> = {
  alojamiento: { tabla: "alojamiento", base: "legacy" },
  experiencia: { tabla: "experiencia", base: "nueva" },
  servicio: { tabla: "servicio_turistico", base: "nueva" },
};

/* --------------------------------------------------------------- validación -- */

/** Teléfono o WhatsApp: solo dígitos, espacios, guiones y paréntesis, entre 6 y 20 caracteres. */
export function telefonoValido(v: string | null | undefined): boolean {
  const t = (v ?? "").trim();
  if (!t) return false;
  return /^[+()\d][\d\s\-().]{5,19}$/.test(t);
}

/** Correo con forma de correo. No se comprueba que exista: eso no se puede saber desde aquí. */
export function emailValido(v: string | null | undefined): boolean {
  const e = (v ?? "").trim();
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 255;
}

/** Dirección web: solo http o https, y con dominio. */
export function webValida(v: string | null | undefined): boolean {
  const w = (v ?? "").trim();
  if (!w) return false;
  try {
    const u = new URL(w);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** El número que se le da a WhatsApp: solo dígitos, sin el símbolo +. */
export function numeroParaWhatsApp(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/[^\d]/g, "");
  return t.length >= 6 && t.length <= 15 ? t : null;
}

/* --------------------------------------------------------------- publicación -- */

/**
 * ¿Qué se puede enseñar de este contacto?
 *
 * Se enseña un dato solo si está VERIFICADO. Un dato «encontrado» pero sin verificar no sale a la
 * ficha pública: puede ser un teléfono personal publicado por error en otra web, y mostrarlo sería
 * difundir un dato privado sin base. La administración sí los ve, para poder revisarlos.
 */
export function publicables(c: ContactoPublicacion): {
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  web: string | null;
  direccion: string | null;
  enlace: string | null;
  nombre: string | null;
} {
  const soloVerificado = c.estado === "verified";
  return {
    nombre: c.nombre,
    telefono: soloVerificado && telefonoValido(c.telefono) ? c.telefono : null,
    whatsapp: soloVerificado && numeroParaWhatsApp(c.whatsapp) ? c.whatsapp : null,
    email: soloVerificado && emailValido(c.email) ? c.email : null,
    web: soloVerificado && webValida(c.web) ? c.web : null,
    direccion: soloVerificado ? c.direccion : null,
    enlace: soloVerificado && webValida(c.enlace) ? c.enlace : null,
  };
}

/**
 * Enlace de WhatsApp con MENSAJE PREDEFINIDO que lleva el nombre de la publicación y su URL.
 * Abre la conversación: el mensaje NO se envía solo, lo manda la persona que escribe.
 */
export function enlaceWhatsApp(numero: string, nombre: string, urlPublica: string): string | null {
  const n = numeroParaWhatsApp(numero);
  if (!n) return null;
  const texto = `Hola, te escribo por «${nombre}» que he visto en Hestiat: ${urlPublica}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/* --------------------------------------------------------------- lectura -- */

function deFila(f: mysql.RowDataPacket): ContactoPublicacion {
  const s = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  return {
    nombre: s(f.contact_nombre ?? f.nombre_contacto),
    telefono: s(f.contact_phone ?? f.phone ?? f.telefono),
    whatsapp: s(f.contact_whatsapp),
    email: s(f.contact_email ?? f.email),
    web: s(f.official_website ?? f.website_url ?? f.web),
    direccion: s(f.contact_address),
    enlace: s(f.contact_link),
    estado: (s(f.contact_status) as EstadoContacto) ?? "missing",
    confianza: (s(f.contact_confidence) as ConfianzaContacto) ?? "unverified",
    verificadoEn: s(f.contact_verified_at),
    nota: s(f.contact_review_note),
  };
}

/** Lee el contacto de UNA publicación. Devuelve null si no existe esa publicación. */
export async function contactoDe(
  tipo: TipoPublicacion,
  id: number,
): Promise<ContactoPublicacion | null> {
  const conf = TABLA[tipo];
  const db = conf.base === "legacy" ? (await import("@/lib/db")).poolLegacy : pool;
  try {
    const [filas] = await db.query<mysql.RowDataPacket[]>(
      `SELECT * FROM ${conf.tabla} WHERE id = ? LIMIT 1`,
      [id],
    );
    return filas[0] ? deFila(filas[0]) : null;
  } catch {
    // Si la tabla de ese tipo no tuviera los campos todavía, la ficha no se rompe: sin contacto.
    return null;
  }
}
