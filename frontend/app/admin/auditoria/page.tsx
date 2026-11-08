import Link from "next/link";
import { auditoria } from "@/lib/duplicados.server";

export const dynamic = "force-dynamic";

/**
 * Auditoría automática (punto 36 de la especificación).
 *
 * SOLO LECTURA. Cuenta y muestra lo que hay hoy en la base original. No corrige nada por su
 * cuenta: una herramienta que borra «duplicados» sola es exactamente lo que el mandato prohíbe.
 *
 * Cuando un bloque tiene `total = -1` es porque la consulta ha fallado: se muestra el error en vez
 * de un cero, para que un fallo no parezca una base limpia.
 */
export default async function PanelAuditoria() {
  const bloques = await auditoria();
  const problemas = bloques.filter((b) => b.total > 0 && b.clave !== "sin_anfitrion");
  const graves = bloques.filter((b) => ["slugs_duplicados", "fotos_huerfanas", "mismas_coordenadas"].includes(b.clave) && b.total > 0);

  return (
    <>
      <header className="admin-cab">
        <h1>Auditoría automática</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Detección de duplicados, contenido repetido, residuos y datos incompletos. Consulta de solo
          lectura sobre la base original: esta pantalla no modifica nada.
        </p>
      </header>

      <p className="aviso" style={{ marginBottom: 18 }}>
        {graves.length === 0
          ? "No se han detectado duplicados graves (slugs repetidos, fotos huérfanas ni alojamientos superpuestos)."
          : `Atención: ${graves.length} ${graves.length === 1 ? "bloque requiere" : "bloques requieren"} revisión antes de publicar más contenido.`}
      </p>

      <div className="auditoria">
        {bloques.map((b) => (
          <section key={b.clave} className="aud-bloque">
            <header className="aud-cab">
              <h2>{b.titulo}</h2>
              <span className={b.total > 0 ? "aud-num aud-num-aviso" : "aud-num"}>
                {b.total < 0 ? "error" : b.total.toLocaleString("es-ES")}
              </span>
            </header>
            <p className="m" style={{ color: "var(--muted-fg)" }}>{b.descripcion}</p>

            {b.muestra.length > 0 && (
              <div className="tabla-scroll" style={{ marginTop: 10 }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      {Object.keys(b.muestra[0]).map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.muestra.slice(0, 12).map((fila, i) => (
                      <tr key={i}>
                        {Object.values(fila).map((v, j) => (
                          <td key={j} className={typeof v === "number" || /^\d+$/.test(String(v)) ? "num" : undefined}>
                            {String(v ?? "—").slice(0, 90)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="aviso" style={{ marginTop: 22 }}>
        Resumen práctico: {problemas.length} bloques con incidencias. Los alojamientos sin anfitrión y sin
        foto son los que más afectan al producto, y son consecuencias del volcado inicial, no fallos de
        funcionamiento. Ninguna corrección se aplica desde aquí: se decide después de ver los números.
      </p>

      <p style={{ marginTop: 16 }}>
        <Link className="f-limpiar" href="/admin/alojamientos">
          ← Volver a alojamientos
        </Link>
      </p>
    </>
  );
}
