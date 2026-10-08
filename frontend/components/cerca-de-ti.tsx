"use client";

import { useEffect, useState } from "react";
import SeccionHome from "@/components/seccion-home";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import type { TarjetaGaleria } from "@/lib/tarjetas";

interface Cercano extends TarjetaGaleria {
  /** «a 3,2 km», calculado con la distancia real. */
  nota?: string;
}

/**
 * «Alojamientos cerca de ti».
 *
 * Cómo funciona, sin adornos: al entrar en la portada el navegador pide permiso para conocer la
 * ubicación. Si se concede, se piden a la API los alojamientos más próximos (ordenados por distancia
 * real, calculada en la base) y se enseña la sección. Si no se concede, o si algo falla, la sección
 * NO se muestra: ni un hueco, ni un mensaje de error que estorbe. Y una vez denegado, no se vuelve a
 * preguntar en la misma sesión: no se insiste.
 *
 * La ubicación no se guarda en ningún sitio: viaja en la petición, se usa para ordenar y se olvida.
 * Los datos que se ven (nombre, ubicación, precio, foto) son los mismos del catálogo real, con el
 * mismo formateador de precio que el resto de la plataforma.
 */
export default function CercaDeTi() {
  const [datos, setDatos] = useState<{
    alojamientos: Cercano[];
    guardados: number[];
    haySesion: boolean;
    total: number;
  } | null>(null);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    if (sessionStorage.getItem("hestiat-cerca") === "no") return; // ya dijo que no: no se insiste

    navigator.geolocation.getCurrentPosition(
      async (posicion) => {
        const lat = posicion.coords.latitude;
        const lng = posicion.coords.longitude;
        try {
          const respuesta = await fetch(`/api/cerca?lat=${lat}&lng=${lng}`);
          const d = await respuesta.json();
          if (!respuesta.ok || !Array.isArray(d.alojamientos) || d.alojamientos.length === 0) return;
          setPunto({ lat, lng });
          setDatos({
            alojamientos: d.alojamientos,
            guardados: d.guardados ?? [],
            haySesion: Boolean(d.haySesion),
            total: Number.isFinite(Number(d.total)) ? Number(d.total) : d.alojamientos.length,
          });
        } catch {
          // Sin datos: la sección simplemente no aparece.
        }
      },
      () => {
        sessionStorage.setItem("hestiat-cerca", "no");
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  if (!datos || !punto) return null;

  return (
    <SeccionHome
      titulo="Alojamientos cerca de ti"
      sub={`Ordenados por distancia real desde donde estás · ${datos.alojamientos.length} de ${datos.total.toLocaleString("es-ES")} alojamientos`}
      verTodos={`/search?cerca=${punto.lat.toFixed(4)},${punto.lng.toFixed(4)}`}
      verTodosTexto="Ver todos cerca de ti"
    >
      {datos.alojamientos.map((a) => (
        <TarjetaAlojamiento
          key={a.id}
          a={a}
          nota={a.nota}
          guardado={datos.guardados.includes(a.id)}
          haySesion={datos.haySesion}
          volverA="/"
        />
      ))}
    </SeccionHome>
  );
}
