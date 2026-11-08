import Link from "next/link";
import { pool } from "@/lib/db";
import { metricasCaptacion, TRANSICIONES, SIN_SEGUIMIENTO, type Estado } from "@/lib/captacion.server";

export const dynamic = "force-dynamic";

/**
 * CAPTACIÓN: MÉTRICAS Y COLA DE APROBACIÓN — SOLO ADMINISTRACIÓN.
 *
 * Dos cosas, y las dos dicen la verdad:
 *   · las cifras, contando solo lo real y avisando de lo que NO se puede medir (aperturas, clics);
 *   · la cola de correos, con el motivo de selección y la base jurídica a la vista, para que una
 *     persona decida: aprobar, editar, rechazar o dejarlo como borrador. Nada sale solo.
 */
/**
 * Provincias de cada comunidad autónoma, para poder filtrar por comunidad sin ninguna columna
 * nueva: la provincia ya está en cada fila de `lead`, y esto solo la agrupa.
 */
const PROVINCIAS: Record<string, string[]> = {
  Andalucía: ["Almería","Cádiz","Córdoba","Granada","Huelva","Jaén","Málaga","Sevilla"],
  Aragón: ["Huesca","Teruel","Zaragoza"],
  Asturias: ["Asturias"],
  "Illes Balears": ["Illes Balears"],
  Canarias: ["Las Palmas","Santa Cruz de Tenerife"],
  Cantabria: ["Cantabria"],
  "Castilla y León": ["Ávila","Burgos","León","Palencia","Salamanca","Segovia","Soria","Valladolid","Zamora"],
  "Castilla-La Mancha": ["Albacete","Ciudad Real","Cuenca","Guadalajara","Toledo"],
  Cataluña: ["Barcelona","Girona","Lleida","Tarragona"],
  Extremadura: ["Badajoz","Cáceres"],
  Galicia: ["A Coruña","Lugo","Ourense","Pontevedra"],
  "La Rioja": ["La Rioja"],
  Madrid: ["Madrid"],
  Murcia: ["Murcia"],
  Navarra: ["Navarra"],
  "País Vasco": ["Araba/Álava","Bizkaia/Vizcaya","Gipuzkoa/Guipúzcoa"],
  "Comunitat Valenciana": ["Alacant/Alicante","Castelló/Castellón","València/Valencia"],
  Ceuta: ["Ceuta"], Melilla: ["Melilla"],
};

export default async function PanelCaptacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const aviso = texto(sp.aviso);
  const ok = texto(sp.ok) === "1";
  const idDetalle = Number(texto(sp.id)) || 0;

  // FILTROS Y VISTA DE LOTES. Llegan por la dirección (GET), así que funcionan sin JavaScript y
  // se pueden compartir. La clase A-E se calcula con los campos que ya existen: no hay columna nueva.
  const clase = texto(sp.clase).toUpperCase();
  const provincia = texto(sp.provincia);
  const comunidad = texto(sp.comunidad);
  const lote = texto(sp.lote);
  const CLASE_SQL = `CASE
      WHEN l.excluido = 1 OR l.estado = 'OPT_OUT' THEN 'E'
      WHEN l.objetivo = 'reclamar_ficha' AND l.estado = 'NEEDS_REVIEW' THEN 'B'
      WHEN l.objetivo = 'reclamar_ficha' THEN 'C'
      WHEN l.estado = 'NEEDS_REVIEW' THEN 'B'
      ELSE 'A' END`;
  const filtros: string[] = [];
  const valores: any[] = [];
  if (provincia) { filtros.push("l.provincia = ?"); valores.push(provincia); }
  if (lote) { filtros.push("l.responsable = ?"); valores.push(lote); }
  if (comunidad && PROVINCIAS[comunidad]) {
    filtros.push(`l.provincia IN (${PROVINCIAS[comunidad].map(() => "?").join(",")})`);
    valores.push(...PROVINCIAS[comunidad]);
  }
  if (clase) { filtros.push(`${CLASE_SQL} = ?`); valores.push(clase); }
  const donde = filtros.length ? " AND " + filtros.join(" AND ") : "";

  const metricas = await metricasCaptacion();

  const [cola] = await pool.query<any[]>(
    `SELECT c.id, c.asunto, c.cuerpo, c.motivo_seleccion, c.base_juridica, c.idioma, c.plantilla,
            c.creado_en, c.revisado_por, c.revisado_en, c.resultado,
            l.id AS lead_id, l.empresa, l.email, l.localidad, l.fuente, l.estado, l.objetivo, l.excluido
       FROM lead_contacto c JOIN \`lead\` l ON l.id = c.lead_id
      WHERE c.canal = 'email' AND c.resultado IS NULL
      ORDER BY c.id DESC LIMIT 50`,
  );

  const [leads] = await pool.query<any[]>(
    `SELECT l.id, l.empresa, l.tipo_negocio, l.localidad, l.provincia, l.email, l.web, l.fuente, l.estado, l.objetivo, ${CLASE_SQL} AS clase,
            l.verificacion, l.confianza, l.excluido, l.publicacion_id, l.actualizado_en,
            (SELECT COUNT(*) FROM lead_contacto c WHERE c.lead_id = l.id) AS contactos,
            (SELECT COUNT(*) FROM email_respuesta r WHERE r.lead_id = l.id) AS respuestas
       FROM \`lead\` l WHERE l.empresa NOT LIKE 'PRUEBA%'${donde} ORDER BY l.actualizado_en DESC LIMIT 60`,
    valores,
  );

  // Lotes de recopilación: se agrupan por el responsable, que es donde va la marca del lote.
  const [lotes] = await pool.query<any[]>(
    `SELECT l.responsable AS lote, COUNT(*) AS total,
            SUM(${CLASE_SQL} = 'A') AS clase_a, SUM(${CLASE_SQL} = 'B') AS clase_b,
            SUM(${CLASE_SQL} = 'C') AS clase_c, SUM(${CLASE_SQL} = 'E') AS clase_e,
            SUM(l.estado IN ('APPROVED','CONTACT_READY','CONTACTED','REPLIED','INTERESTED','REGISTERED','PUBLISHED')) AS autorizados,
            SUM(l.estado IN ('DETECTED','RESEARCHED','NEEDS_REVIEW')) AS investigados,
            SUM(COALESCE(l.email,'') <> '') AS con_correo, MIN(l.comprobado_en) AS desde, MAX(l.comprobado_en) AS hasta
       FROM \`lead\` l WHERE l.empresa NOT LIKE 'PRUEBA%' GROUP BY l.responsable ORDER BY total DESC LIMIT 40`,
  );
  const [porClase] = await pool.query<any[]>(
    `SELECT ${CLASE_SQL} AS clase, COUNT(*) AS n, SUM(COALESCE(l.email,'') <> '') AS con_correo FROM \`lead\` l WHERE l.empresa NOT LIKE 'PRUEBA%' GROUP BY clase ORDER BY clase`,
  );
  const [porProvincia] = await pool.query<any[]>(
    `SELECT COALESCE(l.provincia,'(sin provincia)') AS provincia, COUNT(*) AS n FROM \`lead\` l WHERE l.empresa NOT LIKE 'PRUEBA%' GROUP BY provincia ORDER BY n DESC LIMIT 25`,
  );

  const [historial] = await pool.query<any[]>(
    `SELECT h.lead_id, h.estado_anterior, h.estado_nuevo, h.motivo, h.responsable, h.creado_en, l.empresa
       FROM lead_estado_historial h LEFT JOIN \`lead\` l ON l.id = h.lead_id
      ORDER BY h.id DESC LIMIT 20`,
  );

  const [respuestas] = await pool.query<any[]>(
    `SELECT tipo, COUNT(*) AS n FROM email_respuesta GROUP BY tipo`,
  );

  if (idDetalle > 0) {
    const [detalle] = await pool.query<any[]>(`SELECT * FROM \`lead\` WHERE id = ? LIMIT 1`, [idDetalle]);
    const [transiciones] = await pool.query<any[]>(
      `SELECT estado_anterior, estado_nuevo, motivo, responsable, evento, creado_en FROM lead_estado_historial WHERE lead_id = ? ORDER BY id DESC LIMIT 20`,
      [idDetalle],
    );
    const [correos] = await pool.query<any[]>(
      `SELECT id, asunto, cuerpo, resultado, revisado_por, enviado_en, creado_en FROM lead_contacto WHERE lead_id = ? ORDER BY id DESC LIMIT 10`,
      [idDetalle],
    );
    // Las transiciones permitidas desde el estado actual, con el tipo correcto.
    const estadoActual = String(detalle[0]?.estado ?? "DETECTED") as Estado;
    const siguientes: Estado[] = TRANSICIONES[estadoActual] ?? [];

    return (
      <>
        <header className="admin-cab">
          <h1>Ficha de captación #{idDetalle}</h1>
          <p><Link href="/admin/captacion">← volver a captación</Link></p>
        </header>
        {aviso ? <p className="aviso" style={{ marginBottom: 16, borderColor: ok ? "var(--border)" : "var(--hestiat-primary)" }}>{aviso}</p> : null}
        <section className="admin-bloque">
          <h2>{detalle[0]?.empresa ?? "(sin nombre)"}</h2>
          <ul className="ia-lista">
            <li><b>Estado</b>: {detalle[0]?.estado} · <b>Objetivo</b>: {detalle[0]?.objetivo} · <b>Excluido</b>: {Number(detalle[0]?.excluido) === 1 ? "sí" : "no"}</li>
            <li><b>Localidad</b>: {detalle[0]?.localidad ?? "—"} · <b>Email</b>: {detalle[0]?.email ?? "—"} · <b>Web</b>: {detalle[0]?.web ?? "—"}</li>
            <li><b>Fuente</b>: {detalle[0]?.fuente} · <b>Verificación</b>: {detalle[0]?.verificacion} · <b>Confianza</b>: {detalle[0]?.confianza ?? "—"}</li>
            <li><b>Ficha del catálogo</b>: {detalle[0]?.publicacion_id ?? "no vinculada"}</li>
            <li><b>Comprobado</b>: {detalle[0]?.comprobado_en ?? "—"} · <b>Notas</b>: {detalle[0]?.notas ?? "—"}</li>
          </ul>

          <h3 style={{ marginTop: 14 }}>Qué se puede hacer ahora</h3>
          <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
            Desde {estadoActual} se permite: {siguientes.join(", ") || "nada (es un estado final)"}.
            Un estado solo avanza con el evento real que lo respalda, y queda registrado.
          </p>
          <form method="post" action="/api/admin/ia" className="ia-fila" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="accion" value="crm_estado" />
            <input type="hidden" name="id" value={idDetalle} />
            <input type="hidden" name="volver" value={`/admin/captacion?id=${idDetalle}`} />
            <select name="estado">{siguientes.map((e) => <option key={e} value={e}>{e}</option>)}</select>
            <input type="text" name="motivo" placeholder="Motivo del cambio (obligatorio)" style={{ minWidth: 260 }} />
            <button className="f-aplicar" type="submit">Cambiar estado</button>
          </form>

          <div className="ia-fila" style={{ marginTop: 10 }}>
            <form method="post" action="/api/admin/ia">
              <input type="hidden" name="accion" value="crm_preparar_email" />
              <input type="hidden" name="id" value={idDetalle} />
              <input type="hidden" name="volver" value={`/admin/captacion?id=${idDetalle}`} />
              <button className="f-aplicar" type="submit">Preparar invitación (no envía)</button>
            </form>
            <form method="post" action="/api/admin/ia">
              <input type="hidden" name="accion" value="crm_suprimir" />
              <input type="hidden" name="id" value={idDetalle} />
              <input type="hidden" name="motivo" value="Solicitud del interesado" />
              <input type="hidden" name="volver" value="/admin/captacion" />
              <button type="submit">Suprimir sus datos (derecho de supresión)</button>
            </form>
          </div>

          <h3 style={{ marginTop: 14 }}>Historial de estados ({transiciones.length})</h3>
          <table className="admin-tabla">
            <thead><tr><th>Cuándo</th><th>De</th><th>A</th><th>Motivo</th><th>Responsable</th><th>Evento</th></tr></thead>
            <tbody>
              {transiciones.map((t, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{String(t.creado_en)}</td>
                  <td>{t.estado_anterior ?? "—"}</td>
                  <td><b>{t.estado_nuevo}</b></td>
                  <td>{t.motivo ?? "—"}</td>
                  <td>{t.responsable ?? "—"}</td>
                  <td>{t.evento ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 14 }}>Correos ({correos.length})</h3>
          <table className="admin-tabla">
            <thead><tr><th>Redactado</th><th>Asunto</th><th>Estado</th><th>Revisó</th><th>Enviado</th></tr></thead>
            <tbody>
              {correos.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{String(c.creado_en).slice(0, 16)}</td>
                  <td>{c.asunto ?? "—"}</td>
                  <td>{c.resultado ?? "borrador"}</td>
                  <td>{c.revisado_por ?? "—"}</td>
                  <td>{c.enviado_en ? String(c.enviado_en).slice(0, 16) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="admin-cab">
        <h1>Captación y conversión</h1>
        <p style={{ color: "var(--muted-fg)" }}>
          Propietarios y proveedores: investigar, preparar la invitación, aprobarla y acompañarles hasta
          publicar. Publicar en Hestiat es gratis, sin cuotas ni comisiones de Hestiat.
        </p>
      </header>

      {aviso ? <p className="aviso" style={{ marginBottom: 16, borderColor: ok ? "var(--border)" : "var(--hestiat-primary)" }}>{aviso}</p> : null}

      <section className="admin-bloque">
        <h2>Cifras reales</h2>
        <ul className="ia-lista">
          <li><b>Leads detectados</b>: {metricas.reales.detectados} · <b>investigados</b>: {metricas.reales.investigados} · <b>aptos para revisión</b>: {metricas.reales.aptos_revision}</li>
          <li><b>Emails aprobados</b>: {metricas.reales.emails_aprobados} · <b>enviados</b>: {metricas.reales.emails_enviados} · <b>rechazados</b>: {metricas.reales.emails_rechazados}</li>
          <li><b>Respuestas</b>: {metricas.reales.respuestas} · <b>rebotes</b>: {metricas.reales.rebotes} · <b>bajas</b>: {metricas.reales.bajas}</li>
          <li><b>Interesados</b>: {metricas.reales.interesados} · <b>registros</b>: {metricas.reales.registros} · <b>reclamaciones iniciadas</b>: {metricas.reales.reclamaciones_iniciadas} · <b>publicaciones completadas</b>: {metricas.reales.publicaciones_completadas}</li>
          <li><b>Transiciones registradas</b>: {metricas.reales.transiciones_registradas}</li>
          <li className="ia-aviso">
            <b>No disponible</b>: {metricas.noDisponibles.join(" · ")}. {metricas.nota}
          </li>
        </ul>
        {respuestas.length > 0 ? (
          <p style={{ fontSize: 13 }}>Respuestas por tipo: {respuestas.map((r) => `${r.tipo} ${r.n}`).join(" · ")}</p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>Todavía no se ha registrado ninguna respuesta real.</p>
        )}
      </section>

      <section className="admin-bloque">
        <h2>Lote piloto (pequeño y revisable)</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          Toma negocios REALES de nuestro catálogo de servicios que publican su correo profesional, los
          investiga contra el catálogo y los deja como leads investigados. Ni una empresa inventada. Se
          descartan los que ya son leads, los que están en la lista de exclusión y los repetidos.
        </p>
        <form method="post" action="/api/admin/ia" className="ia-fila">
          <input type="hidden" name="accion" value="captacion_piloto" />
          <input type="hidden" name="volver" value="/admin/captacion" />
          <input type="number" name="limite" defaultValue={5} min={1} max={25} style={{ width: 90 }} />
          <button className="f-aplicar" type="submit">Ejecutar lote piloto</button>
        </form>
      </section>

      <section className="admin-bloque">
        <h2>Investigar un negocio</h2>
        <form method="post" action="/api/admin/ia" className="ia-fila" style={{ flexWrap: "wrap" }}>
          <input type="hidden" name="accion" value="crm_investigar" />
          <input type="text" name="nombre" placeholder="Nombre comercial *" required style={{ minWidth: 220 }} />
          <input type="text" name="localidad" placeholder="Localidad" />
          <input type="text" name="web" placeholder="Web oficial" />
          <input type="text" name="email" placeholder="Email profesional" />
          <button className="f-aplicar" type="submit">Investigar contra el catálogo</button>
        </form>
      </section>

      <section className="admin-bloque">
        <h2>Cola de aprobación ({cola.length})</h2>
        {cola.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>No hay ningún correo esperando aprobación.</p>
        ) : (
          cola.map((c) => (
            <div key={c.id} className="admin-bloque" style={{ border: "1px solid var(--border)", marginBottom: 14 }}>
              <ul className="ia-lista">
                <li><b>Destinatario</b>: {c.email ?? "—"} · <b>Negocio</b>: {c.empresa ?? "—"} · <b>Estado del lead</b>: {c.estado}</li>
                <li><b>Fuente del contacto</b>: {c.fuente} · <b>Motivo de selección</b>: {c.motivo_seleccion ?? "—"}</li>
                <li><b>Base jurídica</b>: {c.base_juridica ?? "—"}</li>
                <li><b>Asunto</b>: {c.asunto} · <b>Idioma</b>: {c.idioma} · <b>Plantilla</b>: {c.plantilla ?? "—"}</li>
                <li><b>Estado</b>: {c.revisado_por ? `aprobado por ${c.revisado_por} el ${String(c.revisado_en).slice(0, 16)}` : "borrador, sin aprobar"}</li>
              </ul>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer" }}>Ver el mensaje</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "var(--secondary)", padding: 10, borderRadius: 8 }}>{c.cuerpo}</pre>
              </details>

              <form method="post" action="/api/admin/ia" style={{ display: "grid", gap: 6, marginTop: 10 }}>
                <input type="hidden" name="accion" value="crm_editar_borrador" />
                <input type="hidden" name="contactoId" value={c.id} />
                <input type="hidden" name="volver" value="/admin/captacion" />
                <input type="text" name="asunto" defaultValue={c.asunto ?? ""} style={{ width: "100%" }} />
                <textarea name="cuerpo" rows={5} defaultValue={c.cuerpo ?? ""} style={{ width: "100%" }} />
                <div className="ia-fila">
                  <button type="submit">Guardar edición (queda como borrador)</button>
                </div>
              </form>
              <div className="ia-fila" style={{ marginTop: 6 }}>
                <form method="post" action="/api/admin/ia">
                  <input type="hidden" name="accion" value="crm_aprobar" />
                  <input type="hidden" name="contactoId" value={c.id} />
                  <input type="hidden" name="volver" value="/admin/captacion" />
                  <button className="f-aplicar" type="submit">Aprobar (sin enviar)</button>
                </form>
                <form method="post" action="/api/admin/ia">
                  <input type="hidden" name="accion" value="crm_cancelar_envio" />
                  <input type="hidden" name="contactoId" value={c.id} />
                  <input type="hidden" name="volver" value="/admin/captacion" />
                  <button type="submit">Rechazar</button>
                </form>
              </div>
              <form method="post" action="/api/admin/ia" style={{ marginTop: 6 }}>
                <input type="hidden" name="accion" value="aprobar_envio" />
                <input type="hidden" name="contactoId" value={c.id} />
                <input type="hidden" name="volver" value="/admin/captacion" />
                <button className="f-aplicar" type="submit">Aprobar y ENVIAR este correo</button>
                <span style={{ fontSize: 12.5, color: "var(--muted-fg)", marginLeft: 10 }}>Sale un solo mensaje a ese destinatario, y queda registrado quién lo autoriza.</span>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="admin-bloque">
        <h2>Registrar una respuesta real</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          Se registra lo que alguien ha contestado de verdad. Una baja o un rebote detienen el seguimiento
          y añaden la dirección a la lista de exclusión. Si el proveedor de correo tiene webhook, puede
          llamar a esta misma puerta con el secreto compartido.
        </p>
        <form method="post" action="/api/admin/ia" className="ia-fila" style={{ flexWrap: "wrap" }}>
          <input type="hidden" name="accion" value="crm_registrar_respuesta" />
          <input type="hidden" name="volver" value="/admin/captacion" />
          <input type="text" name="email" placeholder="Dirección que ha respondido *" required style={{ minWidth: 220 }} />
          <select name="tipo">
            <option value="interesado">interesado</option>
            <option value="pregunta">pregunta</option>
            <option value="no_interesado">no interesado</option>
            <option value="baja">baja</option>
            <option value="rebote">rebote</option>
            <option value="otro">otro</option>
          </select>
          <input type="text" name="asunto" placeholder="Asunto" />
          <button className="f-aplicar" type="submit">Registrar respuesta</button>
        </form>
      </section>

      <section className="admin-bloque">
        <h2>Leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>Todavía no hay ningún lead. Puedes crearlos a mano, con el lote piloto o desde el CRM.</p>
        ) : (
          <table className="admin-tabla">
            <thead><tr><th>#</th><th>Empresa</th><th>Localidad</th><th>Estado</th><th>Objetivo</th><th>Verificación</th><th>Ficha</th><th>Correos</th><th>Respuestas</th><th>Seguimiento</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/admin/captacion?id=${l.id}`}>{l.id}</Link></td>
                  <td><Link href={`/admin/captacion?id=${l.id}`}>{l.empresa ?? "—"}</Link></td>
                  <td>{l.localidad ?? "—"}</td>
                  <td><b>{l.estado}</b></td>
                  <td>{l.objetivo}</td>
                  <td>{l.verificacion}{l.confianza ? ` (${l.confianza})` : ""}</td>
                  <td>{l.publicacion_id ?? "—"}</td>
                  <td>{l.contactos}</td>
                  <td>{l.respuestas}</td>
                  <td>{Number(l.excluido) === 1 || SIN_SEGUIMIENTO.includes(l.estado) ? "detenido" : "activo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-bloque">
        <h2>Últimas transiciones</h2>
        {historial.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>Sin movimientos todavía.</p>
        ) : (
          <table className="admin-tabla">
            <thead><tr><th>Cuándo</th><th>Lead</th><th>De</th><th>A</th><th>Motivo</th><th>Responsable</th></tr></thead>
            <tbody>
              {historial.map((h, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{String(h.creado_en)}</td>
                  <td>{h.empresa ?? `#${h.lead_id}`}</td>
                  <td>{h.estado_anterior ?? "—"}</td>
                  <td><b>{h.estado_nuevo}</b></td>
                  <td>{h.motivo ?? "—"}</td>
                  <td>{h.responsable ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-bloque">
        <h2>Lotes de recopilación, clases y filtros</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          Los lotes se agrupan por el responsable con el que se incorporaron (por ejemplo
          <code> agente-captacion-lote-…-teruel-catalogo</code>). La clase se calcula con los campos que ya
          existen: <b>A</b> no está en Hestiat (nueva publicación), <b>B</b> posiblemente existente o pendiente de
          revisar, <b>C</b> ficha existente por reclamar, <b>E</b> pidió no aparecer. Y «autorizados» son los que
          tienen un estado que habilita comunicarles; «investigados», los que solo están localizados.
        </p>

        <form method="get" className="ia-fila" style={{ flexWrap: "wrap", marginBottom: 12 }}>
          <select name="clase" defaultValue={clase}>
            <option value="">Todas las clases</option>
            <option value="A">A · no está en Hestiat</option>
            <option value="B">B · posiblemente existente, a revisar</option>
            <option value="C">C · ficha por reclamar</option>
            <option value="E">E · pidió no aparecer</option>
          </select>
          <select name="comunidad" defaultValue={comunidad}>
            <option value="">Todas las comunidades</option>
            {Object.keys(PROVINCIAS).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input name="provincia" placeholder="Provincia (texto)" defaultValue={provincia} style={{ minWidth: 180 }} />
          <input name="lote" placeholder="Lote (responsable)" defaultValue={lote} style={{ minWidth: 220 }} />
          <button className="f-aplicar" type="submit">Filtrar</button>
          <Link className="f-limpiar" href="/admin/captacion">Quitar filtros</Link>
        </form>

        <h3>Resumen por clase</h3>
        <table className="admin-tabla">
          <thead><tr><th>Clase</th><th>Leads</th><th>Con correo autorizado</th></tr></thead>
          <tbody>
            {porClase.map((c) => (
              <tr key={c.clase}>
                <td><b>{c.clase}</b></td>
                <td>{Number(c.n)}</td>
                <td>{Number(c.con_correo)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: 14 }}>Lotes ({lotes.length})</h3>
        <table className="admin-tabla">
          <thead><tr><th>Lote</th><th>Total</th><th>A</th><th>B</th><th>C</th><th>E</th><th>Autorizados</th><th>Investigados</th><th>Con correo</th><th>Comprobado</th></tr></thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.lote ?? "sin-lote"}>
                <td>{l.lote ?? "—"}</td>
                <td><b>{Number(l.total)}</b></td>
                <td>{Number(l.clase_a)}</td><td>{Number(l.clase_b)}</td><td>{Number(l.clase_c)}</td><td>{Number(l.clase_e)}</td>
                <td>{Number(l.autorizados)}</td><td>{Number(l.investigados)}</td><td>{Number(l.con_correo)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{String(l.desde ?? "").slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: 14 }}>Leads por provincia ({porProvincia.length})</h3>
        <ul className="ia-lista">
          {porProvincia.map((p) => <li key={p.provincia}><b>{p.provincia}</b>: {Number(p.n)}</li>)}
        </ul>

        <h3 style={{ marginTop: 14 }}>Leads filtrados ({leads.length}), con su fuente</h3>
        <table className="admin-tabla">
          <thead><tr><th>Empresa</th><th>Clase</th><th>Localidad</th><th>Provincia</th><th>Fuente</th><th>Estado</th><th>Verificación</th><th>Ficha</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/admin/captacion?id=${l.id}`}>{l.empresa}</Link></td>
                <td><b>{l.clase ?? "—"}</b></td>
                <td>{l.localidad ?? "—"}</td>
                <td>{l.provincia ?? "—"}</td>
                <td>{l.fuente ?? "—"}</td>
                <td>{l.estado}{Number(l.excluido) === 1 ? " · EXCLUIDO" : ""}</td>
                <td>{l.verificacion ?? "—"} · {l.confianza ?? "—"}</td>
                <td>{l.publicacion_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
