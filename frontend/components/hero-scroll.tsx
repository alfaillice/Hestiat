"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Portada cinematográfica: el scroll manda sobre el tiempo del vídeo.
 *
 * Cómo funciona, en corto:
 *  · La sección ocupa varias pantallas de alto; dentro, la película queda fija (`sticky`).
 *  · La posición del scroll se traduce en un instante del vídeo, así que la cámara avanza al ritmo
 *    al que baja el visitante. El vídeo NUNCA se reproduce solo: solo se busca en él.
 *  · El avance se suaviza con un pequeño retardo, porque un salto por cada evento de scroll se ve a
 *    tirones; y la opacidad del texto se mueve con una variable CSS, no con estado de React, para no
 *    repintar la página sesenta veces por segundo.
 *  · Hasta que el vídeo puede buscar, se ve el póster: nunca un hueco negro.
 *  · Si el visitante pide menos movimiento (`prefers-reduced-motion`), la sección se queda en una
 *    pantalla y se ve el póster quieto. No se le obliga a tragar la animación.
 *
 * El contenido de la portada (titular, buscador) entra como `children` desde el servidor, así que
 * sigue en el HTML: se ve sin JavaScript y los buscadores lo leen.
 */
export default function HeroScroll({
  poster,
  video,
  videoMovil,
  children,
  credito,
}: {
  poster: string;
  video: string;
  videoMovil: string;
  children: ReactNode;
  credito?: string;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const pelicula = useRef<HTMLVideoElement | null>(null);
  const [fuente, setFuente] = useState(video);
  const [listo, setListo] = useState(false);
  const [sinMovimiento, setSinMovimiento] = useState(false);

  // El vídeo de móvil pesa la tercera parte: se elige por ancho, y se revisa al girar el teléfono.
  useEffect(() => {
    const elegir = () => setFuente(window.matchMedia("(max-width: 760px)").matches ? videoMovil : video);
    elegir();
    window.addEventListener("resize", elegir);
    return () => window.removeEventListener("resize", elegir);
  }, [video, videoMovil]);

  useEffect(() => {
    const v = pelicula.current;
    const c = caja.current;
    if (!v || !c) return;

    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducir) {
      setSinMovimiento(true);
      setListo(true);
      return;
    }

    let raf = 0;
    let visible = false;
    let buscable = false;
    let destino = 0;
    let actual = 0;

    const puedeBuscar = () => {
      buscable = v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 0;
      if (buscable) setListo(true);
      return buscable;
    };

    // Solo se descarga cuando la portada entra en pantalla; antes no se gasta un byte de más.
    const observador = new IntersectionObserver(
      (entradas) => {
        visible = entradas.some((e) => e.isIntersecting);
        if (visible && v.preload !== "auto") {
          v.preload = "auto";
          v.load();
        }
      },
      { rootMargin: "200px" },
    );
    observador.observe(c);

    const medir = () => {
      const r = c.getBoundingClientRect();
      const recorrido = c.offsetHeight - window.innerHeight;
      const p = recorrido > 0 ? Math.min(1, Math.max(0, -r.top / recorrido)) : 0;
      // El texto se va pronto para dejar la película sola; se resuelve en CSS.
      c.style.setProperty("--cine-progreso", p.toFixed(4));
      // Y con él se van sus clics: un elemento transparente sigue capturando pulsaciones.
      c.style.setProperty("--cine-clics", p > 0.36 ? "none" : "auto");
      if (puedeBuscar()) destino = p * v.duration;
    };

    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      if (!visible || !buscable) return;
      const salto = destino - actual;
      if (Math.abs(salto) > 0.006) {
        actual += salto * 0.18;
        try {
          v.currentTime = actual;
        } catch {
          /* el navegador aún no admite la búsqueda: se reintenta en el siguiente fotograma */
        }
      }
    };

    const alCargar = () => {
      puedeBuscar();
      medir();
    };

    v.addEventListener("loadedmetadata", alCargar);
    v.addEventListener("loadeddata", alCargar);
    v.addEventListener("canplay", alCargar);
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    medir();
    raf = requestAnimationFrame(bucle);

    return () => {
      cancelAnimationFrame(raf);
      observador.disconnect();
      v.removeEventListener("loadedmetadata", alCargar);
      v.removeEventListener("loadeddata", alCargar);
      v.removeEventListener("canplay", alCargar);
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [fuente]);

  return (
    <section
      ref={caja}
      className={"hero-cine" + (sinMovimiento ? " hero-cine-quieto" : "")}
      style={{ ["--cine-progreso" as string]: 0 }}
    >
      <div className="hero-cine-fijo">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={pelicula}
          className={"hero-cine-video" + (listo ? " hero-cine-video-listo" : "")}
          src={fuente}
          poster={poster}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="hero-cine-velo" />
        <div className="hero-cine-contenido">{children}</div>
        {credito && <span className="hero-cine-credito">{credito}</span>}
        <span className="hero-cine-pista" aria-hidden="true">
          Desliza
        </span>
      </div>
    </section>
  );
}
