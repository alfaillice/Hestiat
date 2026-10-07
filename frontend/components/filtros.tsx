import Link from "next/link";

/**
 * Filtros de búsqueda por provincia, precio y servicios — los que la aplicación antigua ya
 * tiene. Van en la URL, para que el resultado sea compartible y rastreable.
 */
export interface OpcionesFiltros {
  provincias: { province: string; total: number }[];
  servicios: { amenity: string; nombre: string | null; total: number }[];
  precioMax: number;
}

export default function Filtros({
  opciones,
  actuales,
  basePath,
}: {
  opciones: OpcionesFiltros;
  actuales: { q?: string; provincia?: string; precioMin?: string; precioMax?: string; servicios?: string[]; orden?: string };
  basePath: string;
}) {
  const sel = actuales.servicios ?? [];

  return (
    <form className="filtros" method="get" action={basePath}>
      <input type="hidden" name="q" value={actuales.q ?? ""} />

      <label className="f-campo">
        <span className="etq">Provincia</span>
        <select name="provincia" defaultValue={actuales.provincia ?? ""}>
          <option value="">Todas</option>
          {opciones.provincias.map((p) => (
            <option key={p.province} value={p.province}>
              {p.province} ({p.total.toLocaleString("es-ES")})
            </option>
          ))}
        </select>
      </label>

      <label className="f-campo">
        <span className="etq">Precio mínimo</span>
        <input name="precioMin" type="number" min="0" step="5" placeholder="€" defaultValue={actuales.precioMin ?? ""} />
      </label>

      <label className="f-campo">
        <span className="etq">Precio máximo</span>
        <input name="precioMax" type="number" min="0" step="5" placeholder={`${opciones.precioMax} €`} defaultValue={actuales.precioMax ?? ""} />
      </label>

      <label className="f-campo">
        <span className="etq">Ordenar</span>
        <select name="orden" defaultValue={actuales.orden ?? "recomendados"}>
          <option value="recomendados">Recomendados</option>
          <option value="precio_asc">Precio más bajo</option>
          <option value="precio_desc">Precio más alto</option>
        </select>
      </label>

      <fieldset className="f-servicios">
        <legend className="etq">Servicios</legend>
        <div className="f-chips">
          {opciones.servicios.map((s) => (
            <label key={s.amenity} className="f-chip">
              <input type="checkbox" name="servicios" value={s.amenity} defaultChecked={sel.includes(s.amenity)} />
              <span>
                {s.nombre ?? s.amenity} <em>({s.total.toLocaleString("es-ES")})</em>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="f-acciones">
        <button type="submit" className="f-aplicar">
          Aplicar filtros
        </button>
        <Link href={basePath} className="f-limpiar">
          Quitar todos
        </Link>
      </div>
    </form>
  );
}
