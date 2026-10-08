"use client";

import { useEffect } from "react";

/**
 * INSTRUMENTACIÓN DE CORE WEB VITALS.
 *
 * Mide, en el navegador de quien visita la web, las tres métricas que de verdad se notan al usar una
 * página, con la API del propio navegador (sin librerías externas ni rastreadores):
 *
 *   LCP (Largest Contentful Paint)  cuándo aparece el elemento grande de la página.
 *   CLS (Cumulative Layout Shift)   cuánto se mueve la maquetación sola (los saltos molestos).
 *   INP (Interaction to Next Paint) cuánto tarda la página en responder a un toque o un clic.
 *
 * Se envía UNA sola vez por visita, al salir de la página, y solo con esos tres números y la ruta: no
 * se recoge identificador, ni IP, ni nada que permita seguir a nadie. Si algo falla, no se envía nada
 * y la web sigue igual.
 */
export default function Vitales() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

    let lcp = 0;
    let cls = 0;
    let inp = 0;
    let enviado = false;

    try {
      // LCP: se queda con el último valor informado (el elemento grande definitivo).
      new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) lcp = Math.round((entrada as PerformanceEntry & { startTime: number }).startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });

      // CLS: se suman los desplazamientos que no vienen de una interacción del usuario.
      new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          const e = entrada as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!e.hadRecentInput) cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });

      // INP: la peor latencia de interacción observada (la del último evento, como manda la métrica).
      new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          const e = entrada as PerformanceEntry & { duration: number };
          if (e.duration > inp) inp = Math.round(e.duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      /* si el navegador no soporta alguna, se mide lo que sí soporte */
    }

    const enviar = () => {
      if (enviado) return;
      enviado = true;
      const datos = JSON.stringify({
        ruta: window.location.pathname,
        lcp,
        cls: Math.round(cls * 1000) / 1000,
        inp,
        pantalla: `${window.innerWidth}x${window.innerHeight}`,
        conexion: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "",
      });
      try {
        navigator.sendBeacon("/api/vitales", new Blob([datos], { type: "application/json" }));
      } catch {
        /* sin envío: no pasa nada */
      }
    };

    const alSalir = () => enviar();
    window.addEventListener("pagehide", alSalir);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") enviar();
    });
    // Red de seguridad: si la visita es larga, se envía igualmente pasados 15 s.
    const temporizador = setTimeout(enviar, 15_000);

    return () => {
      clearTimeout(temporizador);
      window.removeEventListener("pagehide", alSalir);
      enviar();
    };
  }, []);

  return null;
}
