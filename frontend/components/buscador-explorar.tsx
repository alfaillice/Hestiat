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
};

/**
 * La barra de búsqueda de «Explorar alojamientos».
 *
 * Es un formulario normal y corriente (`method="get"`): sin JavaScript sigue funcionando igual,
 * porque los criterios viajan en la dirección y los filtra el servidor. Lo que añade JavaScript es
 * la comodidad: sugerencias reales del catálogo mientras se escribe y elegir un destino con el
 * teclado o con el ratón.
 *
 * Tres cosas que hace a propósito:
 *
 *  · CONSERVA LOS FILTROS. Provincia, precio, servicios, orden y la vista actual viajan como campos
 *    ocultos, así que buscar no borra lo que la persona ya había elegido. Y al revés: el formulario
 *    de filtros también lleva estos criterios, para que aplicar un filtro no pierda el destino ni
 *    las fechas.
 *
 *  · NO INVENTA NADA. Las sugerencias salen de `/api/sugerencias`, que consulta el catálogo real.
 *    Si esa llamada falla, la lista no aparece y la búsqueda sigue funcionando.
 *
 *  · NO ENSUCIA LA DIRECCIÓN. Al enviar, los campos vacíos se desactivan para que no viajen como
 *    `?desde=&hasta=`.
 */
export default function BuscadorExplorar({
  destino,
  desde,
  hasta,
  huespedes,
  conservar,
  basePath = "/search",
}: {
  /** Texto actual del destino. */
  destino: string;
  desde?: string;
  hasta?: string;
  huespedes?: number;
  /** Filtros actuales que NO deben perderse al buscar (provincia, precio, servicios, orden, vista). */
  conservar?: Record<string, string | string[] | undefined>;
  basePath?: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState(destino);
  const [lista, setLista] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);

  // Cierra la lista al pulsar fuera de la caja del destino.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Sugerencias reales, con una espera corta para no preguntar en cada tecla.
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
        const respuesta = await fetch(`/api/sugerencias?q=${encodeURIComponent(q)}`);
        const datos = await respuesta.json();
        if (!vivo) return;
        setLista(Array.isArray(datos.sugerencias) ? datos.sugerencias : []);
        setResaltado(-1);
      } catch {
        // Sin sugerencias: la búsqueda sigue funcionando igual.
      }
    }, 220);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
    };
  }, [texto]);

  /** Envía el formulario dejando fuera los campos vacíos, para que la dirección quede limpia. */
  const enviar = () => {
    const f = formulario.current;
    if (!f) return;
    for (const elemento of Array.from(f.elements) as HTMLInputElement[]) {
      if (!elemento.name || elemento.disabled) continue;
      if (String(elemento.value).trim() === "") elemento.disabled = true;
      // Un viajero es el valor por defecto de la página: no hace falta que viaje en la dirección.
      else if (elemento.name === "huespedes" && String(elemento.value) === "1") elemento.disabled = true;
    }
    f.requestSubmit();
  };

  /** Elegir una sugerencia filtra ya los alojamientos, sin obligar a pulsar Buscar. */
  const elegir = (s: Sugerencia) => {
    setTexto(s.texto);
    setAbierto(false);
    setResaltado(-1);
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

  // Filtros que viajan ocultos: todo menos los cuatro campos que se dibujan aquí.
  const conservados = Object.entries(conservar ?? {}).filter(
    ([clave, valor]) =>
      !["q", "desde", "hasta", "huespedes"].includes(clave) &&
      valor !== undefined &&
      valor !== "" &&
      !(Array.isArray(valor) && valor.length === 0),
  );

  return (
    <form ref={formulario} className="buscador" method="get" action={basePath} role="search">
      {conservados.flatMap(([clave, valor]) =>
        Array.isArray(valor)
          ? valor.map((v, i) => <input key={`${clave}-${i}`} type="hidden" name={clave} value={v} />)
          : [<input key={clave} type="hidden" name={clave} value={String(valor)} />],
      )}

      <div className="buscador-destino" ref={caja}>
        <label className="buscador-etq" htmlFor="destino">
          <span aria-hidden="true">🔎</span> ¿Dónde quieres alojarte?
        </label>
        <input
          id="destino"
          name="q"
          type="text"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            // La lista solo se abre al escribir, no al cargar la página con el campo ya relleno.
            setAbierto(true);
          }}
          onFocus={() => lista.length > 0 && setAbierto(true)}
          onKeyDown={teclas}
          placeholder="Ciudad, provincia, zona o alojamiento"
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="sugerencias-destino"
          aria-autocomplete="list"
        />
        {abierto && lista.length > 0 && (
          <ul className="sugerencias" id="sugerencias-destino" role="listbox" aria-label="Sugerencias de destino">
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

      <label className="buscador-campo">
        <span className="buscador-etq">Entrada</span>
        <input type="date" name="desde" defaultValue={desde ?? ""} />
      </label>

      <label className="buscador-campo">
        <span className="buscador-etq">Salida</span>
        <input type="date" name="hasta" defaultValue={hasta ?? ""} />
      </label>

      <label className="buscador-campo">
        <span className="buscador-etq">Viajeros</span>
        <select name="huespedes" defaultValue={String(huespedes ?? 1)}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="9">9 o más</option>
        </select>
      </label>

      {/* Mismo estilo de botón que «Aplicar filtros»: una sola forma de botón en la página. */}
      <button type="submit" className="f-aplicar buscador-boton">Buscar</button>
    </form>
  );
}
