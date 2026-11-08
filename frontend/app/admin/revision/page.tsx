import Link from "next/link";
import { redirect } from "next/navigation";
import * as mysql from "mysql2/promise";
import { requireAdmin } from "@/lib/auth.server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Propuestas de enriquecimiento — Administración",
  robots: { index: false, follow: false },
};

/**
 * REVISIÓN DE PROPUESTAS DE ENRIQUECIMIENTO.
 *
 * Aquí llegan las coincidencias DUDOSAS: las de confianza LOW y AMBIGUOUS. No se publican solas
 * (la capa pública ignora la confianza baja), así que esta pantalla es donde se decide:
 *
 *   APROBAR          el dato pasa a confianza media y se publica
 *   RECHAZAR         se queda fuera de la web, sin borrar nada
 *   CORREGIR         se escribe el valor correcto a mano y se publica ese
 *   VOLVER A BUSCAR  la ficha vuelve a pendiente y el próximo lote la reintenta
 *
 * Cada tarjeta dice de dónde salió la propuesta (fuente, nivel, confianza) para poder decidir con
 * la información delante, no a ciegas.
 */
const ETIQUETA_CONFIANZA: Record<string, string> = {
  AMBIGUOUS: "Ambigua",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

function clase(confianza: string | null): string {
  if (confianza === "AMBIGUOUS") return "aviso";
  return "aviso";
}

export default async function Revision({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?volver=/admin/revision");

  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ok = (uno(sp.ok) ?? "") === "1";
  const aviso = (uno(sp.aviso) ?? "").slice(0, 200);
  const verTodas = (uno(sp.todas) ?? "") === "1";
  const estadoFiltro = ["pendiente", "aprobado", "rechazado", "corregido", "volver_a_buscar"].includes(uno(sp.estado) ?? "")
    ? (uno(sp.estado) as string)
    : "pendiente";

  const [propuestas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, catalog_type, item_id, problema, detalle, confianza, propuesta, estado, creado_en, revisor, decidido_en
       FROM catalogo_revision
      WHERE estado = ? ${verTodas ? "" : "AND confianza IN ('LOW','AMBIGUOUS')"}
      ORDER BY FIELD(confianza, 'AMBIGUOUS', 'LOW', 'MEDIUM', 'HIGH') DESC, id DESC
      LIMIT 200`,
    [estadoFiltro],
  );

  const idsExp = propuestas.filter((p) => p.catalog_type === "experience").map((p) => Number(p.item_id));
  const idsServ = propuestas.filter((p) => p.catalog_type === "service").map((p) => Number(p.item_id));
  const nombres = new Map<string, { nombre: string; url: string }>();
  if (idsExp.length > 0) {
    const [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, name, slug FROM experiencia WHERE id IN (${idsExp.map(() => "?").join(",")})`,
      idsExp,
    );
    for (const f of filas) nombres.set(`experience-${Number(f.id)}`, { nombre: String(f.name ?? ""), url: `/experiencias/${encodeURIComponent(String(f.slug ?? ""))}` });
  }
  if (idsServ.length > 0) {
    const [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, name, slug FROM servicio_turistico WHERE id IN (${idsServ.map(() => "?").join(",")})`,
      idsServ,
    );
    for (const f of filas) nombres.set(`service-${Number(f.id)}`, { nombre: String(f.name ?? ""), url: `/servicios/${encodeURIComponent(String(f.slug ?? ""))}` });
  }

  const [cuentas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT estado, confianza, COUNT(*) AS n FROM catalogo_revision GROUP BY estado, confianza`,
  );
  const resumen = cuentas
    .filter((c) => c.estado === "pendiente")
    .map((c) => `${ETIQUETA_CONFIANZA[String(c.confianza ?? "")] ?? c.confianza ?? "sin confianza"}: ${Number(c.n)}`)
    .join(" · ");

  return (
    <main style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Propuestas de enriquecimiento</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 14 }}>
        Coincidencias que no se publican solas porque su confianza es baja o ambigua. Aquí se aprueban,
        se rechazan, se corrigen o se devuelven a buscar. Se escribe solo en las tablas de enriquecimiento:
        el catálogo original no se toca.
      </p>

      {aviso ? (
        <p className="aviso" style={ok ? { borderColor: "var(--hestiat-primary)" } : undefined}>
          {aviso}
        </p>
      ) : null}

      <p className="m" style={{ marginBottom: 12, color: "var(--muted-fg)" }}>
        Pendientes: {resumen || "ninguna"}
      </p>

      <nav className="f-chips" style={{ marginBottom: 18 }}>
        {[
          ["pendiente", "Pendientes"],
          ["aprobado", "Aprobadas"],
          ["rechazado", "Rechazadas"],
          ["corregido", "Corregidas"],
          ["volver_a_buscar", "Devueltas a buscar"],
        ].map(([clave, texto]) => (
          <Link className="f-chip" key={clave} href={`/admin/revision?estado=${clave}${verTodas ? "&todas=1" : ""}`}>
            <span>
              {texto}
              {estadoFiltro === clave ? " ·" : ""}
            </span>
          </Link>
        ))}
        <Link className="f-chip" href={`/admin/revision?estado=${estadoFiltro}${verTodas ? "" : "&todas=1"}`}>
          <span>{verTodas ? "Solo dudosas (LOW/AMBIGUOUS)" : "Ver todas las confianzas"}</span>
        </Link>
      </nav>

      {propuestas.length === 0 ? (
        <p className="aviso">No hay propuestas en este estado con estos criterios.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {propuestas.map((p) => {
            const tipo = String(p.catalog_type);
            const item = Number(p.item_id);
            const ficha = nombres.get(`${tipo}-${item}`);
            let propuesta: Record<string, unknown> = {};
            try {
              propuesta = JSON.parse(String(p.propuesta ?? "{}"));
            } catch {
              propuesta = {};
            }
            const campos = Object.entries(propuesta).filter(([k]) => k !== "url");
            return (
              <article key={Number(p.id)} style={{ border: "1px solid var(--border)", borderRadius: "var(--radio)", background: "var(--card)", padding: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <b style={{ fontSize: 16 }}>{ficha?.nombre || `${tipo} ${item}`}</b>
                  <span className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                    {tipo === "experience" ? "Experiencia" : tipo === "service" ? "Servicio" : "Alojamiento"} #{item}
                  </span>
                  <span
                    className={clase(String(p.confianza))}
                    style={{ fontSize: 12, padding: "2px 10px", border: "1px solid var(--border)", borderRadius: "var(--radio-pill)" }}
                  >
                    confianza: {ETIQUETA_CONFIANZA[String(p.confianza ?? "")] ?? p.confianza ?? "sin indicar"}
                  </span>
                  {ficha?.url ? (
                    <Link href={ficha.url} className="f-limpiar" style={{ fontSize: 13 }}>
                      ver la ficha pública
                    </Link>
                  ) : null}
                </div>

                <p style={{ margin: "8px 0 4px" }}>
                  <b>{String(p.problema ?? "")}</b>
                </p>
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5, marginBottom: 8 }}>
                  {String(p.detalle ?? "")}
                </p>

                {campos.length > 0 ? (
                  <ul className="m" style={{ fontSize: 13, marginBottom: 10, color: "var(--ink)" }}>
                    {campos.map(([k, v]) => (
                      <li key={k}>
                        {k}: <b>{typeof v === "string" ? v.slice(0, 160) : String(v).slice(0, 160)}</b>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <form method="post" action="/api/revision">
                    <input type="hidden" name="tipo" value={tipo} />
                    <input type="hidden" name="item" value={item} />
                    <input type="hidden" name="problema" value={String(p.problema ?? "")} />
                    <input type="hidden" name="accion" value="aprobar" />
                    <button className="f-aplicar" type="submit">
                      Aprobar
                    </button>
                  </form>
                  <form method="post" action="/api/revision">
                    <input type="hidden" name="tipo" value={tipo} />
                    <input type="hidden" name="item" value={item} />
                    <input type="hidden" name="problema" value={String(p.problema ?? "")} />
                    <input type="hidden" name="accion" value="rechazar" />
                    <button className="f-limpiar" type="submit">
                      Rechazar
                    </button>
                  </form>
                  <form method="post" action="/api/revision">
                    <input type="hidden" name="tipo" value={tipo} />
                    <input type="hidden" name="item" value={item} />
                    <input type="hidden" name="problema" value={String(p.problema ?? "")} />
                    <input type="hidden" name="accion" value="volver_a_buscar" />
                    <button className="f-limpiar" type="submit">
                      Volver a buscar
                    </button>
                  </form>
                  <form method="post" action="/api/revision" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <input type="hidden" name="tipo" value={tipo} />
                    <input type="hidden" name="item" value={item} />
                    <input type="hidden" name="problema" value={String(p.problema ?? "")} />
                    <input type="hidden" name="accion" value="corregir" />
                    <label className="f-campo" style={{ minWidth: 240 }}>
                      <span className="etq">Valor corregido</span>
                      <input name="valor" defaultValue={typeof propuesta.valor === "string" ? (propuesta.valor as string) : ""} placeholder="Escribe el valor correcto" />
                    </label>
                    <button className="f-aplicar" type="submit">
                      Corregir
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
