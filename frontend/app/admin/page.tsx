import Link from "next/link";
import { poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Resumen del backoffice.
 *
 * Faltaba esta página: el menú del panel enlazaba a `/admin` y devolvía 404. Un enlace muerto en
 * la navegación es exactamente lo que el proyecto prohíbe, así que aquí está la página de verdad,
 * con datos reales de la base original y no con cifras escritas a mano.
 */
const n = (v: unknown): number => Number(v ?? 0);

export default async function PanelAdmin() {
  const [[alojR], [usuR], [fotR], [resR], [canR]] = await Promise.all([
    poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS total,
              SUM(activo = 1) AS publicados,
              SUM(lat IS NULL OR lng IS NULL) AS sin_coords,
              SUM((precio_noche IS NULL OR precio_noche = 0)
                  AND (precio_orientativo IS NULL OR precio_orientativo = 0)) AS sin_precio
         FROM alojamiento`,
    ),
    poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS total,
              SUM(rol = 'admin') AS admins,
              SUM(rol = 'anfitrion') AS anfitriones
         FROM usuario`,
    ),
    poolLegacy.query<any[]>(`SELECT COUNT(*) AS total FROM alojamiento_foto`),
    poolLegacy.query<any[]>(`SELECT COUNT(*) AS total FROM reserva`),
    poolLegacy.query<any[]>(`SELECT COUNT(*) AS total, SUM(activo = 1) AS activos FROM ical_feed`),
  ]);
  // mysql2 devuelve [filas, campos]: cada consulta se queda con su primera fila agregada.
  const aloj = alojR?.[0];
  const usu = usuR?.[0];
  const fot = fotR?.[0];
  const res = resR?.[0];
  const can = canR?.[0];

  const [ultimos] = await poolLegacy.query<any[]>(
    `SELECT id, titulo, ciudad, provincia, activo, precio_noche
       FROM alojamiento ORDER BY id DESC LIMIT 8`,
  );

  const bloques: { etiqueta: string; valor: number; nota?: string; aviso?: boolean }[] = [
    { etiqueta: "Alojamientos", valor: n(aloj?.total), nota: `${n(aloj?.publicados).toLocaleString("es-ES")} publicados` },
    { etiqueta: "Usuarios", valor: n(usu?.total), nota: `${n(usu?.admins)} admin · ${n(usu?.anfitriones)} anfitriones` },
    { etiqueta: "Fotografías", valor: n(fot?.total) },
    { etiqueta: "Reservas", valor: n(res?.total) },
    { etiqueta: "Canales iCal", valor: n(can?.activos), nota: `${n(can?.total)} conectados en total` },
    { etiqueta: "Sin coordenadas", valor: n(aloj?.sin_coords), aviso: n(aloj?.sin_coords) > 0, nota: "no salen en el mapa" },
    { etiqueta: "Sin precio", valor: n(aloj?.sin_precio), aviso: n(aloj?.sin_precio) > 0 },
  ];

  return (
    <>
      <header className="admin-cab">
        <h1>Resumen</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Estado real del catálogo y de las cuentas, leído de la base de datos en vivo.
        </p>
      </header>

      <div className="auditoria" style={{ marginBottom: 22 }}>
        {bloques.map((b) => (
          <section key={b.etiqueta} className="aud-bloque">
            <div className="aud-cab">
              <h2>{b.etiqueta}</h2>
              <span className={b.aviso ? "aud-num aud-num-aviso" : "aud-num"}>{b.valor.toLocaleString("es-ES")}</span>
            </div>
            {b.nota && (
              <p className="m" style={{ color: "var(--muted-fg)" }}>
                {b.nota}
              </p>
            )}
          </section>
        ))}
      </div>

      <h2 style={{ fontSize: 19, margin: "26px 0 10px" }}>Últimas altas</h2>
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
            {ultimos.map((a) => (
              <tr key={a.id}>
                <td className="num">{a.id}</td>
                <td>{a.titulo}</td>
                <td>{[a.ciudad, a.provincia].filter(Boolean).join(", ") || "—"}</td>
                <td className="num">{a.precio_noche ? `${Number(a.precio_noche).toLocaleString("es-ES")} €` : "—"}</td>
                <td>
                  <span className={a.activo ? "punto punto-ok" : "punto punto-off"} />
                  {a.activo ? "publicado" : "despublicado"}
                </td>
                <td>
                  <Link className="enlace-accion" href={`/admin/alojamientos/${a.id}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="aviso" style={{ marginTop: 22 }}>
        Para revisar duplicados, contenido repetido y datos incompletos, la herramienta está en{" "}
        <Link href="/admin/auditoria" style={{ textDecoration: "underline" }}>
          Auditoría
        </Link>
        .
      </p>
    </>
  );
}
