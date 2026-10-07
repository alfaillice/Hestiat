import Link from "next/link";
import { poolLegacy } from "@/lib/db";
import { requireHost } from "@/lib/auth.server";
import { Aviso } from "@/components/estados";

export const dynamic = "force-dynamic";

/**
 * Mis alojamientos.
 *
 * La consulta filtra SIEMPRE por el usuario de la sesión (`alojamiento_anfitrion.usuario_id`),
 * y el usuario sale del servidor, nunca de la URL ni del navegador. Así un anfitrión no puede
 * ver lo de otro ni cambiando un identificador.
 *
 * Lee el aviso de la URL porque tras eliminar un alojamiento se vuelve aquí con el mensaje de lo
 * que acaba de pasar: quedarse en la ficha borrada daría un 404 sin explicación.
 */
export default async function HostAlojamientos({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; ok?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;
  const sp = await searchParams;

  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id, a.titulo, a.slug, a.ciudad, a.provincia, a.precio_noche, a.activo,
            (SELECT COUNT(*) FROM alojamiento_foto f WHERE f.alojamiento_id = a.id) AS fotos,
            (SELECT COUNT(*) FROM ical_feed i WHERE i.alojamiento_id = a.id AND i.activo = 1) AS canales,
            (SELECT COUNT(*) FROM reserva r WHERE r.alojamiento_id = a.id) AS reservas
       FROM alojamiento a
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = a.id
      WHERE af.usuario_id = ?
      ORDER BY a.id DESC`,
    [host.id],
  );

  return (
    <>
      <header className="admin-cab">
        <h1>Mis alojamientos</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {filas.length} {filas.length === 1 ? "alojamiento" : "alojamientos"} a tu nombre
        </p>
        <p style={{ marginTop: 12 }}>
          <Link className="f-aplicar" href="/nuevo">Añadir alojamiento</Link>
        </p>
      </header>

      <Aviso texto={sp.aviso} ok={sp.ok} />

      {filas.length === 0 ? (
        <div className="vacio">
          <p className="vacio-titulo">Todavía no tienes alojamientos</p>
          <p className="vacio-texto">
            Puedes dar de alta el primero tú mismo. Se crea como borrador y no se ve en la web hasta
            que lo publiques desde el editor, cuando esté completo.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link className="f-aplicar" href="/nuevo">Añadir alojamiento</Link>
          </p>
        </div>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>Alojamiento</th>
                <th>Ubicación</th>
                <th>Precio</th>
                <th>Fotos</th>
                <th>Canales iCal</th>
                <th>Reservas</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.id}>
                  <td className="num">{a.id}</td>
                  <td>{a.titulo}</td>
                  <td>{[a.ciudad, a.provincia].filter(Boolean).join(", ") || "—"}</td>
                  <td className="num">{a.precio_noche ? `${Number(a.precio_noche).toLocaleString("es-ES")} €` : "—"}</td>
                  <td className="num">{a.fotos}</td>
                  <td className="num">{a.canales}</td>
                  <td className="num">{a.reservas}</td>
                  <td>
                    <span className={a.activo ? "punto punto-ok" : "punto punto-off"} />
                    {a.activo ? "publicado" : "despublicado"}
                  </td>
                  <td>
                    <Link className="enlace-accion" href={`/editar/${a.id}`}>
                      Gestionar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="aviso" style={{ marginTop: 22 }}>
        La gestión de fotografías y de calendarios iCal se sirve desde la ficha de cada alojamiento,
        reutilizando el mismo componente de medios para el panel y para la administración: una sola
        implementación, como exige el proyecto.
      </p>
    </>
  );
}
