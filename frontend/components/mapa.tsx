"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Mapa real de Hestiat 2.0 (Leaflet + OpenStreetMap), como el de la aplicación antigua.
 * Solo cliente: Leaflet necesita el DOM. Sin coordenadas no se pinta marcador: jamás se
 * inventa una posición.
 */
export interface PuntoMapa {
  id: number;
  slug: string;
  title: string;
  lat: string | null;
  lng: string | null;
  price_per_night: string | null;
  price_type: string;
}

export default function Mapa({
  puntos,
  activo = null,
  alto = 520,
}: {
  puntos: PuntoMapa[];
  activo?: string | null;
  alto?: number;
}) {
  const contRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const marcadoresRef = useRef<Map<string, import("leaflet").Marker>>(new Map());

  const ubicados = puntos.filter((p) => p.lat !== null && p.lng !== null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const leaflet = await import("leaflet");
      if (!vivo || !contRef.current || mapaRef.current) return;

      const mapa = leaflet.map(contRef.current, { zoomControl: true, scrollWheelZoom: true });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        })
        .addTo(mapa);
      mapa.setView([40.0, -3.5], 5.4);
      mapaRef.current = mapa;

      for (const [, m] of marcadoresRef.current) m.remove();
      marcadoresRef.current.clear();

      const texto = (p: PuntoMapa) =>
        p.price_per_night
          ? `${Number(p.price_per_night).toLocaleString("es-ES")} €`
          : "Consultar";

      for (const p of ubicados) {
        const activoEste = activo === p.slug;
        const icono = leaflet.divIcon({
          className: "hx-pin-wrapper",
          html: `<span class="hx-pin${activoEste ? " hx-pin--activo" : ""}">${texto(p)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const marcador = leaflet
          .marker([Number(p.lat), Number(p.lng)], { icon: icono, riseOnHover: true })
          .addTo(mapa)
          .on("click", () => {
            window.location.href = `/alojamiento/${p.slug}`;
          });
        marcadoresRef.current.set(p.slug, marcador);
      }

      if (ubicados.length > 0) {
        const limites = leaflet.latLngBounds(ubicados.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]));
        mapa.fitBounds(limites, { padding: [48, 48], maxZoom: 13 });
      }
    })();

    return () => {
      vivo = false;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadoresRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos, activo]);

  useEffect(() => {
    const mapa = mapaRef.current;
    const m = activo ? marcadoresRef.current.get(activo) : null;
    if (mapa && m) mapa.panTo(m.getLatLng(), { animate: true });
  }, [activo]);

  return (
    <div>
      <div ref={contRef} style={{ height: alto, borderRadius: "var(--radio)", border: "1px solid var(--border)" }} role="application" aria-label="Mapa de resultados" />
      {ubicados.length === 0 && (
        <p className="aviso" style={{ marginTop: 10 }}>
          Ningún resultado de esta búsqueda tiene coordenadas registradas, así que no mostramos
          marcadores inventados.
        </p>
      )}
      {ubicados.length > 0 && (
        <p style={{ color: "var(--muted-fg)", fontSize: 12.5, marginTop: 8 }}>
          {ubicados.length.toLocaleString("es-ES")} alojamientos en el mapa · pulsa un precio para abrir su ficha
        </p>
      )}
    </div>
  );
}
