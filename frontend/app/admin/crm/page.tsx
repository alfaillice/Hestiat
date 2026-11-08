import Link from "next/link";
import { pool } from "@/lib/db";
import { obtenerLead } from "@/lib/ia-datos.server";
import { PLANTILLAS } from "@/lib/ia-plantillas.server";

export const dynamic = "force-dynamic";

/**
 * CRM de captación — SOLO ADMINISTRACIÓN (lo garantiza `app/admin/layout.tsx`).
 *
 * Listado con búsqueda, filtros y paginación, más la ficha del potencial cliente con su historial de
 * contactos y sus acciones. Todo se apoya en las funciones que ya existían (`lead`, `lead_contacto`):
 * esta pantalla no crea un sistema aparte, solo lo hace usable.
 *
 * Los envíos NO salen de aquí sin pulsar «Aprobar y enviar», y esa acción vuelve a comprobar en el
 * servidor que quien autoriza es un administrador de verdad.
 */

const ESTADOS = [
  "DETECTED", "RESEARCHED", "CONTACT_READY", "CONTACTED", "REPLIED", "INTERESTED",
  "REGISTERED", "PUBLISHED", "NOT_INTERESTED", "OPT_OUT", "INVALID",
];
const POR_PAGINA = 25;

export default async function PanelCrm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = texto(sp.q).trim();
  const estado = texto(sp.estado);
  const localidad = texto(sp.localidad).trim();
  const pagina = Math.max(1, Number(texto(sp.pagina)) || 1);
  const idDetalle = Number(texto(sp.id)) || 0;
  const aviso = texto(sp.aviso);
  const ok = texto(sp.ok) === "1";

  const condiciones: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (q) {
    condiciones.push("(empresa LIKE ? OR email LIKE ? OR web LIKE ?)");
    valores.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (estado && ESTADOS.includes(estado)) {
    condiciones.push("estado = ?");
    valores.push(estado);
  }
  if (localidad) {
    condiciones.push("localidad LIKE ?");
    valores.push(`%${localidad}%`);
  }

  const [totales] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM \`lead\` WHERE ${condiciones.join(" AND ")}`,
    valores,
  );
  const total = Number(totales[0]?.n ?? 0);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const [filas] = await pool.query<any[]>(
    `SELECT l.id, l.empresa, l.tipo_negocio, l.localidad, l.pais, l.web, l.email, l.fuente, l.estado,
            l.excluido, l.responsable, l.detectado_en,
            (SELECT MAX(c.enviado_en) FROM lead_contacto c WHERE c.lead_id = l.id AND c.enviado_en IS NOT NULL) AS ultimo_contacto,
            (SELECT COUNT(*) FROM lead_contacto c WHERE c.lead_id = l.id) AS contactos
       FROM \`lead\` l WHERE ${condiciones.join(" AND ")}
      ORDER BY l.actualizado_en DESC LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, (pagina - 1) * POR_PAGINA],
  );

  const [porEstado] = await pool.query<any[]>(
    `SELECT estado, COUNT(*) AS n FROM \`lead\` GROUP BY estado ORDER BY n DESC`,
  );
  const [pendientes] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM lead_contacto WHERE resultado IS NULL AND canal='email'`,
  );

  const detalle = idDetalle > 0 ? await obtenerLead(idDetalle) : null;

  const enlace = (p: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    if (localidad) params.set("localidad", localidad);
    for (const [k, v] of Object.entries(p)) params.set(k, String(v));
    return `/admin/crm?${params.toString()}`;
  };

  return (
    <>
      <header className="admin-cab">
        <h1>CRM de captación</h1>
        <p style={{ color: "var(--muted-fg)" }}>
          Potenciales clientes, con su procedencia, su estado y su historial. Publicar en Hestiat es
          gratis: sin cuotas de publicación y sin comisiones. Ningún correo sale sin aprobación.
        </p>
      </header>

      {aviso ? (
        <p className="aviso" style={{ marginBottom: 16, borderColor: ok ? "var(--border)" : "var(--hestiat-primary)" }}>
          {aviso}
        </p>
      ) : null}

      <section className="admin-bloque">
        <h2>Buscar y filtrar</h2>
        <form method="get" action="/admin/crm" className="ia-fila" style={{ flexWrap: "wrap" }}>
          <input type="text" name="q" defaultValue={q} placeholder="Empresa, email o web"
                 style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
          <input type="text" name="localidad" defaultValue={localidad} placeholder="Localidad"
                 style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
          <select name="estado" defaultValue={estado} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button type="submit" className="f-aplicar">Buscar</button>
          <Link className="mas" href="/admin/crm">Quitar filtros</Link>
        </form>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          {total} potenciales clientes {q || estado || localidad ? "(con los filtros aplicados)" : ""} ·
          {" "}por estado: {porEstado.length === 0 ? "sin datos todavía" : porEstado.map((e) => `${e.estado} ${e.n}`).join(" · ")}
          {" · "}correos redactados pendientes de aprobación: {Number(pendientes[0]?.n ?? 0)}
        </p>
      </section>

      <section className="admin-bloque">
        <h2>Listado</h2>
        {filas.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>
            No hay ningún potencial cliente con estos filtros. Se pueden crear a mano abajo, o dejar que
            el agente los vaya registrando cuando investigue negocios.
          </p>
        ) : (
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>#</th><th>Empresa</th><th>Tipo</th><th>Localidad</th><th>Web</th><th>Email</th>
                <th>Fuente</th><th>Estado</th><th>Detectado</th><th>Último contacto</th><th>Excluido</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((l) => (
                <tr key={l.id}>
                  <td><Link href={enlace({ id: l.id })}>{l.id}</Link></td>
                  <td><Link href={enlace({ id: l.id })}>{l.empresa ?? "—"}</Link></td>
                  <td>{l.tipo_negocio}</td>
                  <td>{l.localidad ?? "—"}{l.pais ? ` (${l.pais})` : ""}</td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{l.web ?? "—"}</td>
                  <td>{l.email ?? "—"}</td>
                  <td>{l.fuente}</td>
                  <td><b>{l.estado}</b>{Number(l.contactos) > 0 ? ` (${l.contactos})` : ""}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{String(l.detectado_en).slice(0, 10)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{l.ultimo_contacto ? String(l.ultimo_contacto).slice(0, 16) : "—"}</td>
                  <td>{Number(l.excluido) === 1 ? "sí" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {paginas > 1 ? (
          <p style={{ marginTop: 12, display: "flex", gap: 12 }}>
            {pagina > 1 ? <Link href={enlace({ pagina: pagina - 1 })}>← Anterior</Link> : null}
            <span style={{ color: "var(--muted-fg)" }}>página {pagina} de {paginas}</span>
            {pagina < paginas ? <Link href={enlace({ pagina: pagina + 1 })}>Siguiente →</Link> : null}
          </p>
        ) : null}
      </section>

      {detalle ? (
        <section className="admin-bloque">
          <h2>Ficha #{detalle.id}: {detalle.empresa ?? "(sin nombre)"}</h2>
          <ul className="ia-lista">
            <li><b>Tipo de negocio</b>: {detalle.tipo_negocio} · <b>Localidad</b>: {detalle.localidad ?? "—"} · <b>País</b>: {detalle.pais}</li>
            <li><b>Web</b>: {detalle.web ?? "—"} · <b>Email</b>: {detalle.email ?? "—"} · <b>Teléfono</b>: {detalle.telefono ?? "—"}</li>
            <li><b>Contacto</b>: {detalle.contacto_nombre ?? "—"} · <b>Responsable</b>: {detalle.responsable ?? "—"}</li>
            <li><b>Fuente</b>: {detalle.fuente} · <b>Detectado</b>: {String(detalle.detectado_en)} · <b>Actualizado</b>: {String(detalle.actualizado_en)}</li>
            <li><b>Estado</b>: {detalle.estado} · <b>Exclusión de comunicaciones</b>: {Number(detalle.excluido) === 1 ? "SÍ, no se le escribe" : "no"}</li>
            <li><b>Notas</b>: {detalle.notas ?? "—"}</li>
          </ul>

          <h3 style={{ marginTop: 14 }}>Historial de contactos ({detalle.contactos.length})</h3>
          {detalle.contactos.length === 0 ? (
            <p style={{ color: "var(--muted-fg)" }}>Todavía no se le ha escrito.</p>
          ) : (
            <table className="admin-tabla">
              <thead><tr><th>Cuándo</th><th>Canal</th><th>Asunto</th><th>Resultado</th><th>Quién</th><th>Aprobó</th></tr></thead>
              <tbody>
                {detalle.contactos.map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{String(c.enviado_en ?? c.creado_en).slice(0, 16)}</td>
                    <td>{c.canal}</td>
                    <td>{c.asunto ?? "—"}</td>
                    <td>{c.resultado ?? "pendiente de aprobación"}</td>
                    <td>{c.autor ?? "—"}</td>
                    <td>{c.aprobado_por ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="ia-fila" style={{ marginTop: 16, alignItems: "flex-start" }}>
            <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 8, minWidth: 280 }}>
              <input type="hidden" name="accion" value="crm_actualizar" />
              <input type="hidden" name="id" value={detalle.id} />
              <input type="hidden" name="volver" value={enlace({ id: detalle.id })} />
              <label>Estado
                <select name="estado" defaultValue={detalle.estado} style={{ display: "block", width: "100%" }}>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
              <label>Responsable<input type="text" name="responsable" defaultValue={detalle.responsable ?? ""} style={{ display: "block", width: "100%" }} /></label>
              <label>Notas<textarea name="notas" defaultValue={detalle.notas ?? ""} rows={3} style={{ display: "block", width: "100%" }} /></label>
              <label style={{ fontSize: 13 }}><input type="checkbox" name="excluido" value="1" defaultChecked={Number(detalle.excluido) === 1} /> No recibir comunicaciones (exclusión)</label>
              <button type="submit" className="f-aplicar">Guardar cambios</button>
            </form>

            <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 8, minWidth: 300 }}>
              <input type="hidden" name="accion" value="crm_preparar_email" />
              <input type="hidden" name="id" value={detalle.id} />
              <input type="hidden" name="volver" value={enlace({ id: detalle.id })} />
              <label>Plantilla
                <select name="plantilla" style={{ display: "block", width: "100%" }}>
                  {PLANTILLAS.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.destinatario}</option>)}
                </select>
              </label>
              <button type="submit" className="f-aplicar">Redactar correo (queda pendiente)</button>
              <p style={{ fontSize: 12.5, color: "var(--muted-fg)" }}>
                Redactar no envía nada. El correo queda pendiente y sale solo si alguien pulsa «Aprobar y enviar».
              </p>
            </form>

            <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 8, minWidth: 260 }}>
              <input type="hidden" name="accion" value="crm_baja" />
              <input type="hidden" name="id" value={detalle.id} />
              <input type="hidden" name="volver" value={enlace({ id: detalle.id })} />
              <button type="submit" className="f-aplicar">Registrar baja (no volver a escribir)</button>
              <p style={{ fontSize: 12.5, color: "var(--muted-fg)" }}>
                Añade la dirección a la lista de exclusión. A partir de ahí, ningún correo podrá salir hacia ella.
              </p>
            </form>
          </div>

          <EmailsPendientes idLead={detalle.id} />
        </section>
      ) : null}

      <section className="admin-bloque">
        <h2>Crear un potencial cliente a mano</h2>
        <form method="post" action="/api/admin/ia" className="ia-fila" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <input type="hidden" name="accion" value="crm_crear" />
          <input type="hidden" name="volver" value="/admin/crm" />
          <label>Empresa *<input type="text" name="empresa" required style={{ display: "block" }} /></label>
          <label>Tipo
            <select name="tipo_negocio" style={{ display: "block" }}>
              <option value="alojamiento">alojamiento</option>
              <option value="experiencia">experiencia</option>
              <option value="servicio">servicio</option>
              <option value="otro">otro</option>
            </select>
          </label>
          <label>Localidad<input type="text" name="localidad" style={{ display: "block" }} /></label>
          <label>Provincia<input type="text" name="provincia" style={{ display: "block" }} /></label>
          <label>Web<input type="text" name="web" style={{ display: "block" }} /></label>
          <label>Email<input type="text" name="email" style={{ display: "block" }} /></label>
          <label>Teléfono<input type="text" name="telefono" style={{ display: "block" }} /></label>
          <label>Notas<input type="text" name="notas" style={{ display: "block" }} /></label>
          <button type="submit" className="f-aplicar">Crear</button>
        </form>
        <p style={{ fontSize: 12.5, color: "var(--muted-fg)", marginTop: 8 }}>
          Solo se guarda lo que se escriba aquí: no se rellenan datos de contacto por su cuenta. Si ya
          existe un cliente con el mismo email, el mismo dominio o el mismo nombre y localidad, no se
          duplica y se avisa.
        </p>
      </section>
    </>
  );
}

/** Correos redactados de este cliente, con la aprobación a la vista. */
async function EmailsPendientes({ idLead }: { idLead: number }) {
  const [filas] = await pool.query<any[]>(
    `SELECT id, asunto, cuerpo, resultado, creado_en FROM lead_contacto
      WHERE lead_id = ? AND canal = 'email' ORDER BY id DESC LIMIT 10`,
    [idLead],
  );
  if (filas.length === 0) return null;
  return (
    <>
      <h3 style={{ marginTop: 16 }}>Correos y su estado</h3>
      <table className="admin-tabla">
        <thead><tr><th>Redactado</th><th>Asunto</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td style={{ whiteSpace: "nowrap" }}>{String(f.creado_en).slice(0, 16)}</td>
              <td>{f.asunto ?? "—"}</td>
              <td>{f.resultado ?? "pendiente de aprobación"}</td>
              <td>
                {f.resultado === null ? (
                  <span style={{ display: "flex", gap: 8 }}>
                    <form method="post" action="/api/admin/ia">
                      <input type="hidden" name="accion" value="aprobar_envio" />
                      <input type="hidden" name="contactoId" value={f.id} />
                      <input type="hidden" name="volver" value={`/admin/crm?id=${idLead}`} />
                      <button type="submit" className="f-aplicar">Aprobar y enviar</button>
                    </form>
                    <form method="post" action="/api/admin/ia">
                      <input type="hidden" name="accion" value="crm_cancelar_envio" />
                      <input type="hidden" name="contactoId" value={f.id} />
                      <input type="hidden" name="volver" value={`/admin/crm?id=${idLead}`} />
                      <button type="submit">Cancelar</button>
                    </form>
                  </span>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}