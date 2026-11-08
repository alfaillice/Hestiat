"use client";

import { useState } from "react";
import type { TipoFavorito } from "@/lib/favoritos.server";

/**
 * Corazón de favoritos sobre la fotografía.
 *
 * Es real, no decorativo: guarda y quita mediante `/api/favoritos`, para las TRES categorías
 * (alojamiento, experiencia y servicio). El tipo forma parte de la identificación: la experiencia 43
 * y el alojamiento 43 son favoritos distintos.
 *
 *  · Con sesión: alterna, con cambio inmediato en pantalla y vuelta atrás si el servidor falla.
 *  · Sin sesión: no finge nada. Lleva a identificarse, indicando a dónde volver.
 *  · Mientras guarda, el botón queda deshabilitado: no se puede pulsar dos veces.
 */
export default function Corazon({
  tipo,
  itemId,
  guardadoInicial,
  haySesion,
  volverA,
}: {
  tipo: TipoFavorito;
  itemId: number;
  guardadoInicial: boolean;
  haySesion: boolean;
  volverA: string;
}) {
  const [guardado, setGuardado] = useState(guardadoInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);

  if (!haySesion) {
    return (
      <a
        className="corazon"
        href={`/login?volver=${encodeURIComponent(volverA)}`}
        aria-label="Entra para guardar esto en favoritos"
        title="Entra para guardar en favoritos"
      >
        <span aria-hidden="true">♡</span>
      </a>
    );
  }

  const alternar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError(false);
    const antes = guardado;
    setGuardado(!antes); // cambio inmediato en pantalla
    try {
      const r = await fetch("/api/favoritos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, itemId }),
      });
      const datos = await r.json();
      if (!r.ok || !datos?.ok) throw new Error("fallo");
      setGuardado(Boolean(datos.guardado)); // se confirma con lo que dice la base
    } catch {
      setGuardado(antes); // vuelve atrás: nunca se queda mintiendo
      setError(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <button
      type="button"
      className={"corazon" + (guardado ? " corazon-ok" : "")}
      aria-pressed={guardado}
      aria-label={guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
      title={error ? "No se ha podido guardar. Inténtalo de nuevo." : guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
      onClick={alternar}
      disabled={enviando}
    >
      <span aria-hidden="true">{guardado ? "♥" : "♡"}</span>
    </button>
  );
}
