import Link from "next/link";
import { pool } from "@/lib/db";
import { obtenerTicket } from "@/lib/ia-datos.server";

export const dynamic = "force-dynamic";

/**
 * Atención al cliente — SOLO ADMINISTRACIÓN.
 *
 * Crear consultas, clasificarlas, darles prioridad, registrar la conversación, consultar el historial
 * y marcarlas como resueltas. Con el mismo motor que ya usa el agente (`create_support_ticket`,
 * `get_support_ticket`, `update_support_ticket`): aquí solo se le pone cara.
 *
 * Nada afirma que se haya hecho una gestión que no esté registrada: lo que se ve es lo que hay en la
 * tabla, con su fecha y quién lo escribió.
 */

const CATEGORIAS = [
  "como_funciona", "publicacion", "alojamiento", "experiencia", "servicio", "registro",
  "edicion", "reserva", "cancelacion", "cuenta_acceso", "tecnico", "otro",
];
const PRIORIDADES = ["baja", "normal", "alta", "urgente"];
const ESTADOS = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"];

export default async function PanelTickets({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const estado = texto(sp.estado);
  const prioridad = texto(sp.prioridad);
  const categoria = texto(sp.categoria);
  const abiertos = texto(sp.abiertos) === "1";
  const idDetalle = Number(texto(sp.id)) || 0;
  const aviso = texto(sp.aviso);
  const ok = texto(sp.ok) === "1";

  const condiciones: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (ESTADOS.includes(estado)) { condiciones.push("estado = ?"); valores.push(estado); }
  if (PRIORIDADES.includes(prioridad)) { condiciones.push("prioridad = ?"); valores.push(prioridad); }
  if (CATEGORIAS.includes(categoria)) { condiciones.push("categoria = ?"); valores.push(categoria); }
  if (abiertos) condiciones.push("estado NOT IN ('RESOLVED','CLOSED')");

  const [filas] = await pool.query<any[]>(
    `SELECT id, codigo, asunto, categoria, prioridad, estado, contacto_email, contacto_nombre,
            responsable, creado_en, actualizado_en,
            (SELECT COUNT(*) FROM ticket_mensaje m WHERE m.ticket_id = ticket.id) AS mensajes
       FROM ticket WHERE ${condiciones.join(" AND ")} ORDER BY
       FIELD(prioridad,'urgente','alta','normal','baja'), id DESC LIMIT 100`,
    valores,
  );
  const [resumen] = await pool.query<any[]>(
    `SELECT estado, COUNT(*) AS n FROM ticket GROUP BY estado`,
  );
  const detalle = idDetalle > 0 ? await obtenerTicket(String(idDetalle)) : null;

  const enlace = (p: Record<string, string | number>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) params.set(k, String(v));
    return `/admin/tickets?${params.toString()}`;
  };

  return (
    <>
      <header className="admin-cab">
        <h1>Atención al cliente</h1>
        <p style={{ color: "var(--muted-fg)" }}>
          Consultas de usuarios y anfitriones. El agente puede abrir incidencias y preparar respuestas con
          información verificada de Hestiat; nunca inventa el estado de una reserva ni da por hecho algo
          que el sistema no confirme.
        </p>
      </header>

      {aviso ? (
        <p className="aviso" style={{ marginBottom: 16, borderColor: ok ? "var(--border)" : "var(--hestiat-primary)" }}>{aviso}</p>
      ) : null}

      <section className="admin-bloque">
        <h2>Filtros</h2>
        <form method="get" action="/admin/tickets" className="ia-fila" style={{ flexWrap: "wrap" }}>
          <select name="estado" defaultValue={estado}><option value="">Todos los estados</option>{ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}</select>
          <select name="prioridad" defaultValue={prioridad}><option value="">Todas las prioridades</option>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select name="categoria" defaultValue={categoria}><option value="">Todas las categorías</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <label style={{ fontSize: 13 }}><input type="checkbox" name="abiertos" value="1" defaultChecked={abiertos} /> Solo abiertas</label>
          <button type="submit" className="f-aplicar">Aplicar</button>
          <Link href="/admin/tickets">Quitar filtros</Link>
        </form>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          {filas.length} incidencias {resumen.length > 0 ? `· por estado: ${resumen.map((r) => `${r.estado} ${r.n}`).join(" · ")}` : "· todavía no hay ninguna"}
        </p>
      </section>

      <section className="admin-bloque">
        <h2>Listado</h2>
        {filas.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>No hay incidencias con estos filtros.</p>
        ) : (
          <table className="admin-tabla">
            <thead><tr><th>Código</th><th>Asunto</th><th>Categoría</th><th>Prioridad</th><th>Estado</th><th>Contacto</th><th>Responsable</th><th>Creada</th><th>Mensajes</th></tr></thead>
            <tbody>
              {filas.map((t) => (
                <tr key={t.id}>
                  <td><Link href={enlace({ id: t.id })}>{t.codigo}</Link></td>
                  <td><Link href={enlace({ id: t.id })}>{t.asunto}</Link></td>
                  <td>{t.categoria}</td>
                  <td>{t.prioridad}</td>
                  <td><b>{t.estado}</b></td>
                  <td>{t.contacto_email ?? t.contacto_nombre ?? "—"}</td>
                  <td>{t.responsable ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{String(t.creado_en).slice(0, 16)}</td>
                  <td>{t.mensajes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {detalle ? (
        <section className="admin-bloque">
          <h2>{detalle.codigo}: {detalle.asunto}</h2>
          <ul className="ia-lista">
            <li><b>Categoría</b>: {detalle.categoria} · <b>Prioridad</b>: {detalle.prioridad} · <b>Estado</b>: {detalle.estado}</li>
            <li><b>Contacto</b>: {detalle.contacto_email ?? "—"} {detalle.contacto_nombre ? `(${detalle.contacto_nombre})` : ""}</li>
            <li><b>Responsable</b>: {detalle.responsable ?? "sin asignar"} · <b>Creada</b>: {String(detalle.creado_en)} · <b>Cerrada</b>: {detalle.cerrado_en ?? "no"}</li>
            <li><b>Resolución</b>: {detalle.resolucion ?? "sin registrar"}</li>
          </ul>

          <h3 style={{ marginTop: 14 }}>Conversación ({detalle.mensajes.length})</h3>
          {detalle.mensajes.length === 0 ? (
            <p style={{ color: "var(--muted-fg)" }}>Sin mensajes todavía.</p>
          ) : (
            <ul className="ia-lista">
              {detalle.mensajes.map((m: any, i: number) => (
                <li key={i} className="ia-msg" style={{ padding: "8px 10px" }}>
                  <b>{m.autor}</b> · {String(m.creado_en).slice(0, 16)}
                  <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.contenido}</p>
                </li>
              ))}
            </ul>
          )}

          <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 8, marginTop: 16, maxWidth: 640 }}>
            <input type="hidden" name="accion" value="ticket_actualizar" />
            <input type="hidden" name="codigo" value={detalle.codigo} />
            <input type="hidden" name="volver" value={enlace({ id: detalle.id })} />
            <div className="ia-fila">
              <label>Estado<select name="estado" defaultValue={detalle.estado}>{ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
              <label>Prioridad<select name="prioridad" defaultValue={detalle.prioridad}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
              <label>Responsable<input type="text" name="responsable" defaultValue={detalle.responsable ?? ""} /></label>
            </div>
            <label>Resolución<textarea name="resolucion" rows={2} defaultValue={detalle.resolucion ?? ""} /></label>
            <label>Mensaje que se añade a la conversación<textarea name="mensaje" rows={3} /></label>
            <button type="submit" className="f-aplicar">Guardar</button>
          </form>
        </section>
      ) : null}

      <section className="admin-bloque">
        <h2>Abrir una incidencia a mano</h2>
        <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 8, maxWidth: 640 }}>
          <input type="hidden" name="accion" value="ticket_crear" />
          <input type="hidden" name="volver" value="/admin/tickets" />
          <label>Asunto *<input type="text" name="asunto" required /></label>
          <div className="ia-fila">
            <label>Categoría<select name="categoria">{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label>Prioridad<select name="prioridad" defaultValue="normal">{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <label>Email de contacto<input type="text" name="contacto_email" /></label>
          </div>
          <label>Detalle<textarea name="mensaje" rows={4} /></label>
          <button type="submit" className="f-aplicar">Crear incidencia</button>
        </form>
      </section>
    </>
  );
}