import Link from "next/link";
import { poolLegacy } from "@/lib/db";
import { asegurarEsquemaReclama } from "@/lib/reclama.server";

export const dynamic = "force-dynamic";

/**
 * Reclamar un alojamiento (plan A).
 *
 * Paso 1: buscar el alojamiento entre los que están SIN propietario.
 * Paso 2: rellenar los datos y enviar la solicitud, que queda PENDIENTE.
 *
 * Nada se asigna automáticamente: la titularidad la concede administración tras revisar. Y solo se
 * pueden reclamar alojamientos que no tengan ya propietario.
 */
export default async function Reclamar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string; enviado?: string; error?: string }>;
}) {
  await asegurarEsquemaReclama();
  const sp = await searchParams;

  if (sp.enviado) {
    return (
      <main className="wrap" style={{ maxWidth: 620, paddingTop: 44 }}>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>Solicitud enviada</h1>
        <p className="aviso">
          Hemos recibido tu reclamación y queda <strong>pendiente de revisión</strong>. Te avisaremos al
          correo que nos has dado. Mientras tanto, el alojamiento sigue como está: no cambiamos la
          titularidad sin comprobarla.
        </p>
        <p style={{ marginTop: 18 }}>
          <Link className="f-limpiar" href="/reclamar">
            Hacer otra reclamación
          </Link>
        </p>
      </main>
    );
  }

  const seleccionado = Number(sp.id ?? 0);
  let alojamiento: any = null;
  if (Number.isFinite(seleccionado) && seleccionado > 0) {
    const [f] = await poolLegacy.query<any[]>(
      `SELECT a.id, a.titulo, a.ciudad, a.provincia,
              (SELECT COUNT(*) FROM alojamiento_anfitrion af WHERE af.alojamiento_id = a.id) AS propietarios
         FROM alojamiento a WHERE a.id = ? LIMIT 1`,
      [seleccionado],
    );
    alojamiento = f[0] ?? null;
  }

  const q = (sp.q ?? "").trim();
  let resultados: any[] = [];
  if (!alojamiento && q.length >= 3) {
    const [f] = await poolLegacy.query<any[]>(
      `SELECT a.id, a.titulo, a.ciudad, a.provincia
         FROM alojamiento a
        WHERE NOT EXISTS (SELECT 1 FROM alojamiento_anfitrion af WHERE af.alojamiento_id = a.id)
          AND (a.titulo LIKE ? OR a.ciudad LIKE ? OR a.provincia LIKE ?)
        ORDER BY a.id LIMIT 25`,
      [`%${q}%`, `%${q}%`, `%${q}%`],
    );
    resultados = f;
  }

  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 36 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Reclama tu alojamiento</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 20 }}>
        Si uno de estos alojamientos es tuyo, dínoslo. Un administrador comprobará la solicitud y lo
        vinculará a tu cuenta. No se asigna nada de forma automática.
      </p>

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

      {alojamiento ? (
        <section className="form-edicion">
          <h2 style={{ fontSize: 18 }}>
            #{alojamiento.id} · {alojamiento.titulo}
          </h2>
          <p className="m" style={{ color: "var(--muted-fg)" }}>
            {[alojamiento.ciudad, alojamiento.provincia].filter(Boolean).join(", ") || "sin ubicación"}
          </p>

          {Number(alojamiento.propietarios) > 0 ? (
            <p className="aviso">Este alojamiento ya tiene propietario asignado, así que no se puede reclamar.</p>
          ) : (
            <form action="/api/reclamar" method="post">
              <input type="hidden" name="alojamientoId" value={alojamiento.id} />
              <label className="f-campo">
                <span className="etq">Tu nombre</span>
                <input name="nombre" maxLength={160} required />
              </label>
              <label className="f-campo">
                <span className="etq">Tu correo</span>
                <input name="email" type="email" required placeholder="Debe coincidir con el de tu cuenta" />
              </label>
              <label className="f-campo">
                <span className="etq">Teléfono (opcional)</span>
                <input name="telefono" maxLength={40} />
              </label>
              <label className="f-campo">
                <span className="etq">Cuéntanos por qué es tuyo</span>
                <textarea name="mensaje" rows={4} maxLength={4000} />
              </label>
              <p className="m" style={{ color: "var(--muted-fg)" }}>
                El correo tiene que ser el de tu cuenta de Hestiat: es lo que nos permite vincularte el
                alojamiento al aprobarlo.
              </p>
              <div className="f-acciones">
                <button className="f-aplicar" type="submit">
                  Enviar solicitud
                </button>
                <Link className="f-limpiar" href="/reclamar">
                  Buscar otro
                </Link>
              </div>
            </form>
          )}
        </section>
      ) : (
        <>
          <form method="get" className="admin-buscar">
            <input name="q" defaultValue={q} placeholder="Nombre del alojamiento, ciudad o provincia" />
            <button type="submit" className="f-aplicar">
              Buscar
            </button>
          </form>

          {q.length > 0 && q.length < 3 && <p className="aviso">Escribe al menos 3 caracteres.</p>}

          {resultados.length > 0 && (
            <div className="tabla-scroll" style={{ marginTop: 14 }}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Alojamiento</th>
                    <th>Ubicación</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((a) => (
                    <tr key={a.id}>
                      <td className="num">{a.id}</td>
                      <td>{a.titulo}</td>
                      <td>{[a.ciudad, a.provincia].filter(Boolean).join(", ") || "—"}</td>
                      <td>
                        <Link className="enlace-accion" href={`/reclamar?id=${a.id}`}>
                          Es mío
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {q.length >= 3 && resultados.length === 0 && (
            <p className="aviso">
              No hay alojamientos sin propietario que coincidan con «{q}». Si el tuyo ya aparece asignado,
              escríbenos y lo revisamos.
            </p>
          )}
        </>
      )}
    </main>
  );
}
