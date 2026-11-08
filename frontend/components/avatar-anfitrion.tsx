"use client";

import { useState } from "react";

/**
 * AVATAR DEL ANFITRIÓN, EN SUS TRES CASOS.
 *
 *  · Con foto: se muestra la foto.
 *  · Sin foto: se muestra un círculo con su inicial.
 *  · Con una foto que NO se puede cargar (la imagen ya no está, la red falla…): se cae a la inicial en
 *    vez de dejar el hueco roto del navegador.
 *
 * Una sola pieza para el perfil público y para la ficha, para que los dos sitios se comporten igual.
 * No toca ninguna foto de alojamiento: solo se usa con la foto de perfil del anfitrión.
 */
export default function AvatarAnfitrion({
  url,
  nombre,
  grande = false,
}: {
  url: string | null;
  nombre: string;
  grande?: boolean;
}) {
  const [falla, setFalla] = useState(false);
  const inicial = (nombre || "?").trim().slice(0, 1).toUpperCase();

  if (!url || falla) {
    return (
      <span className={"anfitrion-inicial" + (grande ? " anfitrion-inicial-grande" : "")} aria-hidden="true">
        {inicial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={nombre}
      className={"anfitrion-foto" + (grande ? " anfitrion-foto-grande" : "")}
      onError={() => setFalla(true)}
    />
  );
}
