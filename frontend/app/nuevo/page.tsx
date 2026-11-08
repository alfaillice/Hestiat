import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth.server";
import { poolLegacy } from "@/lib/db";
import { buscarSimilares } from "@/lib/duplicados.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Añadir alojamiento — Hestiat", robots: { index: false } };

/**
 * Añadir alojamiento: UN solo alta, para anfitriones y administradores.
 *
 * El anfitrión crea a su nombre (el vínculo se fuerza en el servidor). El administrador ve además el
 * campo de anfitrión, porque sí puede asignar otro propietario. Antes esto solo existía dentro de la
 * administración, así que un anfitrión no tenía forma de dar de alta nada: de ahí que faltara el
 * botón en su panel.
 *
 * La comprobación de duplicados es la que ya existía, y no crea nada hasta que se confirma que son
 * alojamientos distintos.
 */
export default async function NuevoAlojamiento({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; dup?: string; t?: string; c?: string }>;
}) {
  const sesion = await getCurrentUser();
  if (!sesion) redirect("/login?volver=%2Fnuevo");

  const esAdmin = sesion.rol === "admin";
  if (!esAdmin && sesion.rol !== "anfitrion") redirect("/anfitrion");

  const sp = await searchParams;

  const ids = (sp.dup ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 12);
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
    <main className="wrap" style={{ paddingTop: 34 }}>
      <header className="admin-cab">
        <h1>Añadir alojamiento</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {esAdmin
            ? "Alta desde la administración: puedes asignar el anfitrión por su correo."
            : "Se creará a tu nombre. Después completas la ficha y lo publicas cuando esté listo."}
        </p>
      </header>

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

      {candidatos.length > 0 && (
        <section className="aviso dup" style={{ marginBottom: 18 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>Posible alojamiento duplicado</strong>
          <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 10 }}>
            Antes de crear nada: ya existe {candidatos.length === 1 ? "una publicación" : `${candidatos.length} publicaciones`}{" "}
            que coincide con lo que has introducido. Revisa si es el mismo.
          </p>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>ID</th><th>Título</th><th>Ubicación</th><th>Precio</th><th>Estado</th><th /></tr>
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
                      <Link className="enlace-accion" href={`/editar/${c.id}`}>Ver el existente</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m" style={{ color: "var(--muted-fg)", marginTop: 10 }}>
            Si de verdad son distintos, confirma abajo y continúa. Si es el mismo, edita el existente
            en lugar de crear otro.
          </p>
        </section>
      )}

      <form action="/api/alojamientos" method="post" className="form-edicion">
        {sp.dup && <input type="hidden" name="confirmado" value="1" />}

        <label className="f-campo">
          <span className="etq">Título</span>
          <input name="titulo" maxLength={255} required defaultValue={sp.t ?? ""} placeholder="Casa con vistas al mar" />
        </label>

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
          Podrás situarlo con el buscador de direcciones dentro del editor.
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

        {esAdmin ? (
          <label className="f-campo">
            <span className="etq">Anfitrión (correo) — solo administración</span>
            <input name="anfitrion" type="email" placeholder="anfitrion@ejemplo.com" />
          </label>
        ) : (
          <p className="m" style={{ color: "var(--muted-fg)" }}>
            El alojamiento quedará vinculado a tu cuenta ({sesion.email}).
          </p>
        )}

        <input type="hidden" name="activo" value="0" />
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Nace como <strong>borrador</strong>: no se ve en la web hasta que lo publiques desde la
          pestaña Publicación del editor.
        </p>

        <div className="f-acciones">
          <button className="f-aplicar" type="submit">Crear alojamiento</button>
          <Link className="f-limpiar" href={esAdmin ? "/admin/alojamientos" : "/host"}>Volver al listado</Link>
        </div>
      </form>
    </main>
  );
}
