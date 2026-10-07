import Link from "next/link";
import { poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Alta de alojamiento desde la administración.
 *
 * Escribe en la base ORIGINAL (los datos vivos). La acción revalida el rol en servidor: una
 * server action es un endpoint público y no se fía de que la página se haya renderizado. Se usa
 * la misma comprobación que en la edición.
 *
 * La lista de columnas es blanca y explícita: no se acepta del formulario ninguna columna que no
 * esté aquí, para que un campo añadido en el navegador no pueda escribir donde no debe.
 */
function aSlug(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  const sufijo = Math.random().toString(36).slice(2, 7);
  return `${base || "alojamiento"}-${sufijo}`;
}

export default async function AltaAlojamiento({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; dup?: string; t?: string; c?: string }>;
}) {
  const sp = await searchParams;
  const errores: Record<string, string> = {
    Titulo: "El título es obligatorio.",
    Coordenadas: "Las coordenadas no son válidas: la latitud va de -90 a 90 y la longitud de -180 a 180.",
  };

  // Candidatos a duplicado que ha detectado el servidor antes de crear nada.
  const ids = (sp.dup ?? "")
    .split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 12);
  let candidatos: any[] = [];
  if (ids.length > 0) {
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT id, titulo, slug, ciudad, provincia, precio_noche, activo FROM alojamiento
        WHERE id IN (${ids.map(() => "?").join(",")}) LIMIT 12`,
      ids,
    );
    candidatos = filas;
  }

  const [provincias] = await poolLegacy.query<any[]>(
    `SELECT provincia, COUNT(*) AS n FROM alojamiento
      WHERE provincia IS NOT NULL AND provincia <> '' GROUP BY provincia ORDER BY n DESC LIMIT 60`,
  );

  return (
    <>
      <header className="admin-cab">
        <h1>Nuevo alojamiento</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Alta manual. Se guarda en la base original y queda publicado o despublicado según el estado.
        </p>
      </header>

      {sp.error && errores[sp.error] && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {errores[sp.error]}
        </p>
      )}

      {candidatos.length > 0 && (
        <section className="aviso dup" style={{ marginBottom: 18 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Posible alojamiento duplicado
          </strong>
          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 10 }}>
            Antes de crear nada: ya existe {candidatos.length === 1 ? "una publicación" : `${candidatos.length} publicaciones`}{" "}
            que coincide con lo que has introducido. Revisa si es el mismo alojamiento.
          </p>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Ubicación</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{c.id}</td>
                    <td>{c.titulo}</td>
                    <td>{[c.ciudad, c.provincia].filter(Boolean).join(", ") || "—"}</td>
                    <td className="num">{c.precio_noche ? `${Number(c.precio_noche).toLocaleString("es-ES")} €` : "—"}</td>
                    <td>{Number(c.activo) === 1 ? "publicado" : "despublicado"}</td>
                    <td>
                      <Link className="enlace-accion" href={`/admin/alojamientos/${c.id}`}>
                        Editar el existente
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m" style={{ color: "var(--muted-fg)", marginTop: 10 }}>
            Si de verdad son alojamientos distintos, confirma abajo y continúa. Si es el mismo, edita el
            existente y no crees otro. Fusionar no se hace automáticamente: requiere revisar cuál de las
            dos fichas conserva las fotos y las reservas.
          </p>
        </section>
      )}

      <form action="/api/admin/alojamientos" method="post" className="form-edicion">
        {sp.dup && <input type="hidden" name="confirmado" value="1" />}
        <label className="f-campo">
          <span className="etq">Título</span>
          <input name="titulo" maxLength={255} required defaultValue={sp.t ?? ""} placeholder="Casa con vistas al mar" />
        </label>
        {candidatos.length > 0 && (
          <p className="m" style={{ color: "var(--accent-foreground)", marginTop: -6 }}>
            Estás confirmando que el alojamiento que vas a crear es distinto de los de arriba. Si no lo
            es, cancela y edita el existente.
          </p>
        )}

        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Ciudad</span>
            <input name="ciudad" maxLength={120} defaultValue={sp.c ?? ""} />
          </label>
          <label className="f-campo">
            <span className="etq">Provincia</span>
            <input name="provincia" maxLength={120} list="provincias" />
            <datalist id="provincias">
              {provincias.map((p) => (
                <option key={p.provincia} value={p.provincia}>
                  {Number(p.n).toLocaleString("es-ES")} alojamientos
                </option>
              ))}
            </datalist>
          </label>
        </div>

        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Latitud</span>
            <input name="lat" inputMode="decimal" placeholder="43.0125" />
          </label>
          <label className="f-campo">
            <span className="etq">Longitud</span>
            <input name="lng" inputMode="decimal" placeholder="-7.5558" />
          </label>
        </div>
        <p className="m" style={{ color: "var(--muted-fg)", marginTop: -6 }}>
          Sin coordenadas el alojamiento no aparece en el mapa; no se le asigna ninguna por defecto.
        </p>

        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Precio por noche (€)</span>
            <input name="precio_noche" type="number" min="0" step="1" />
          </label>
          <label className="f-campo">
            <span className="etq">Precio orientativo (€)</span>
            <input name="precio_orientativo" type="number" min="0" step="1" />
          </label>
        </div>

        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Anfitrión (correo)</span>
            <input name="anfitrion" type="email" placeholder="anfitrion@ejemplo.com" />
          </label>
          <label className="f-campo">
            <span className="etq">Estado</span>
            <select name="activo" defaultValue="0">
              <option value="0">Despublicado</option>
              <option value="1">Publicado</option>
            </select>
          </label>
        </div>

        <div className="f-acciones">
          <button className="f-aplicar" type="submit">
            Crear alojamiento
          </button>
          <Link className="f-limpiar" href="/admin/alojamientos">
            Volver al listado
          </Link>
        </div>
      </form>

      <p className="aviso" style={{ marginTop: 20 }}>
        Las fotografías se suben después, desde la ficha del alojamiento: al crearlo aparece el enlace
        de gestión. El alta nace despublicada por defecto, para revisarla antes de que se vea.
      </p>
    </>
  );
}
