"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { iconoPin } from "@/components/icono-mapa";

/**
 * Mapa de la ficha: un solo marcador, en la propia página.
 *
 * Deliberadamente separado del mapa del buscador: ese sincroniza listado y marcadores con precios,
 * y tocarlo para la ficha habría arriesgado romper la búsqueda. Aquí solo hace falta una cosa —
 * situar ESTE alojamiento— y con las coordenadas reales que vienen de la base. Si no las hay, no
 * se pinta ningún mapa: nunca se coloca un alojamiento en un punto inventado.
 */
export default function MapaFicha({
  lat,
  lng,
  titulo,
  lugar,
  aproximada = false,
}: {
  lat: number;
  lng: number;
  titulo: string;
  lugar: string;
  /** Ubicación aproximada: se dibuja la zona, nunca el punto exacto. */
  aproximada?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mapa: any = null;
    let cancelado = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelado || !contenedor.current) return;

        mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView([lat, lng], aproximada ? 13 : 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(mapa);
        // Con ubicación aproximada NO se planta un marcador: un marcador señala un punto exacto, y
        // enseñar el punto exacto cuando el anfitrión ha pedido privacidad sería contradecirle.
        if (aproximada) {
          L.circle([lat, lng], {
            radius: 700,
            color: "#0f6f7a",
            weight: 2,
            fillColor: "#0f6f7a",
            fillOpacity: 0.12,
          })
            .addTo(mapa)
            .bindPopup(`${titulo}${lugar ? ` · ${lugar}` : ""}<br><em>Ubicación aproximada</em>`);
        } else {
          // Icono propio: si no se le pasa, Leaflet usa el suyo por defecto, que apunta a unas
          // imágenes con ruta relativa que el paquete no sirve, y el marcador salía como imagen
          // rota. Ver `components/icono-mapa`.
          L.marker([lat, lng], { icon: iconoPin(L) })
            .addTo(mapa)
            .bindPopup(`${titulo}${lugar ? ` · ${lugar}` : ""}`);
        }

        // Leaflet pone sus controles en inglés ("Zoom in", "Marker"). Se traducen el título y el
        // nombre accesible: la ficha entera está en español.
        const rotular = (sel: string, texto: string) => {
          const el = contenedor.current?.querySelector(sel);
          if (el) {
            el.setAttribute("title", texto);
            el.setAttribute("aria-label", texto);
          }
        };
        rotular(".leaflet-control-zoom-in", "Acercar");
        rotular(".leaflet-control-zoom-out", "Alejar");
        // El icono del marcador lo pinta Leaflet en el siguiente fotograma: se rotula después.
        requestAnimationFrame(() =>
          rotular(".leaflet-marker-icon", `${titulo}${lugar ? ` · ${lugar}` : ""}`),
        );
      } catch (e) {
        // Si el mapa no carga, la ficha sigue funcionando: se avisa y se muestran los datos.
        if (!cancelado) setError(true);
      }
    })();

    return () => {
      cancelado = true;
      if (mapa) mapa.remove();
    };
  }, [lat, lng, titulo, lugar]);

  if (error) {
    return (
      <p className="aviso">
        No se ha podido cargar el mapa. La ubicación de este alojamiento es {lugar || "la indicada en la ficha"}.
      </p>
    );
  }

  // SIN role="img": el contenedor declara una imagen pero dentro lleva controles que se pueden
  // enfocar (acercar, alejar y el marcador), y eso es un error serio de accesibilidad
  // (nested-interactive). Un div sin rol no aporta nada malo; el mapa conserva su texto alternativo,
  // que es lo que leen los lectores de pantalla para saber de qué alojamiento es.
  // EL BOTÓN DE CÓMO LLEGAR VA AQUÍ, DEBAJO DEL MAPA, Y EN UN SOLO SITIO: las tres fichas
  // (alojamiento, experiencia y servicio) usan este mismo componente, así que el botón sale en las
  // tres sin repetir código ni poder desincronizarse.
  //
  // Con ubicación APROXIMADA no se dan indicaciones: llevar a alguien hasta el punto exacto cuando
  // el anfitrión ha pedido privacidad sería contradecirle. En su lugar se explica por qué.
  const indicaciones = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="mapa-caja">
      <div ref={contenedor} className="mapa-ficha" aria-label={`Mapa de ${titulo}`} />
      {aproximada ? (
        <p className="m mapa-nota" style={{ fontSize: 13 }}>
          La ubicación es aproximada: el anfitrión ha pedido no mostrar el punto exacto.
        </p>
      ) : (
        <a
          className="mapa-como-llegar"
          href={indicaciones}
          target="_blank"
          rel="noopener noreferrer"
        >
          Cómo llegar
        </a>
      )}
    </div>
  );
}
