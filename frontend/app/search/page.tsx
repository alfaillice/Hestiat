import type { Metadata } from "next";
import Link from "next/link";
import Resultados from "@/components/resultados";
import Filtros from "@/components/filtros";
import Mapa from "@/components/mapa";
import BuscadorExplorar from "@/components/buscador-explorar";
import { opcionesDeFiltros, puntosDelMapa } from "@/lib/db";
import type { FiltrosBusqueda } from "@/lib/db";
import { sugerenciasGenerales } from "@/lib/sugerencias.server";
import SeccionHome from "@/components/seccion-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explorar alojamientos — Hestiat",
  description:
    "Explora alojamientos rurales, naturales y singulares en toda España como una galería: fotografía, ubicación y precio de un vistazo.",
  alternates: { canonical: "/search" },
};

/** convierte los parámetros de la URL en filtros tipados */
function leerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosBusqueda {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const num = (v: string | string[] | undefined) => {
    const x = Number(uno(v));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const servs = sp.servicios;
  const orden = uno(sp.orden);
  // Fechas y viajeros: se aceptan solo si tienen forma válida; si no, se ignoran en vez de filtrar
  // por un valor raro que llegue en la dirección.
  const fecha = (v: string | string[] | undefined) => {
    const x = uno(v) ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : undefined;
  };
  const desde = fecha(sp.desde);
  const hasta = fecha(sp.hasta);
  const huespedes = num(sp.huespedes);
  // «cerca=lat,lng»: lo pone el buscador cuando la persona comparte su ubicación. Solo se acepta si
  // son dos números con forma de coordenada; si no, se ignora en vez de ordenar por algo raro.
  const puntoTxt = (uno(sp.cerca) ?? "").split(",");
  const lat = Number(puntoTxt[0]);
  const lng = Number(puntoTxt[1]);
  const cerca =
    puntoTxt.length === 2 && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : undefined;
  return {
    q: (uno(sp.q) ?? "").trim(),
    provincia: uno(sp.provincia) || undefined,
    precioMin: num(sp.precioMin),
    precioMax: num(sp.precioMax),
    servicios: Array.isArray(servs) ? servs : servs ? [servs] : [],
    orden: orden === "precio_asc" || orden === "precio_desc" ? orden : "recomendados",
    desde: desde && hasta && desde < hasta ? desde : undefined,
    hasta: desde && hasta && desde < hasta ? hasta : undefined,
    // Con 1 viajero no se filtra nada: es el valor por defecto y no debe cambiar los resultados.
    huespedes: huespedes && huespedes >= 2 ? huespedes : undefined,
    cerca,
  };
}

/**
 * Explorar alojamientos: una GRAN GALERÍA de tarjetas.
 *
 * Decisión de diseño tomada y fijada: la fotografía es la protagonista, el contenido aprovecha todo
 * el ancho disponible (6–7 tarjetas por fila en pantallas grandes) y el recorrido es visual y
 * continuo mediante scroll infinito. Para eso el mapa deja de ocupar una columna fija —que era lo
 * que estrechaba el contenido y obligaba a ver los resultados como una lista— y pasa a ser una
 * vista aparte, a la que se entra y de la que se sale sin perder los filtros.
 */
export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const pagina = Math.max(1, Number(uno(sp.p) ?? 1) || 1);
  const filtros = leerFiltros(sp);
  /**
   * BLOQUE DE EXPERIENCIAS Y SERVICIOS.
   *
   * Reutiliza LA MISMA consulta que ya usa el buscador de la cabecera
   * (`sugerenciasGenerales`, la que se acaba de corregir para que cada sugerencia lleve su ficha).
   * No hay una segunda forma de buscar experiencias y servicios: si un día cambia la de la
   * cabecera, esta cambia con ella.
   *
   * Solo se calcula cuando el visitante ha escrito algo, y NO toca nada del bloque de alojamientos:
   * se añade como una sección aparte, con enlaces, sin imágenes y sin precios.
   */
  const otros = filtros.q
    ? (await sugerenciasGenerales(filtros.q, 6).catch(() => [])).filter(
        (s) => s.tipo === "experiencia" || s.tipo === "servicio",
      )
    : [];
  const verMapa = uno(sp.vista) === "mapa";

  const [opciones, puntos] = await Promise.all([
    opcionesDeFiltros(),
    verMapa ? puntosDelMapa(filtros) : Promise.resolve([]),
  ]);

  // Enlaces de vista: conservan los filtros actuales para no perder el trabajo hecho.
  const conVista = (vista: "galeria" | "mapa") => {
    const qs = new URLSearchParams();
    if (filtros.q) qs.set("q", filtros.q);
    if (filtros.provincia) qs.set("provincia", filtros.provincia);
    if (typeof filtros.precioMin === "number") qs.set("precioMin", String(filtros.precioMin));
    if (filtros.precioMax) qs.set("precioMax", String(filtros.precioMax));
    for (const s of filtros.servicios ?? []) qs.append("servicios", s);
    if (filtros.orden && filtros.orden !== "recomendados") qs.set("orden", filtros.orden);
    if (filtros.desde) qs.set("desde", filtros.desde);
    if (filtros.hasta) qs.set("hasta", filtros.hasta);
    if (filtros.huespedes) qs.set("huespedes", String(filtros.huespedes));
    if (filtros.cerca) qs.set("cerca", `${filtros.cerca.lat},${filtros.cerca.lng}`);
    if (vista === "mapa") qs.set("vista", "mapa");
    const cadena = qs.toString();
    return `/search${cadena ? `?${cadena}` : ""}`;
  };

  return (
    <main className="explorar">
      <div className="explorar-cab">
        <h1>Explorar alojamientos</h1>
        <nav className="vista" aria-label="Forma de ver los resultados">
          <Link className={verMapa ? "" : "vista-activa"} href={conVista("galeria")}>Galería</Link>
          <Link className={verMapa ? "vista-activa" : ""} href={conVista("mapa")}>Mapa</Link>
        </nav>
      </div>

      {/* La búsqueda va primero: es lo que la persona viene a hacer. Los filtros siguen debajo,
          intactos, y las dos cosas se suman en la misma dirección. */}
      <BuscadorExplorar
        destino={filtros.q ?? ""}
        desde={filtros.desde}
        hasta={filtros.hasta}
        huespedes={filtros.huespedes}
        basePath="/search"
        conservar={{
          provincia: filtros.provincia,
          precioMin: filtros.precioMin ? String(filtros.precioMin) : undefined,
          precioMax: filtros.precioMax ? String(filtros.precioMax) : undefined,
          servicios: filtros.servicios,
          orden: filtros.orden && filtros.orden !== "recomendados" ? filtros.orden : undefined,
          vista: verMapa ? "mapa" : undefined,
        }}
      />

      <Filtros
        opciones={opciones}
        actuales={{
          q: filtros.q,
          provincia: filtros.provincia,
          precioMin: filtros.precioMin ? String(filtros.precioMin) : undefined,
          precioMax: filtros.precioMax ? String(filtros.precioMax) : undefined,
          servicios: filtros.servicios,
          orden: filtros.orden,
          desde: filtros.desde,
          hasta: filtros.hasta,
          huespedes: filtros.huespedes ? String(filtros.huespedes) : undefined,
          vista: verMapa ? "mapa" : undefined,
        }}
        basePath="/search"
      />

      {verMapa ? (
        <section aria-label="Mapa de resultados">
          <Mapa puntos={puntos} alto={640} />
          <p className="m" style={{ fontSize: 13, color: "var(--muted-fg)", marginTop: 8 }}>
            {puntos.length.toLocaleString("es-ES")} alojamientos situados con sus coordenadas reales.
            Los que no tienen coordenadas no aparecen aquí: nunca se coloca un alojamiento en un punto inventado.
          </p>
        </section>
      ) : (
        <>
        {/*
          ESTILO: se usa el MISMO componente de sección que el resto de la web (`SeccionHome`), que
          ya trae el título de sección, la línea de subtítulo, el enlace «Ver todas →» y el carrusel
          con su espaciado. No se copia el estilo: se reutiliza. Así este bloque no puede
          desviarse del diseño, porque no tiene diseño propio.

          ICONOS: uno por tipo, como ya hace el sitio con las categorías. La forma es la misma para
          los dos tipos; solo cambia el dibujo.
        */}
        {otros.length > 0 ? (
          <SeccionHome
            titulo="También en experiencias y servicios"
            sub={
              otros.length === 1
                ? `1 ficha del catálogo coincide con «${filtros.q}»`
                : `${otros.length} fichas del catálogo coinciden con «${filtros.q}»`
            }
            verTodos="/experiencias"
            verTodosTexto="Ver todas"
          >
            {otros.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radio-pill)",
                  padding: "11px 18px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 17 }}>
                  {s.tipo === "experiencia" ? "🎟️" : "🛎️"}
                </span>
                {s.texto}
                <span className="m" style={{ fontWeight: 400, fontSize: 12.5 }}>
                  {s.tipo === "experiencia" ? "experiencia" : "servicio"}
                </span>
              </Link>
            ))}
          </SeccionHome>
        ) : null}

        <Resultados q={filtros.q ?? ""} pagina={pagina} basePath="/search" filtros={filtros} />
        </>
      )}
    </main>
  );
}
