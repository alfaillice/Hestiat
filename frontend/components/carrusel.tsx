"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Carrusel horizontal: el usuario es el que manda.
 *
 * No hay movimiento automático, ni bucle infinito, ni temporizadores: solo desplazamiento natural
 * (en móvil, con el dedo) y dos botones ← → que avanzan una pantalla. Los botones se apagan solos
 * cuando ya no hay más en esa dirección, para que nunca parezcan decorativos.
 *
 * El desplazamiento es el del navegador (`scrollBy` con `smooth`), no una animación propia: es lo
 * más ligero y lo que mejor se comporta en un móvil.
 */
export default function Carrusel({
  children,
  etiqueta,
}: {
  children: ReactNode;
  /** Nombre de la sección, para las etiquetas de accesibilidad de los botones. */
  etiqueta: string;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [atras, setAtras] = useState(false);
  const [adelante, setAdelante] = useState(false);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const revisar = () => {
      setAtras(el.scrollLeft > 8);
      setAdelante(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };
    revisar();
    el.addEventListener("scroll", revisar, { passive: true });
    window.addEventListener("resize", revisar);
    return () => {
      el.removeEventListener("scroll", revisar);
      window.removeEventListener("resize", revisar);
    };
  }, []);

  const mover = (sentido: number) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: sentido * Math.max(300, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="car">
      <button
        type="button"
        className="car-flecha car-atras"
        onClick={() => mover(-1)}
        disabled={!atras}
        aria-label={`Ver los anteriores de ${etiqueta}`}
      >
        <span aria-hidden="true">←</span>
      </button>

      <div className="car-pista" ref={pista} tabIndex={0} role="group" aria-label={etiqueta}>
        {children}
      </div>

      <button
        type="button"
        className="car-flecha car-alante"
        onClick={() => mover(1)}
        disabled={!adelante}
        aria-label={`Ver más de ${etiqueta}`}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
