"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * El hero de la portada: un fondo con vídeo y el contenido ENCIMA, visible desde el primer momento.
 *
 * LO QUE SE ARREGLA AQUÍ
 *
 * Antes el vídeo mandaba: la página medía varias pantallas de alto y la película avanzaba con el
 * scroll, así que el contenido real aparecía tarde y el vídeo se veía a tirones. Ahora el vídeo es
 * un fondo de una sola pantalla (72 % del alto), se reproduce solo, en bucle y sin sonido, y nunca
 * bloquea nada: ni el scroll, ni los clics, ni la carga de la página.
 *
 * CÓMO SE EVITA EL FONDO NEGRO
 *
 * El póster se pinta como fondo CSS desde el primer fotograma. El vídeo se pide después, cuando el
 * navegador está libre, y solo entonces aparece encima con una transición. Si el vídeo no carga o
 * falla, se queda el póster, que es una imagen de verdad. Si la persona ha pedido menos movimiento
 * en su sistema, no se reproduce nada: solo el póster.
 */
export default function HeroHome({
  poster,
  posterMovil,
  video,
  videoMovil,
  credito,
}: {
  poster: string;
  posterMovil?: string;
  video: string;
  videoMovil: string;
  credito: string;
}) {
  const referencia = useRef<HTMLVideoElement>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  // La versión pequeña del póster: es la que descarga el móvil.
  const p900 = posterMovil ?? poster;

  // PRIMERO se decide si hay vídeo (y cuál). El elemento se pinta a partir de aquí.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // solo póster
    setFuente(window.matchMedia("(max-width: 820px)").matches ? videoMovil : video);
  }, [video, videoMovil]);

  // DESPUÉS se pide el vídeo, cuando el navegador está libre, no antes de pintar la página.
  // (Antes esto estaba en el mismo efecto que decidía la fuente, y como el elemento todavía no
  // existía, la referencia era nula y el vídeo no llegaba a pintarse nunca.)
  useEffect(() => {
    const el = referencia.current;
    if (!fuente || !el) return;
    const pedir = () => {
      el.preload = "auto";
      el.load();
      el.play().catch(() => {
        // Si el navegador no deja reproducirlo, se queda el póster y aquí no pasa nada.
      });
    };
    const ocioso = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ocioso) {
      const manejar = ocioso(pedir, { timeout: 2500 });
      return () => {
        const cancelar = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
        cancelar?.(manejar);
      };
    }
    const t = window.setTimeout(pedir, 1200);
    return () => window.clearTimeout(t);
  }, [fuente]);

  return (
    <section className="hero2">
      {/* El póster se declara como recurso de la propia página para que el navegador lo descubra al
          leer el HTML, sin esperar a que termine el CSS. Es el elemento que mide el LCP: cuanto
          antes se pida, antes se pinta. Y va en WebP (57 KB en móvil, 146 KB en escritorio) en
          lugar del JPG de 204 KB, con las dos medidas declaradas para que nadie descargue de más. */}
      <link
        rel="preload"
        as="image"
        href={poster}
        imageSrcSet={`${p900} 900w, ${poster} 1600w`}
        imageSizes="100vw"
        fetchPriority="high"
      />
      <div className="hero2-fondo">
        <img
          className="hero2-poster"
          src={poster}
          srcSet={`${p900} 900w, ${poster} 1600w`}
          sizes="100vw"
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
        />
        {fuente ? (
          <video
            ref={referencia}
            className={visible ? "hero2-video hero2-video-visible" : "hero2-video"}
            poster={poster}
            preload="none"
            muted
            loop
            playsInline
            onPlaying={() => setVisible(true)}
            onError={() => setFuente(null)}
          >
            <source src={fuente} type="video/mp4" />
          </video>
        ) : null}
        <span className="hero2-velo" />
      </div>

      <div className="hero2-cont">
        <p className="hero2-eyebrow">Alojamientos, experiencias y servicios</p>
        <h1>
          Descubre, vive, disfruta
          <span className="hero2-sub">Tu próxima experiencia empieza aquí</span>
        </h1>

        <div className="hero2-accesos">
          <Link className="acceso" href="/search">
            <span className="acceso-icono" aria-hidden="true">🏠</span>
            <span>
              <b>Alojamientos</b>
              <span>Casas, hoteles y más</span>
            </span>
          </Link>
          <Link className="acceso" href="/experiencias">
            <span className="acceso-icono" aria-hidden="true">🎈</span>
            <span>
              <b>Experiencias</b>
              <span>Actividades únicas</span>
            </span>
          </Link>
          <Link className="acceso" href="/servicios">
            <span className="acceso-icono" aria-hidden="true">🛎</span>
            <span>
              <b>Servicios</b>
              <span>Todo lo que necesitas</span>
            </span>
          </Link>
        </div>
      </div>

      <span className="hero2-credito">{credito}</span>
    </section>
  );
}
