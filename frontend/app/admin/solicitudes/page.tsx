import Link from "next/link";
import { redirect } from "next/navigation";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitudes de alta — Administración",
  robots: { index: false, follow: false },
};

/**
 * COLA DE ALTAS DE PROVEEDORES.
 *
 * Aquí llegan las experiencias y servicios que envían los proveedores desde /publicar-experiencia y
 * /publicar-servicio. Nada se publica solo: el administrador revisa y decide.
 *
 *   APROBAR  → se crea la ficha en el catálogo (con su categoría) y la solicitud queda aprobada
 *   RECHAZAR → la solicitud queda rechazada, con su motivo, y no se toca el catálogo
 */
export default async function Solicitudes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?volver=/admin/solicitudes");

  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aviso = (uno(sp.aviso) ?? "").slice(0, 200);
  const ok = (uno(sp.ok) ?? "") === "1";
  const estado = ["pendiente", "aprobada", "rechazada"].includes(uno(sp.estado) ?? "") ? (uno(sp.estado) as string) : "pendiente";

  const [solicitudes] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, tipo, nombre, categoria, descripcion, municipio, provincia, direccion, web, telefono, email,
            precio, organizador, estado, motivo, item_id, creada_en, revisada_en, revisor
       FROM solicitud_catalogo WHERE estado = ? ORDER BY id DESC LIMIT 200`,
    [estado],
  );
  const [cuentas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT estado, COUNT(*) AS n FROM solicitud_catalogo GROUP BY estado`,
  );
  const resumen = cuentas.map((c) => `${c.estado}: ${Number(c.n)}`).join(" · ") || "ninguna todavía";

  return (
    <main style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Solicitudes de alta</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 14 }}>
        Experiencias y servicios enviados por proveedores. Nada se publica sin que lo apruebes: al
        aprobar se crea la ficha real en el catálogo, con su categoría.
      </p>

      {aviso ? (
        <p className="aviso" style={ok ? { borderColor: "var(--hestiat-primary)" } : { borderColor: "var(--destructive)" }}>
          {aviso}
        </p>
      ) : null}

      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 12 }}>
        Totales: {resumen}
      </p>

      <nav className="f-chips" style={{ marginBottom: 18 }}>
        {["pendiente", "aprobada", "rechazada"].map((e) => (
          <Link className="f-chip" key={e} href={`/admin/solicitudes?estado=${e}`}>
            <span>
              {e === "pendiente" ? "Pendientes" : e === "aprobada" ? "Aprobadas" : "Rechazadas"}
              {estado === e ? " ·" : ""}
            </span>
          </Link>
        ))}
      </nav>

      {solicitudes.length === 0 ? (
        <p className="aviso">No hay solicitudes en este estado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {solicitudes.map((s) => (
            <article
              key={Number(s.id)}
              style={{ border: "1px solid var(--border)", borderRadius: "var(--radio)", background: "var(--card)", padding: 16 }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontSize: 16 }}>{String(s.nombre)}</b>
                <span className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                  {String(s.tipo) === "experiencia" ? "Experiencia" : "Servicio"} #{Number(s.id)}
                  {s.categoria ? ` · categoría ${String(s.categoria)}` : ""}
                </span>
                {s.item_id ? (
                  <Link
                    className="f-limpiar"
                    href={String(s.tipo) === "experiencia" ? `/experiencias` : `/servicios`}
                    style={{ fontSize: 13 }}
                  >
                    ficha creada #{Number(s.item_id)}
                  </Link>
                ) : null}
              </div>

              <p className="m" style={{ margin: "8px 0 4px" }}>
                {[s.municipio, s.provincia].filter(Boolean).join(", ")}
                {s.direccion ? ` · ${String(s.direccion)}` : ""}
              </p>
              <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5, marginBottom: 6 }}>
                {[s.web, s.telefono, s.email].filter(Boolean).map(String).join(" · ")}
                {s.organizador ? ` · ${String(s.organizador)}` : ""}
                {s.precio !== null && s.precio !== undefined ? ` · precio ${Number(s.precio)}` : ""}
              </p>
              {s.descripcion ? (
                <p style={{ lineHeight: 1.6, marginBottom: 10 }}>{String(s.descripcion).slice(0, 600)}</p>
              ) : null}
              {s.motivo ? (
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                  Motivo: {String(s.motivo)}
                </p>
              ) : null}

              {estado === "pendiente" ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <form method="post" action="/api/admin/solicitudes">
                    <input type="hidden" name="id" value={Number(s.id)} />
                    <input type="hidden" name="accion" value="aprobar" />
                    <button className="f-aplicar" type="submit">
                      Aprobar y publicar
                    </button>
                  </form>
                  <form method="post" action="/api/admin/solicitudes" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <input type="hidden" name="id" value={Number(s.id)} />
                    <input type="hidden" name="accion" value="rechazar" />
                    <label className="f-campo" style={{ minWidth: 240 }}>
                      <span className="etq">Motivo (opcional)</span>
                      <input name="motivo" maxLength={255} placeholder="Por qué no se publica" />
                    </label>
                    <button className="f-limpiar" type="submit">
                      Rechazar
                    </button>
                  </form>
                </div>
              ) : (
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>
                  {String(s.estado)} · {String(s.revisor ?? "")} {s.revisada_en ? String(s.revisada_en).slice(0, 16) : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
