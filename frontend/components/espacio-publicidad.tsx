"use client";

import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENTE, PUBLICIDAD_ACTIVA, huecoDe } from "@/lib/publicidad";
import { EVENTO_CAMBIO, leerConsentimiento } from "@/lib/consentimiento";

/** Tipo de página al que pertenece un hueco, para poder medir impresiones por tipo de página y no
 *  solo por identificador. Se deduce del propio nombre del hueco: no se añade un dato que mantener. */
export function tipoDeHueco(id: string): string {
  if (id.startsWith("portada")) return "portada";
  if (id.startsWith("experiencia")) return "ficha-experiencia";
  if (id.startsWith("destino")) return "ficha-destino";
  if (id.startsWith("guia")) return "guia";
  if (id.startsWith("listado")) return "listado";
  if (id.startsWith("ficha")) return "ficha-alojamiento";
  return "otra";
}

/**
 * HUECO DE PUBLICIDAD.
 *
 * ── TRES REGLAS QUE GOBIERNAN ESTE COMPONENTE ───────────────────────────────────────────────────
 *
 *  1. SIN PERMISO DEL VISITANTE NO SE CARGA NADA DE PUBLICIDAD. Es lo que hace cierta la frase de la
 *     política de cookies: las cookies publicitarias solo se ponen si el visitante las acepta. Si no
 *     ha decidido, o ha rechazado, este componente no pide nada a Google y no pinta nada. Si cambia
 *     de opinión en el aviso, se activa solo, sin recargar la página.
 *
 *  2. SIN ANUNCIO NO HAY NI RASTRO DE ESTILO. Se vigila el estado que pone la propia librería de
 *     Google (`data-ad-status="filled"`) y solo entonces aparece el bloque con su etiqueta. Mientras
 *     no haya anuncio no se reserva alto, ni se pinta el rótulo, ni se deja banda vacía: la página se
 *     ve exactamente igual que sin publicidad. No se oculta con display:none, precisamente para no
 *     impedir que Google pueda rellenarlo.
 *
 *  3. CADA IMPRESIÓN SE CUENTA UNA VEZ. Cuando un anuncio se muestra de verdad, se envía un aviso a
 *     nuestro propio receptor, con el hueco, el tipo de página y la ruta. Nada más: ni clics ni
 *     ingresos, que solo se pueden leer en el panel de AdSense, y aquí no se inventan.
 */
export default function EspacioPublicidad({ hueco }: { hueco: string }) {
  const sitio = huecoDe(hueco);
  const slot = sitio?.slotAdsense ?? "";
  const insRef = useRef<HTMLElement | null>(null);
  const pedido = useRef(false);
  const medido = useRef(false);
  const [relleno, setRelleno] = useState(false);
  const [permiso, setPermiso] = useState(false);

  // Regla 1: permiso del visitante.
  useEffect(() => {
    const mirar = () => setPermiso(leerConsentimiento() === "aceptado");
    mirar();
    window.addEventListener(EVENTO_CAMBIO, mirar);
    return () => window.removeEventListener(EVENTO_CAMBIO, mirar);
  }, []);

  const activo = PUBLICIDAD_ACTIVA && slot !== "" && permiso;

  // Regla 2 y 3: estado del anuncio y medición de la impresión.
  useEffect(() => {
    if (!activo) return;
    const el = insRef.current;
    if (!el || !sitio) return;

    const mirar = () => {
      const lleno = el.getAttribute("data-ad-status") === "filled";
      setRelleno(lleno);
      if (lleno && !medido.current) {
        medido.current = true;
        try {
          const cuerpo = JSON.stringify({
            hueco: sitio.id,
            tipo: tipoDeHueco(sitio.id),
            ruta: window.location.pathname,
          });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(
              "/api/impresion-anuncio",
              new Blob([cuerpo], { type: "application/json" }),
            );
          } else {
            void fetch("/api/impresion-anuncio", {
              method: "POST",
              body: cuerpo,
              headers: { "content-type": "application/json" },
              keepalive: true,
            });
          }
        } catch {
          /* que falle la medición no puede afectar a la página */
        }
      }
    };

    mirar();
    const observador = new MutationObserver(mirar);
    observador.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => observador.disconnect();
  }, [activo, sitio]);

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

  // Sin anuncio no hay ni rastro de estilo: ni margen, ni línea, ni etiqueta.
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
