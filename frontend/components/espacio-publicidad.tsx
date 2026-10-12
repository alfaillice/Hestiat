"use client";

import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENTE, PUBLICIDAD_ACTIVA, huecoDe } from "@/lib/publicidad";

/**
 * HUECO DE PUBLICIDAD.
 *
 * ── LO QUE SE APRENDIÓ MIDIENDO (12-10-2026) ────────────────────────────────────────────────────
 * El bloque se colocó y el anuncio NO se rellenaba (la cuenta de AdSense está todavía en
 * verificación). Al medirlo en el navegador salió el problema de verdad: el hueco reservaba su alto
 * desde el principio, así que la página mostraba una banda vacía de 280 píxeles con la palabra
 * «Publicidad» encima. Un hueco blanco es peor que no tener publicidad.
 *
 * ── CÓMO SE COMPORTA AHORA ──────────────────────────────────────────────────────────────────────
 *  1. MIENTRAS EL ANUNCIO NO ESTÉ RELLENO NO SE VE NADA: ni caja, ni etiqueta, ni banda vacía, ni
 *     espacio reservado. Se vigila el estado que la propia librería de Google pone en el bloque
 *     (`data-ad-status`) y solo entonces aparece. Si el visitante usa un bloqueador de anuncios, o
 *     la cuenta no está aprobada, la página se ve exactamente igual que sin publicidad.
 *  2. CUANDO SÍ HAY ANUNCIO, aparece etiquetado («Publicidad») y separado del contenido por una
 *     línea, para que nadie lo confunda con contenido de Hestiat.
 *  3. SE PIDE UNA SOLA VEZ, sin bucles ni reintentos que gasten peticiones.
 */
export default function EspacioPublicidad({ hueco }: { hueco: string }) {
  const sitio = huecoDe(hueco);
  const slot = sitio?.slotAdsense ?? "";
  const activo = PUBLICIDAD_ACTIVA && slot !== "";
  const insRef = useRef<HTMLElement | null>(null);
  const pedido = useRef(false);
  const [relleno, setRelleno] = useState(false);

  useEffect(() => {
    if (!activo) return;
    const el = insRef.current;
    if (!el) return;

    // Google marca el bloque con data-ad-status cuando decide qué hacer con él.
    const mirar = () => setRelleno(el.getAttribute("data-ad-status") === "filled");
    mirar();
    const observador = new MutationObserver(mirar);
    observador.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => observador.disconnect();
  }, [activo]);

  useEffect(() => {
    if (!activo || pedido.current) return;
    try {
      // La librería la carga el script de AdSense del <head>. Si aún no está, deja la petición en
      // cola y la resuelve cuando termine de cargar.
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pedido.current = true;
    } catch {
      // Sin librería disponible el hueco se queda invisible: nunca se rompe la página.
    }
  }, [activo]);

  if (!activo || !sitio) return null;

  // SIN ANUNCIO NO HAY NI RASTRO DE ESTILO: ni margen, ni línea de separación, ni etiqueta. El
  // bloque sigue en la página (0 píxeles de alto) para que Google pueda rellenarlo cuando la cuenta
  // esté aprobada; lo que no puede es taparse con display:none, porque entonces nunca se rellenaría.
  const clase = relleno ? `publi publi-${sitio.formato}` : undefined;

  return (
    <aside className={clase} data-hueco={sitio.id}>
      {relleno ? <span className="publi-etq">Publicidad</span> : null}
      <ins
        ref={insRef as React.RefObject<HTMLModElement>}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENTE}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
