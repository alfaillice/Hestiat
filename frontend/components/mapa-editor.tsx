"use client";

import { iconoPin } from "@/components/icono-mapa";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Ubicación en el editor: dirección ↔ coordenadas, en los dos sentidos.
 *
 * · Buscar una dirección y colocar el marcador automáticamente (geocodificación con Nominatim, de
 *   OpenStreetMap). La búsqueda se hace **desde el navegador del usuario**, no desde el servidor:
 *   es su IP la que consulta el servicio, como corresponde a su política de uso.
 * · Ajustar la posición a mano: el marcador se arrastra y las coordenadas se actualizan solas.
 * · Escribir las coordenadas directamente, para cuando ya se conocen.
 *
 * Nunca coloca el alojamiento en un punto inventado: si no hay coordenadas, no hay marcador, y se
 * dice. El estado final vive en dos campos del formulario (`lat` y `lng`), así que se guarda con el
 * resto de la información general.
 */
export default function MapaEditor({
  latInicial,
  lngInicial,
  direccion,
  ciudad,
  provincia,
}: {
  latInicial: number | null;
  lngInicial: number | null;
  direccion: string;
  ciudad: string;
  provincia: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const marcadorRef = useRef<any>(null);
  const [lat, setLat] = useState<number | null>(latInicial);
  const [lng, setLng] = useState<number | null>(lngInicial);
  const [consulta, setConsulta] = useState([direccion, ciudad, provincia].filter(Boolean).join(", "));
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "info"; texto: string } | null>(null);
  const [buscando, setBuscando] = useState(false);

  // Se crea una sola vez; los cambios de posición se aplican moviendo el marcador.
  useEffect(() => {
    let mapa: any = null;
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapaRef.current) return;
      const centro: [number, number] = [latInicial ?? 40.4168, lngInicial ?? -3.7038];
      mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView(centro, latInicial ? 15 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapa);
      mapaRef.current = mapa;
      if (latInicial !== null && lngInicial !== null) {
        marcadorRef.current = L.marker(centro, { draggable: true, icon: iconoPin(L) }).addTo(mapa);
        marcadorRef.current.on("dragend", () => {
          const p = marcadorRef.current.getLatLng();
          setLat(Math.round(p.lat * 1e6) / 1e6);
          setLng(Math.round(p.lng * 1e6) / 1e6);
        });
      } else {
        mapa.on("click", (e: any) => {
          const p = e.latlng;
          setLat(Math.round(p.lat * 1e6) / 1e6);
          setLng(Math.round(p.lng * 1e6) / 1e6);
        });
      }
    })();
    return () => {
      cancelado = true;
      if (mapa) mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
  }, [latInicial, lngInicial]);

  /** Coloca o mueve el marcador a unas coordenadas. */
  const situar = async (nuevoLat: number, nuevoLng: number, zoom = 16) => {
    setLat(nuevoLat);
    setLng(nuevoLng);
    const L = (await import("leaflet")).default;
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (marcadorRef.current) {
      marcadorRef.current.setLatLng([nuevoLat, nuevoLng]);
    } else {
      marcadorRef.current = L.marker([nuevoLat, nuevoLng], { draggable: true, icon: iconoPin(L) }).addTo(mapa);
      marcadorRef.current.on("dragend", () => {
        const p = marcadorRef.current.getLatLng();
        setLat(Math.round(p.lat * 1e6) / 1e6);
        setLng(Math.round(p.lng * 1e6) / 1e6);
      });
    }
    mapa.setView([nuevoLat, nuevoLng], zoom);
  };

  const buscar = async () => {
    const q = consulta.trim();
    if (q.length < 3) {
      setEstado({ tipo: "error", texto: "Escribe al menos una parte de la dirección." });
      return;
    }
    setBuscando(true);
    setEstado({ tipo: "info", texto: "Buscando la dirección…" });
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("respuesta no válida");
      const datos = await r.json();
      if (!Array.isArray(datos) || datos.length === 0) {
        setEstado({ tipo: "error", texto: "No se ha encontrado esa dirección. Prueba con más detalle o coloca el marcador a mano." });
        return;
      }
      const p = datos[0];
      await situar(Number(p.lat), Number(p.lon));
      setEstado({ tipo: "ok", texto: `Situado en: ${String(p.display_name).slice(0, 120)}` });
    } catch {
      setEstado({ tipo: "error", texto: "No se ha podido consultar el buscador de direcciones. Puedes escribir las coordenadas a mano." });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="mapa-editor">
      <div className="fila-2">
        <label className="f-campo">
          <span className="etq">Buscar la dirección en el mapa</span>
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Calle, número, ciudad" maxLength={200} />
        </label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button className="f-aplicar" type="button" onClick={buscar} disabled={buscando}>
            {buscando ? "Buscando…" : "Situar"}
          </button>
          <span className="m" style={{ fontSize: 12, color: "var(--muted-fg)" }}>
            Búsqueda por OpenStreetMap
          </span>
        </div>
      </div>

      <div ref={contenedor} className="mapa-editor-mapa" aria-label="Mapa de la ubicación" />

      <div className="fila-2" style={{ marginTop: 10 }}>
        <label className="f-campo">
          <span className="etq">Latitud</span>
          <input
            name="lat"
            value={lat ?? ""}
            onChange={(e) => setLat(e.target.value === "" ? null : Number(e.target.value))}
            inputMode="decimal"
            placeholder="38.288099"
          />
        </label>
        <label className="f-campo">
          <span className="etq">Longitud</span>
          <input
            name="lng"
            value={lng ?? ""}
            onChange={(e) => setLng(e.target.value === "" ? null : Number(e.target.value))}
            inputMode="decimal"
            placeholder="-0.718749"
          />
        </label>
      </div>

      <p className="m" style={{ fontSize: 12.5, color: "var(--muted-fg)", marginTop: 6 }}>
        Puedes arrastrar el marcador o hacer clic en el mapa. Las coordenadas se actualizan solas.
        {lat === null || lng === null ? " Sin coordenadas, el alojamiento no aparece en el mapa público." : ""}
      </p>

      {estado && (
        <p
          role="status"
          className="m"
          style={{
            fontSize: 13,
            marginTop: 6,
            color: estado.tipo === "error" ? "var(--destructive)" : estado.tipo === "ok" ? "var(--success)" : "var(--muted-fg)",
          }}
        >
          {estado.texto}
        </p>
      )}
    </div>
  );
}
