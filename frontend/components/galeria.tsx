"use client";

import { useCallback, useEffect, useState } from "react";
import type { FotoFicha } from "@/lib/ficha.server";

/**
 * Galería de la ficha: composición en escritorio, carrusel en móvil y lightbox a pantalla completa.
 *
 * Honestidad sobre las imágenes: cada foto viene clasificada desde el servidor. Si la imagen es
 * externa o está compartida con otros alojamientos, se muestra **etiquetada como referencia** y
 * nunca como «la foto de esta casa». Si todas son referenciales, se dice claramente — con 17.616
 * de 17.619 fotos procedentes de Wikimedia, fingir una galería propia sería engañar al usuario.
 */
export default function Galeria({
  fotos,
  titulo,
  todasReferenciales,
}: {
  fotos: FotoFicha[];
  titulo: string;
  todasReferenciales: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [indice, setIndice] = useState(0);

  const cerrar = useCallback(() => setAbierta(false), []);
  const anterior = useCallback(() => setIndice((i) => (i - 1 + fotos.length) % Math.max(1, fotos.length)), [fotos.length]);
  const siguiente = useCallback(() => setIndice((i) => (i + 1) % Math.max(1, fotos.length)), [fotos.length]);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    };
    document.addEventListener("keydown", alPulsar);
    // Se bloquea el scroll del fondo mientras el lightbox está abierto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = previo;
    };
  }, [abierta, cerrar, anterior, siguiente]);

  if (fotos.length === 0) {
    return (
      <div className="vacio" style={{ maxWidth: "none" }}>
        <p className="vacio-titulo">Todavía no hay fotografías</p>
        <p className="vacio-texto">
          Este alojamiento aún no tiene imágenes propias. Preferimos decírtelo antes que mostrarte una
          foto que no corresponde.
        </p>
      </div>
    );
  }

  const abrir = (i: number) => {
    setIndice(i);
    setAbierta(true);
  };

  return (
    <section aria-label="Galería de fotografías">
      {todasReferenciales && (
        <p className="aviso" style={{ marginBottom: 10, borderColor: "var(--accent)", background: "var(--primary-soft)" }}>
          Las imágenes de este alojamiento proceden de fuentes públicas y se muestran como
          <strong> referencia del entorno</strong>, no como fotografías propias de la propiedad.
        </p>
      )}

      {/* Escritorio: composición. Móvil: carrusel con desplazamiento.
          La composición se adapta al número REAL de fotos: con una parrilla fija de cinco huecos,
          una ficha de dos fotos dejaba tres huecos vacíos enormes. */}
      <div className={`galeria-escritorio gal-n${Math.min(fotos.length, 5)}`}>
        {fotos.slice(0, 5).map((f, i) => (
          <button
            key={f.id}
            type="button"
            className={i === 0 ? "gal-principal" : "gal-secundaria"}
            onClick={() => abrir(i)}
            aria-label={`Ver fotografía ${i + 1} de ${fotos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.alt ?? titulo} loading={i === 0 ? "eager" : "lazy"} />
            {!f.propia && <span className="gal-etiqueta">Referencia{f.fuente ? ` · ${f.fuente}` : ""}</span>}
          </button>
        ))}
        {fotos.length > 1 && (
          <button type="button" className="gal-ver-todas" onClick={() => abrir(0)}>
            Ver las {fotos.length} fotos
          </button>
        )}
      </div>

      <div className="galeria-movil">
        {fotos.map((f, i) => (
          <button key={f.id} type="button" className="gal-movil-item" onClick={() => abrir(i)} aria-label={`Ver fotografía ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.alt ?? titulo} loading={i === 0 ? "eager" : "lazy"} />
            {!f.propia && <span className="gal-etiqueta">Referencia</span>}
          </button>
        ))}
        <span className="gal-contador">{fotos.length} fotos</span>
      </div>

      {abierta && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Fotografías de ${titulo}`} onClick={cerrar}>
          <button type="button" className="lb-cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
          <button
            type="button"
            className="lb-nav lb-prev"
            onClick={(e) => { e.stopPropagation(); anterior(); }}
            aria-label="Fotografía anterior"
          >
            ‹
          </button>
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotos[indice]?.url} alt={fotos[indice]?.alt ?? titulo} />
            <figcaption>
              {indice + 1} / {fotos.length}
              {fotos[indice] && !fotos[indice].propia ? ` · imagen de referencia${fotos[indice].fuente ? ` (${fotos[indice].fuente})` : ""}` : ""}
            </figcaption>
          </figure>
          <button
            type="button"
            className="lb-nav lb-next"
            onClick={(e) => { e.stopPropagation(); siguiente(); }}
            aria-label="Fotografía siguiente"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
