"use client";

import { useState } from "react";

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
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Tamaño intrínseco, cuando se conoce: evita saltos de maquetación. */
  ancho?: number;
  alto?: number;
  /** Clase del fondo que se muestra si no hay imagen o si falla. */
  fondo?: string;
}) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) return <span className={fondo} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={ancho}
      height={alto}
      loading="lazy"
      decoding="async"
      onError={() => setFallo(true)}
    />
  );
}
