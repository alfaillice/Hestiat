"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENTE, PUBLICIDAD_ACTIVA, huecoDe } from "@/lib/publicidad";

/**
 * HUECO DE PUBLICIDAD.
 *
 * Con la publicidad apagada —que es como está hoy— este componente no dibuja absolutamente nada:
 * ni caja, ni borde, ni espacio reservado. Así el sitio no reserva huecos vacíos ni pierde velocidad
 * por publicidad que todavía no existe. Y aunque se encendiera el interruptor, un hueco sin su
 * `slotAdsense` tampoco pinta nada: nunca aparece una banda vacía.
 *
 * Cuando el hueco SÍ tiene su bloque, las tres decisiones que protegen la experiencia de usuario:
 *
 *  1. RESERVA EL ALTO ANTES DE CARGAR (`minHeight`), para que el anuncio al aparecer no empuje el
 *     contenido hacia abajo. Los saltos de maquetación son lo que más estorba al leer.
 *  2. SE PIDE UNA SOLA VEZ, sin bucles ni reintentos que gasten peticiones.
 *  3. VA ETIQUETADO como publicidad (`aria-label` y un rótulo visible), para que nadie lo confunda
 *     con contenido de Hestiat.
 */
export default function EspacioPublicidad({ hueco }: { hueco: string }) {
  const sitio = huecoDe(hueco);
  const slot = sitio?.slotAdsense ?? "";
  const activo = PUBLICIDAD_ACTIVA && slot !== "";
  const pedido = useRef(false);

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
      // Si el script no está disponible, el hueco se queda vacío: nunca se rompe la página.
    }
  }, [activo]);

  if (!activo || !sitio) return null;

  return (
    <aside
      className={`publi publi-${sitio.formato}`}
      data-hueco={sitio.id}
      aria-label="Publicidad"
      style={{ minHeight: `${sitio.alto}px` }}
    >
      <span className="publi-etq">Publicidad</span>
      <ins
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
