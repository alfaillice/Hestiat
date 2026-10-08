"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaCatalogo, { type ItemCatalogo } from "@/components/tarjeta-catalogo";

/**
 * Lista del catálogo con scroll infinito por CURSOR.
 *
 * Por qué cursor y no número de página: al pedir «lo siguiente» se manda el identificador de la
 * última ficha ya mostrada, y la consulta pide las siguientes a esa. Así no hay saltos, no se repite
 * ninguna ficha aunque el catálogo cambie mientras se navega, y no hay que cargar miles de registros
 * de golpe: se piden tandas de 24 y solo cuando el final se acerca a la pantalla.
 *
 * Sin JavaScript sigue funcionando: el centinela es un enlace real a la dirección siguiente, y el
 * servidor sabe leer ese cursor (`?desde=`), así que también sin scripts se puede seguir navegando.
 */
export default function ListaCatalogo({
  iniciales,
  total,
  consulta,
  cursor,
  basePath,
  tipo,
  etiqueta,
  limite,
}: {
  iniciales: ItemCatalogo[];
  total: number;
  /** Filtros actuales en formato de consulta, SIN el cursor. */
  consulta: string;
  /** Identificador de la última ficha mostrada por el servidor; null si no hay más. */
  cursor: number | null;
  basePath: string;
  tipo: "experience" | "service";
  /** «experiencias» o «servicios», para los textos. */
  etiqueta: string;
  limite: number;
}) {
  const [items, setItems] = useState<ItemCatalogo[]>(iniciales);
  const [cursorActual, setCursorActual] = useState<number | null>(cursor);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const centinela = useRef<HTMLDivElement | null>(null);
  const enCurso = useRef(false);

  const cargar = useCallback(async () => {
    if (enCurso.current || cursorActual === null) return;
    enCurso.current = true;
    setCargando(true);
    setError(false);
    try {
      const qs = new URLSearchParams(consulta);
      qs.set("tipo", tipo);
      qs.set("tras", String(cursorActual));
      qs.set("limite", String(limite));
      const r = await fetch(`/api/catalogo/lista?${qs.toString()}`, { headers: { accept: "application/json" } });
      const datos = await r.json();
      if (!r.ok || !datos?.ok) throw new Error("respuesta no válida");
      setItems((previas) => {
        // Cinturón y tirantes: aunque el servidor ya no repite, aquí tampoco entra dos veces una ficha.
        const vistas = new Set(previas.map((i) => i.id));
        const nuevas = (datos.items as ItemCatalogo[]).filter((i) => !vistas.has(i.id));
        return [...previas, ...nuevas];
      });
      setCursorActual(datos.siguiente === null ? null : Number(datos.siguiente));
    } catch {
      setError(true);
    } finally {
      setCargando(false);
      enCurso.current = false;
    }
  }, [consulta, cursorActual, tipo, limite]);

  // Se pide la tanda cuando el final entra en pantalla, con margen para que no se note el salto.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || cursorActual === null) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void cargar();
      },
      { rootMargin: "700px 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [cargar, cursorActual]);

  const urlSiguiente = () => {
    const qs = new URLSearchParams(consulta);
    if (cursorActual !== null) qs.set("desde", String(cursorActual));
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <p className="galeria-cuenta" aria-live="polite">
        {total.toLocaleString("es-ES")} {etiqueta} · mostrando {items.length.toLocaleString("es-ES")}
      </p>

      <div className="serv-grid">
        {items.map((i) => (
          <TarjetaCatalogo key={i.id} item={i} />
        ))}
      </div>

      <div className="galeria-pie" ref={centinela}>
        {error && (
          <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
            No se han podido cargar más {etiqueta}.{" "}
            <button className="f-limpiar" type="button" onClick={() => void cargar()}>
              Reintentar
            </button>
          </p>
        )}
        {cargando && <p className="cargando-mas">Cargando más {etiqueta}…</p>}
        {!cargando && !error && cursorActual === null && (
          <p className="cargando-mas">Eso es todo: {total.toLocaleString("es-ES")} {etiqueta}.</p>
        )}
        {cursorActual !== null && !cargando && (
          <p style={{ textAlign: "center" }}>
            <a
              className="f-limpiar"
              href={urlSiguiente()}
              onClick={(e) => {
                e.preventDefault();
                void cargar();
              }}
            >
              Cargar más {etiqueta}
            </a>
          </p>
        )}
      </div>
    </>
  );
}
