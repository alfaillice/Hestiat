"use client";

import { useState } from "react";
import { urlPropia } from "@/lib/imagen-propia";

/**
 * Una imagen que NUNCA se ve rota.
 *
 * Las fotografías del catálogo vienen de fuentes externas (Wikimedia, sobre todo). Una fuente externa
 * puede tardar, limitar peticiones o dejar de servir un fichero: cuando eso pasa, el navegador pinta
 * el icono de imagen rota, que es lo peor que puede aparecer en una página de alojamientos.
 *
 * Aquí, si la imagen falla, se cambia por un fondo suave del propio diseño. La tarjeta sigue
 * leyéndose (nombre, ubicación, precio) y no hay hueco roto. No se sustituye por otra fotografía:
 * simplemente se retira la que no se puede mostrar.
 */
export default function ImagenSegura({
  src,
  alt,
  className,
  ancho,
  alto,
  fondo = "tcat-sinfoto",
}: {
  /**
   * Una dirección, o una CADENA de direcciones en orden de preferencia. Con cadena, si una falla se
   * prueba la siguiente (WebP → PNG → otras de la misma categoría → respaldo) y nunca queda un hueco.
   */
  src: string | string[] | null | undefined;
  alt: string;
  className?: string;
  /** Tamaño intrínseco, cuando se conoce: evita saltos de maquetación. */
  ancho?: number;
  alto?: number;
  /** Clase del fondo que se muestra si no hay imagen o si fallan todas. */
  fondo?: string;
}) {
  /**
   * Las direcciones de terceros (Wikimedia) se pintan pasando por nuestra casa, para que el
   * navegador no tenga que hablar con un servidor ajeno que además limita las peticiones. Las
   * nuestras (R2, CloudFront) se quedan tal cual.
   */
  const lista = (Array.isArray(src) ? src : src ? [src] : [])
    .filter(Boolean)
    .map((u) => urlPropia(u, ancho));
  const [indice, setIndice] = useState(0);
  const actual = lista[indice] ?? null;

  /**
   * SIN FOTO: IMAGEN GENÉRICA, NO UN HUECO.
   *
   * Antes, cuando no había foto (o cuando fallaban todas), se pintaba un fondo degradado. Cumplía,
   * pero no advertía de nada y el hueco se quedaba mudo. Ahora se muestra una imagen de reserva de
   * Hestiat que dice, con todas las letras, que ese alojamiento no tiene foto.
   *
   * Es una imagen PROPIA y GENÉRICA: no representa ningún negocio concreto y no se presenta como la
   * foto de nadie. Por eso el texto alternativo dice «Sin foto disponible» y no el nombre del sitio.
   *
   * Se usa una sola vez, aquí, para las cinco tarjetas que comparten este componente: antes había
   * cuatro fondos distintos según el tipo de tarjeta.
   */
  if (!actual) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/img/sin-foto.webp"
        alt="Sin foto disponible"
        className={className}
        width={ancho}
        height={alto}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={actual}
      alt={alt}
      className={className}
      width={ancho}
      height={alto}
      loading="lazy"
      decoding="async"
      onError={() => setIndice((i) => i + 1)}
    />
  );
}
