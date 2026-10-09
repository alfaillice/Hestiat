import { buscar } from "@/lib/db";
import { Vacio } from "@/components/estados";
import GaleriaAlojamientos from "@/components/galeria-alojamientos";
import { aTarjeta } from "@/lib/tarjetas";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";
import type { FiltrosBusqueda } from "@/lib/db";

/**
 * Resultados de búsqueda, compartidos por `/` y `/search`.
 *
 * Es una GRAN GALERÍA visual de tarjetas con scroll infinito, no una lista: la fotografía manda y
 * la tarjeta se entiende de un vistazo. La primera tanda se dibuja en el servidor (para que la
 * página tenga contenido sin JavaScript) y las siguientes las añade el cliente al mismo cuadrícula.
 *
 * Aviso sobre las imágenes: se dice UNA vez, sobre la galería, que las fotografías del catálogo
 * proceden de fuentes públicas. Poner la etiqueta en las 42 tarjetas sería ruido y taparía la foto,
 * que es justo lo que tiene que destacar; en la ficha sí va foto por foto, porque ahí se decide.
 */
export default async function Resultados({
  q,
  pagina,
  basePath,
  filtros,
  porPagina = 42,
}: {
  q: string;
  pagina: number;
  basePath: string;
  /** Filtros completos (provincia, precio, servicios, orden). Si no se pasan, solo texto libre. */
  filtros?: FiltrosBusqueda;
  porPagina?: number;
}) {
  const sesion = await getCurrentUser();
  const { total, items, porPagina: tanda } = await buscar({ ...(filtros ?? {}), q, pagina, porPagina });
  const tarjetas = items.map((i) => aTarjeta(i as unknown as Record<string, unknown>));
  const guardados = sesion ? await guardadosEntre(Number(sesion.id), "alojamiento", tarjetas.map((t) => t.id)) : new Set<number>();

  // Filtros en formato de consulta, sin `p`: es lo que usan el scroll infinito y el enlace de
  // respaldo. Así las tandas siguientes llevan exactamente los mismos criterios.
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filtros?.provincia) params.set("provincia", filtros.provincia);
  if (typeof filtros?.precioMin === "number") params.set("precioMin", String(filtros.precioMin));
  if (typeof filtros?.precioMax === "number") params.set("precioMax", String(filtros.precioMax));
  for (const s of filtros?.servicios ?? []) params.append("servicios", s);
  if (filtros?.orden && filtros.orden !== "recomendados") params.set("orden", filtros.orden);
  // Fechas y viajeros también viajan: sin esto, la segunda tanda del scroll infinito los perdería.
  if (filtros?.desde) params.set("desde", filtros.desde);
  if (filtros?.hasta) params.set("hasta", filtros.hasta);
  if (filtros?.huespedes) params.set("huespedes", String(filtros.huespedes));
  // El punto de «cerca de ti» viaja también: sin esto, la segunda tanda del scroll perdería el
  // orden por distancia y mezclaría resultados de cualquier sitio con los cercanos.
  if (filtros?.cerca) params.set("cerca", `${filtros.cerca.lat},${filtros.cerca.lng}`);

  if (items.length === 0) {
    // Estado vacío con salidas de verdad: quitar las fechas si las hay, o rehacer la búsqueda.
    const sinFechas = new URLSearchParams(params);
    sinFechas.delete("desde");
    sinFechas.delete("hasta");
    const salidas: { texto: string; href: string }[] = [];
    if (params.has("desde") || params.has("hasta")) {
      const cadena = sinFechas.toString();
      salidas.push({ texto: "Probar sin fechas concretas", href: `${basePath}${cadena ? `?${cadena}` : ""}` });
    }
    if (params.toString()) salidas.push({ texto: "Ver todo el catálogo", href: basePath });
    return (
      <>
        <p className="galeria-cuenta">0 alojamientos</p>
        <Vacio
          titulo="No encontramos alojamientos con esa búsqueda"
          explicacion="Prueba con otra ciudad, provincia o zona. Si has puesto fechas, puede que esos días estén ocupados; también puedes ampliar el rango de precio o quitar algún servicio."
          accion={{ texto: "Quitar todos los criterios", href: basePath }}
          enlaces={salidas}
        />
      </>
    );
  }

  return (
    <>
      <GaleriaAlojamientos
        iniciales={tarjetas}
        total={total}
        porPagina={tanda}
        consulta={params.toString()}
        haySesion={Boolean(sesion)}
        guardadosIniciales={[...guardados]}
        basePath={basePath}
      />
      <p className="aviso" style={{ marginTop: 18 }}>
        Las fotografías del catálogo proceden de fuentes públicas y se muestran como
        <strong> referencia del entorno</strong>, no siempre como imágenes propias de cada propiedad.
      </p>
    </>
  );
}
