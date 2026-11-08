import type { ReactNode } from "react";
import Link from "next/link";
import Carrusel from "@/components/carrusel";

/**
 * Una sección de la portada: título, enlace «Ver todos →» y una fila que se puede desplazar.
 *
 * El carrusel es del navegador (scroll natural, con el dedo en móvil) y los botones ← → solo
 * desplazan una pantalla. Nada automático.
 */
export default function SeccionHome({
  titulo,
  sub,
  verTodos,
  verTodosTexto = "Ver todos",
  children,
}: {
  titulo: string;
  /** Línea corta que explica qué se está viendo. */
  sub?: string;
  /** Destino del enlace «Ver todos». */
  verTodos: string;
  verTodosTexto?: string;
  children: ReactNode;
}) {
  return (
    <section className="seccion-home">
      <div className="seccion-home-cab">
        <div>
          <h2>{titulo}</h2>
          {sub ? <p className="seccion-home-sub">{sub}</p> : null}
        </div>
        <Link className="ver-todos" href={verTodos}>
          {verTodosTexto} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <Carrusel etiqueta={titulo}>{children}</Carrusel>
    </section>
  );
}
