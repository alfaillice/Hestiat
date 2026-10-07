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
  video,
  videoMovil,
  credito,
}: {
  poster: string;
  video: string;
  videoMovil: string;
  credito: string;
}) {
  const referencia = useRef<HTMLVideoElement>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimiento) return; // solo póster: es lo que ha pedido el sistema
    const el = referencia.current;
    if (!el) return;

    // Se elige el archivo pequeño en pantallas estrechas (1,7 MB en vez de 4,7 MB).
    const archivo = window.matchMedia("(max-width: 820px)").matches ? videoMovil : video;
    setFuente(archivo);

    // El vídeo se pide cuando el navegador está libre, no antes de pintar la página.
    const pedir = () => {
      el.preload = "auto";
      el.load();
      el.play().catch(() => {
        // Si el navegador no deja reproducirlo, se queda el póster y aquí no pasa nada.
      });
    };
    const ocioso = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const t = ocioso ? ocioso(pedir, { timeout: 2500 }) : window.setTimeout(pedir, 1200);
    return () => {
      if (typeof t === "number") window.clearTimeout(t);
    };
  }, [video, videoMovil]);

  return (
    <section className="hero2">
      <div className="hero2-fondo" style={{ backgroundImage: `url(${poster})` }}>
        {fuente ? (
          <video
            ref={referencia}
            className={visible ? "hero2-video hero2-video-visible" : "hero2-video"}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
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
