"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as TeclaReact } from "react";

interface Sugerencia {
  tipo: string;
  texto: string;
  total: number;
}

const ETIQUETA: Record<string, string> = {
  ciudad: "Ciudad",
  provincia: "Provincia",
  alojamiento: "Alojamiento",
  experiencia: "Experiencia",
  servicio: "Servicio",
};

/**
 * EL BUSCADOR DE LA CABECERA. Solo esto: un destino y la lupa.
 *
 * No es un formulario de reserva y no lo va a ser: aquí no hay fechas, ni viajeros, ni ningún
 * segundo control. Es una búsqueda de descubrimiento, para toda la web.
 *
 * Cómo encuentra las cosas: escribe la persona, el formulario manda lo escrito a /descubrir, y allí
 * se mira QUÉ es eso —una ciudad, una provincia, una zona, un alojamiento, una experiencia o un
 * servicio— y se lleva a la página que corresponde. Como es un formulario normal (`method="get"`),
 * funciona igual sin JavaScript: sin scripts se envía y /descubrir decide.
 *
 * (No se usa /buscar: esa dirección es antigua y ya redirige a /search desde la configuración del
 * sitio, y debe seguir haciéndolo.)
 *
 * Las sugerencias salen del catálogo real (no hay lista escrita a mano) y solo se piden al escribir,
 * con una espera corta para no preguntar en cada tecla. Si esa llamada falla, la búsqueda sigue.
 *
 * El calendario de entrada y salida NO vive aquí: sigue donde tiene sentido —«Explorar alojamientos»
 * y la ficha de alojamiento— y no se ha tocado.
 */
export default function BuscadorCabecera() {
  const formulario = useRef<HTMLFormElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setLista([]);
      setAbierto(false);
      return;
    }
    let vivo = true;
    const temporizador = setTimeout(async () => {
      try {
        const respuesta = await fetch(`/api/sugerencias?ambito=general&q=${encodeURIComponent(q)}`);
        const datos = await respuesta.json();
        if (!vivo) return;
        setLista(Array.isArray(datos.sugerencias) ? datos.sugerencias : []);
        setResaltado(-1);
      } catch {
        // Sin sugerencias la búsqueda sigue funcionando: no se avisa de nada.
      }
    }, 220);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
    };
  }, [texto]);

  /** Envía dejando fuera lo vacío, para que la dirección quede limpia. */
  const enviar = () => {
    const f = formulario.current;
    if (!f) return;
    try {
      const escrito = String((f.elements.namedItem("q") as HTMLInputElement | null)?.value ?? "").trim();
      if (escrito) localStorage.setItem("hestiat-ultimo-destino", escrito);
    } catch {
      // Sin almacenamiento (modo privado) solo se pierde ese atajo.
    }
    for (const elemento of Array.from(f.elements) as HTMLInputElement[]) {
      if (!elemento.name || elemento.disabled) continue;
      if (String(elemento.value).trim() === "") elemento.disabled = true;
    }
    f.requestSubmit();
  };

  const elegir = (s: Sugerencia) => {
    setTexto(s.texto);
    setAbierto(false);
    setResaltado(-1);
    // SI LA SUGERENCIA TIENE DESTINO PROPIO, SE VA A ÉL. Antes se lanzaba siempre una búsqueda, así
    // que pulsar una experiencia o un servicio acababa en el buscador de alojamientos: no había
    // forma de llegar a su ficha. Una ciudad o un alojamiento siguen yendo a su búsqueda, que es lo
    // correcto para ellos.
    const destino = (s as { href?: string }).href;
    if (destino) {
      window.location.assign(destino);
      return;
    }
    setTimeout(enviar, 0);
  };

  const teclas = (e: TeclaReact<HTMLInputElement>) => {
    if (!abierto || lista.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => (i + 1) % lista.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => (i - 1 + lista.length) % lista.length);
    } else if (e.key === "Enter" && resaltado >= 0) {
      e.preventDefault();
      elegir(lista[resaltado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  return (
    <form ref={formulario} className="bcab" method="get" action="/descubrir" role="search">
      <div className="bcab-caja" ref={caja}>
        <label className="solo-lectores" htmlFor="busca-cab">
          Buscar en Hestiat: ciudad, provincia, zona, alojamiento, experiencia o servicio
        </label>
        <input
          id="busca-cab"
          name="q"
          type="search"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => lista.length > 0 && setAbierto(true)}
          onKeyDown={teclas}
          placeholder="¿Dónde quieres ir?"
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="sugerencias-cab"
          aria-autocomplete="list"
        />
        {abierto && lista.length > 0 && (
          <ul className="sugerencias" id="sugerencias-cab" role="listbox" aria-label="Sugerencias">
            {lista.map((s, i) => (
              <li key={`${s.tipo}-${s.texto}`} role="option" aria-selected={i === resaltado}>
                <button type="button" onMouseEnter={() => setResaltado(i)} onClick={() => elegir(s)}>
                  <span className="sug-tipo">{ETIQUETA[s.tipo] ?? s.tipo}</span>
                  <span className="sug-texto">{s.texto}</span>
                  <span className="sug-total">{s.total.toLocaleString("es-ES")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="bcab-btn" aria-label="Buscar">
        <span aria-hidden="true">🔍</span>
      </button>
    </form>
  );
}
