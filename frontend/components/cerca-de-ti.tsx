"use client";

import { useCallback, useEffect, useState } from "react";
import SeccionHome from "@/components/seccion-home";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import ImagenSegura from "@/components/imagen-segura";
import type { RespuestaCerca } from "@/lib/cerca.tipos";

/**
 * «Cerca de ti»: alojamientos y experiencias alrededor de donde esté la persona.
 *
 * CÓMO SE PIDE LA UBICACIÓN (esto es lo importante)
 *
 * No se pide permiso al cargar la página. Primero se MIRA si ya está concedido:
 *
 *  · Concedido  → se usa la ubicación sin molestar a nadie y se carga «cerca de ti».
 *  · Sin decidir → no se pide nada. Se enseña una acción discreta («📍 Ver alojamientos cerca de
 *    mí») y solo al pulsarla el navegador pregunta. Si se acepta, se carga; si se rechaza, se queda
 *    lo que ya había y no se vuelve a insistir.
 *  · Rechazado  → no se vuelve a preguntar nunca en esta sesión. La sección NO se queda vacía:
 *    pasa a usar el destino elegido o la última búsqueda, y si tampoco hay, una selección del
 *    catálogo. En esos casos el título CAMBIA («cerca de Madrid», «Descubre alojamientos») y no se
 *    enseña ninguna distancia, porque no hay ninguna que medir.
 *
 * Nunca se muestran coordenadas, nunca se inventa una distancia y no se bloquea nada por no dar
 * permiso: la home, Explorar, la búsqueda y las reservas funcionan igual.
 */
export default function CercaDeTi({ destino }: { destino?: string }) {
  const [datos, setDatos] = useState<RespuestaCerca | null>(null);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  /** El navegador puede preguntar (no está denegado) y aún no tenemos ubicación. */
  const [puedeOfrecer, setPuedeOfrecer] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  const cargar = useCallback(async (consulta: string) => {
    try {
      const r = await fetch(`/api/cerca?${consulta}`);
      if (!r.ok) return;
      const d: RespuestaCerca = await r.json();
      if (!Array.isArray(d.alojamientos) && !Array.isArray(d.experiencias)) return;
      if ((d.alojamientos?.length ?? 0) === 0 && (d.experiencias?.length ?? 0) === 0) return;
      setDatos(d);
    } catch {
      // Si falla, la sección simplemente no aparece: no se rompe nada.
    }
  }, []);

  const usarUbicacion = useCallback(
    (conGesto: boolean) => {
      if (!("geolocation" in navigator)) return;
      setPidiendo(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPunto({ lat, lng });
          setPuedeOfrecer(false);
          setPidiendo(false);
          void cargar(`lat=${lat}&lng=${lng}`);
        },
        () => {
          // Rechazada o no disponible: se queda lo que ya había y no se insiste más.
          setPidiendo(false);
          setPuedeOfrecer(false);
          if (conGesto) sessionStorage.setItem("hestiat-cerca-no", "1");
        },
        { timeout: 8000, maximumAge: 600000 },
      );
    },
    [cargar],
  );

  useEffect(() => {
    let vivo = true;
    (async () => {
      // ¿Ya está concedido? Entonces se usa sin preguntar.
      let estado: PermissionState | null = null;
      try {
        if (navigator.permissions?.query) {
          estado = (await navigator.permissions.query({ name: "geolocation" as PermissionName })).state;
        }
      } catch {
        estado = null; // navegador sin Permissions API: se trata como «sin decidir»
      }
      if (!vivo) return;
      if (estado === "granted") {
        usarUbicacion(false);
        return;
      }
      const denegadoAntes = sessionStorage.getItem("hestiat-cerca-no") === "1";
      if (estado === "prompt" && !denegadoAntes) setPuedeOfrecer(true);

      // Sin ubicación: se usa el destino elegido, o la última búsqueda, o una selección del catálogo.
      const ultimo = (localStorage.getItem("hestiat-ultimo-destino") ?? "").trim();
      const elegido = (destino ?? "").trim();
      const cual = elegido || ultimo;
      await cargar(cual ? `destino=${encodeURIComponent(cual)}` : "destino=");
    })();
    return () => {
      vivo = false;
    };
  }, [destino, cargar, usarUbicacion]);

  if (!datos) return null;

  const conPunto = datos.modo === "punto" && punto !== null;
  const tituloAloj = conPunto ? "Alojamientos cerca de ti" : datos.etiqueta ? `Alojamientos cerca de ${datos.etiqueta}` : "Descubre alojamientos";
  const tituloExpe = conPunto ? "Experiencias cerca de ti" : datos.etiqueta ? `Experiencias cerca de ${datos.etiqueta}` : "Experiencias que pueden interesarte";
  const subAloj = conPunto
    ? `Ordenados por distancia real desde donde estás · ${datos.alojamientos.length} de ${datos.totales.alojamientos.toLocaleString("es-ES")}`
    : datos.etiqueta
      ? `Alojamientos en ${datos.etiqueta} y su entorno`
      : "Una selección del catálogo real";
  const subExpe = conPunto
    ? "Ordenadas por distancia real desde donde estás"
    : datos.etiqueta
      ? `Experiencias en ${datos.etiqueta}`
      : "Una selección del catálogo real";
  const verTodosAloj = conPunto
    ? `/search?cerca=${punto!.lat.toFixed(4)},${punto!.lng.toFixed(4)}`
    : datos.etiqueta
      ? `/search?q=${encodeURIComponent(datos.etiqueta)}`
      : "/search";
  const verTodosExpe = datos.etiqueta ? `/experiencias?provincia=${encodeURIComponent(datos.etiqueta)}` : "/experiencias";

  return (
    <>
      {/* La acción discreta: solo aparece si el navegador puede preguntar y aún no hay ubicación. */}
      {puedeOfrecer && datos.alojamientos.length > 0 ? (
        <p className="cerca-ofrecer">
          <button type="button" className="fechas-disparador" onClick={() => usarUbicacion(true)} disabled={pidiendo}>
            {pidiendo ? "Buscando tu ubicación…" : "📍 Ver alojamientos cerca de mí"}
          </button>
        </p>
      ) : null}

      {datos.alojamientos.length > 0 ? (
        <SeccionHome titulo={tituloAloj} sub={subAloj} verTodos={verTodosAloj} verTodosTexto="Ver todos">
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
      ) : null}

      {datos.experiencias.length > 0 ? (
        <SeccionHome titulo={tituloExpe} sub={subExpe} verTodos={verTodosExpe} verTodosTexto="Ver todas">
          {datos.experiencias.map((e) => (
            <a className="tcat" key={e.id} href={e.href}>
              <span className="tcat-media">
                <ImagenSegura src={e.imagen} alt={`${e.nombre}: imagen de referencia`} />
              </span>
              <span className="tcat-txt">
                <b>{e.nombre}</b>
                <span>
                  {[e.municipio ?? e.provincia].filter(Boolean).join("") || "Sin ubicación"}
                  {e.nota ? ` · ${e.nota}` : ""}
                </span>
              </span>
            </a>
          ))}
        </SeccionHome>
      ) : null}
    </>
  );
}
