import type { Metadata } from "next";

/**
 * METADATOS DE LAS PÁGINAS INFORMATIVAS, EN UN SOLO SITIO.
 *
 * Cada página necesita lo mismo: un título que se entienda en una pestaña y en un resultado de
 * búsqueda, una descripción que resuma de verdad lo que hay dentro, su dirección canónica y las
 * etiquetas Open Graph para que al compartir el enlace en WhatsApp, X o LinkedIn salga una tarjeta
 * con título, texto e imagen en vez de un enlace pelado.
 *
 * Se genera desde aquí y no página a página para que las cuatro se comporten igual y no se olvide
 * ninguna etiqueta en la siguiente que se añada.
 */
const BASE = "https://hestiat.com";

/** Imagen social por defecto: el póster real de la portada, que ya forma parte del proyecto. */
const IMAGEN_SOCIAL = `${BASE}/hero/hero-poster.jpg`;

export function metadatosInformativos(datos: {
  /** Título de la página (también el de la tarjeta al compartir). */
  titulo: string;
  /** Descripción real de lo que contiene la página. */
  descripcion: string;
  /** Ruta canónica, empezando por barra: "/sobre". */
  ruta: string;
  /** Imagen propia de esa página, si la hay mejor que la de portada. */
  imagen?: string;
}): Metadata {
  const url = `${BASE}${datos.ruta}`;
  const imagen = datos.imagen ?? IMAGEN_SOCIAL;
  return {
    title: datos.titulo,
    description: datos.descripcion,
    alternates: { canonical: datos.ruta },
    openGraph: {
      type: "website",
      siteName: "Hestiat",
      locale: "es_ES",
      url,
      title: datos.titulo,
      description: datos.descripcion,
      images: [{ url: imagen, alt: datos.titulo }],
    },
    twitter: {
      card: "summary_large_image",
      title: datos.titulo,
      description: datos.descripcion,
      images: [imagen],
    },
  };
}
