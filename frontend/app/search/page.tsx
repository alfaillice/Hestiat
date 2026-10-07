import type { Metadata } from "next";
import Link from "next/link";
import Resultados from "@/components/resultados";
import Filtros from "@/components/filtros";
import Mapa from "@/components/mapa";
import { opcionesDeFiltros, puntosDelMapa } from "@/lib/db";
import type { FiltrosBusqueda } from "@/lib/db";

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
  return {
    q: (uno(sp.q) ?? "").trim(),
    provincia: uno(sp.provincia) || undefined,
    precioMin: num(sp.precioMin),
    precioMax: num(sp.precioMax),
    servicios: Array.isArray(servs) ? servs : servs ? [servs] : [],
    orden: orden === "precio_asc" || orden === "precio_desc" ? orden : "recomendados",
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
    if (typeof filtros.precioMax === "number") qs.set("precioMax", String(filtros.precioMax));
    for (const s of filtros.servicios ?? []) qs.append("servicios", s);
    if (filtros.orden && filtros.orden !== "recomendados") qs.set("orden", filtros.orden);
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

      <Filtros
        opciones={opciones}
        actuales={{
          q: filtros.q,
          provincia: filtros.provincia,
          precioMin: filtros.precioMin ? String(filtros.precioMin) : undefined,
          precioMax: filtros.precioMax ? String(filtros.precioMax) : undefined,
          servicios: filtros.servicios,
          orden: filtros.orden,
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
        <Resultados q={filtros.q ?? ""} pagina={pagina} basePath="/search" filtros={filtros} />
      )}
    </main>
  );
}
