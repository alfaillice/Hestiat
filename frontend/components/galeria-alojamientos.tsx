"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import type { TarjetaGaleria } from "@/lib/tarjetas";

/**
 * Galería de alojamientos con scroll infinito.
 *
 * Reglas que sigue:
 *  · Las tarjetas nuevas se **añaden al mismo cuadrícula**, no a un bloque distinto: si el número de
 *    resultados no es múltiplo del de columnas, la última fila simplemente queda incompleta.
 *  · Se piden tandas de 42 (6 columnas × 7 filas, como se pidió) y solo cuando el centinela se
 *    acerca a la pantalla, con un margen para que no se note el salto.
 *  · Nunca se pide dos veces la misma página a la vez, y si una tanda falla se dice y se ofrece
 *    reintentar: no se queda cargando para siempre.
 *  · Sin JavaScript sigue funcionando: el centinela es un enlace real a la página siguiente.
 */
export default function GaleriaAlojamientos({
  iniciales,
  total,
  porPagina,
  consulta,
  haySesion,
  guardadosIniciales,
  basePath,
}: {
  iniciales: TarjetaGaleria[];
  total: number;
  porPagina: number;
  /** Filtros actuales en formato de consulta, sin el parámetro `p`. */
  consulta: string;
  haySesion: boolean;
  guardadosIniciales: number[];
  basePath: string;
}) {
  const [tarjetas, setTarjetas] = useState<TarjetaGaleria[]>(iniciales);
  const [guardados, setGuardados] = useState<Set<number>>(() => new Set(guardadosIniciales));
  const [pagina, setPagina] = useState(1);
  const [siguiente, setSiguiente] = useState<number | null>(iniciales.length < total ? 2 : null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const centinela = useRef<HTMLDivElement | null>(null);
  const enCurso = useRef(false);

  const cargar = useCallback(async () => {
    if (enCurso.current || siguiente === null) return;
    enCurso.current = true;
    setCargando(true);
    setError(false);
    try {
      const qs = new URLSearchParams(consulta);
      qs.set("p", String(siguiente));
      const r = await fetch(`/api/buscar?${qs.toString()}`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("respuesta no válida");
      const datos = await r.json();
      if (!datos?.ok) throw new Error("respuesta no válida");
      setTarjetas((previas) => [...previas, ...(datos.tarjetas as TarjetaGaleria[])]);
      setGuardados((previos) => {
        const s = new Set(previos);
        for (const id of (datos.guardados ?? []) as number[]) s.add(id);
        return s;
      });
      setPagina(Number(datos.pagina));
      setSiguiente(datos.siguiente === null ? null : Number(datos.siguiente));
    } catch {
      setError(true);
    } finally {
      setCargando(false);
      enCurso.current = false;
    }
  }, [consulta, siguiente]);

  // Se carga cuando el centinela entra en pantalla (con 900 px de margen anticipado).
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || siguiente === null) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void cargar();
      },
      { rootMargin: "900px 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [cargar, siguiente]);

  const enlaceSiguiente = () => {
    const qs = new URLSearchParams(consulta);
    qs.set("p", String(siguiente ?? pagina));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <>
      <p className="galeria-cuenta" aria-live="polite">
        {total.toLocaleString("es-ES")} alojamientos · mostrando {tarjetas.length.toLocaleString("es-ES")}
      </p>

      <div className="galeria" role="list">
        {tarjetas.map((t) => (
          <TarjetaAlojamiento
            key={t.id}
            a={t}
            guardado={guardados.has(t.id)}
            haySesion={haySesion}
            volverA={enlaceSiguiente()}
          />
        ))}
      </div>

      <div className="galeria-pie" ref={centinela}>
        {error && (
          <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
            No se han podido cargar más alojamientos.{" "}
            <button className="f-limpiar" type="button" onClick={() => void cargar()}>
              Reintentar
            </button>
          </p>
        )}
        {cargando && <p className="cargando-mas">Cargando más alojamientos…</p>}
        {!cargando && !error && siguiente === null && tarjetas.length > 0 && (
          <p className="cargando-mas">Eso es todo: {total.toLocaleString("es-ES")} alojamientos.</p>
        )}
        {siguiente !== null && !cargando && (
          <p>
            <a className="f-limpiar" href={enlaceSiguiente()} onClick={(e) => { e.preventDefault(); void cargar(); }}>
              Cargar más alojamientos
            </a>
          </p>
        )}
      </div>
    </>
  );
}
