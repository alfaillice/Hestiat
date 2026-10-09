import { pool, poolLegacy } from "@/lib/db";
import { configAutonomia, consumoDeHoy, comprobarLimites } from "@/lib/ia-auditoria.server";
import { catalogoHerramientas } from "@/lib/ia-herramientas.server";
import { estadoIA } from "@/lib/ia.server";
import { borradoresPendientes, enviadosHoy, LIMITE_ENVIOS_DIA } from "@/lib/ia-correo.server";
import IaConsola from "@/components/ia-consola";

export const dynamic = "force-dynamic";

/**
 * Panel del AI Manager — SOLO ADMINISTRACIÓN (lo garantiza `app/admin/layout.tsx`).
 *
 * Aquí se ve lo que de verdad hay: si el modelo está configurado y PROBADO, qué herramientas existen
 * y con qué nivel, qué se ha ejecutado, cuánto se ha gastado, qué hay pendiente de aprobación y en
 * qué nivel de autonomía está. Nunca se muestra la clave del modelo: solo si está puesta.
 */
export default async function PanelIA() {
  const [estado, consumo, autonomia, limites, herramientas, pendientes] = await Promise.all([
    estadoIA(),
    consumoDeHoy(),
    configAutonomia(),
    comprobarLimites(),
    Promise.resolve(catalogoHerramientas()),
    borradoresPendientes(10),
  ]);

  const [conteos] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM ia_conversacion) AS conversaciones,
       (SELECT COUNT(*) FROM ia_mensaje) AS mensajes,
       (SELECT COUNT(*) FROM lead) AS leads,
       (SELECT COUNT(*) FROM lead WHERE estado = 'CONTACTED') AS contactados,
       (SELECT COUNT(*) FROM ticket) AS tickets,
       (SELECT COUNT(*) FROM ticket WHERE estado NOT IN ('RESOLVED','CLOSED')) AS tickets_abiertos,
       (SELECT COUNT(*) FROM email_exclusion) AS exclusiones,
       (SELECT COUNT(*) FROM ia_campana) AS campanas`,
  );
  const [actividad] = await poolLegacy.query<any[]>(
    `SELECT accion, entidad, entidad_id, detalle, creado_en FROM admin_auditoria
      WHERE accion LIKE 'ia:%' ORDER BY id DESC LIMIT 20`,
  );
  const [errores] = await poolLegacy.query<any[]>(
    `SELECT accion, detalle, creado_en FROM admin_auditoria
      WHERE accion LIKE 'ia:%fall%' OR accion LIKE 'ia:%error%' OR accion LIKE 'ia:requiere%' OR accion LIKE 'ia:bloqueada%'
      ORDER BY id DESC LIMIT 10`,
  );
  const [consumoPorModelo] = await pool.query<any[]>(
    `SELECT modelo, COUNT(*) AS llamadas, ROUND(SUM(coste_estimado),4) AS coste
       FROM ia_consumo WHERE creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY modelo ORDER BY coste DESC`,
  );
  const c = conteos[0] ?? {};

  return (
    <>
      <header className="admin-cab">
        <h1>Hestiat AI Manager</h1>
        <p style={{ color: "var(--muted-fg)" }}>
          Agente operativo: marketing, atención al cliente, asistente de propietarios y proveedores, CRM y operaciones.
          Trabaja con herramientas controladas, no con SQL libre, y deja cada acción en la auditoría.
        </p>
      </header>

      <section className="admin-bloque">
        <h2>Estado del modelo</h2>
        <ul className="ia-lista">
          <li><b>Proveedor</b>: {estado.proveedor} · dirección {estado.direccion_base ?? "(sin configurar)"}</li>
          <li><b>Modelo económico</b>: {estado.modelo_economico} · <b>potente</b>: {estado.modelo_potente}</li>
          <li>
            <b>Clave</b>: {estado.clave_configurada ? "configurada (no se muestra, por seguridad)" : "NO configurada"}
            {" · "}<b>probada</b>: {estado.probada ? `sí (${estado.ultima_prueba})` : "no"}
          </li>
          <li><b>Estado</b>: {estado.estado}</li>
          <li className="ia-aviso">{estado.aviso}</li>
          {estado.ultimo_resultado ? <li style={{ fontSize: 13 }}>Último resultado de prueba: {estado.ultimo_resultado}</li> : null}
        </ul>
      </section>

      <section className="admin-bloque">
        <h2>Consumo y límites</h2>
        <ul className="ia-lista">
          <li>Hoy: {consumo.llamadas} llamadas · {consumo.tokensEntrada + consumo.tokensSalida} tokens · coste estimado {consumo.costeUsd.toFixed(4)} USD</li>
          <li>Límite por hora: {limites.limiteHora} llamadas (última hora: {limites.llamadasUltimaHora})</li>
          <li>Presupuesto diario: {limites.presupuestoDiaUsd} USD {limites.permitido ? "· dentro del límite" : `· SUPERADO: ${limites.motivo}`}</li>
          <li>
            Los precios por token son de referencia y configurables (variables IA_PRECIO_&lt;MODELO&gt;_ENTRADA / _SALIDA):
            el coste que ves es una ESTIMACIÓN, y el consumo real lo fija el proveedor.
          </li>
          {consumoPorModelo.length > 0 ? (
            <li>
              Últimos 30 días por modelo:{" "}
              {consumoPorModelo.map((m) => `${m.modelo}: ${m.llamadas} llamadas / ${Number(m.coste ?? 0).toFixed(4)} USD`).join(" · ")}
            </li>
          ) : (
            <li>Últimos 30 días: sin llamadas registradas.</li>
          )}
        </ul>
      </section>

      <section className="admin-bloque">
        <h2>Autonomía</h2>
        <p>
          Nivel actual: <b>{autonomia.nivelMaximo}</b>{" "}
          {autonomia.nivelMaximo === 1 ? "(solo lectura)" : autonomia.nivelMaximo === 2 ? "(lectura y preparación: no escribe nada)" : "(ejecución: escribe las acciones autorizadas)"}
          {" · "}los envíos comerciales {autonomia.enviosRequierenAprobacion ? "requieren" : "no requieren"} aprobación humana.
        </p>
        <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          Nivel 1 lectura · 2 preparación (redacta y propone, sin ejecutar) · 3 ejecución de las acciones autorizadas.
          Las acciones sensibles piden siempre confirmación explícita y queda registrado quién la dio.
        </p>
      </section>

      <section className="admin-bloque">
        <h2>Herramientas disponibles ({herramientas.length})</h2>
        <table className="admin-tabla">
          <thead>
            <tr><th>Herramienta</th><th>Nivel</th><th>Sensible</th><th>Qué hace</th></tr>
          </thead>
          <tbody>
            {herramientas.map((h) => (
              <tr key={h.nombre}>
                <td><code>{h.nombre}</code></td>
                <td>{h.nivel}</td>
                <td>{h.sensible ? "sí" : "no"}</td>
                <td style={{ fontSize: 13 }}>{h.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-bloque">
        <h2>Actividad</h2>
        <ul className="ia-lista">
          <li>Conversaciones: {Number(c.conversaciones ?? 0)} · mensajes guardados: {Number(c.mensajes ?? 0)}</li>
          <li>Potenciales clientes (CRM): {Number(c.leads ?? 0)} · contactados: {Number(c.contactados ?? 0)}</li>
          <li>Incidencias: {Number(c.tickets ?? 0)} · abiertas: {Number(c.tickets_abiertos ?? 0)}</li>
          <li>Exclusiones de correo: {Number(c.exclusiones ?? 0)} · campañas: {Number(c.campanas ?? 0)}</li>
        </ul>
        {actividad.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>Todavía no hay ninguna acción registrada del agente.</p>
        ) : (
          <table className="admin-tabla">
            <thead><tr><th>Cuándo</th><th>Acción</th><th>Objeto</th><th>Detalle</th></tr></thead>
            <tbody>
              {actividad.map((a, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{String(a.creado_en)}</td>
                  <td>{String(a.accion).replace(/^ia:/, "")}</td>
                  <td>{a.entidad ? `${a.entidad}${a.entidad_id ? ` ${a.entidad_id}` : ""}` : "—"}</td>
                  <td style={{ fontSize: 12.5, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis" }}>{String(a.detalle ?? "").slice(0, 220)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {errores.length > 0 ? (
        <section className="admin-bloque">
          <h2>Errores y bloqueos recientes</h2>
          <ul className="ia-lista">
            {errores.map((e, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <b>{String(e.accion).replace(/^ia:/, "")}</b> · {String(e.creado_en)} · {String(e.detalle ?? "").slice(0, 260)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-bloque">
        <h2>Emails pendientes de aprobación</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          Redactados por el agente y NO enviados. Envíos de hoy: {await enviadosHoy()} de un máximo de {LIMITE_ENVIOS_DIA}.
          Nada sale sin la aprobación de un administrador, y antes se comprueba la lista de exclusión.
        </p>
        {pendientes.length === 0 ? (
          <p style={{ color: "var(--muted-fg)" }}>No hay ningún correo pendiente.</p>
        ) : (
          <table className="admin-tabla">
            <thead><tr><th>Redactado</th><th>Negocio</th><th>Para</th><th>Asunto</th><th>Estado</th></tr></thead>
            <tbody>
              {pendientes.map((b) => (
                <tr key={b.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{String(b.redactado_en)}</td>
                  <td>{b.empresa ?? "—"}</td>
                  <td>{b.email ?? "—"}</td>
                  <td>{b.asunto ?? "—"}</td>
                  <td>{b.contacto_excluido ? "excluido: no se enviará" : "pendiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!estado.clave_configurada ? (
        <section className="admin-bloque">
          <h2>Cómo activar la conexión</h2>
          <p style={{ fontSize: 13.5 }}>
            El agente no conversa porque falta la credencial del modelo. No se simula nada: sin clave,
            cada intento devuelve el motivo y lo deja en la auditoría. Estos son los pasos exactos:
          </p>
          <ol className="ia-lista" style={{ listStyle: "decimal", paddingLeft: 20 }}>
            <li>
              Abre el fichero de entorno del servicio que ejecuta el backend:
              <code> /opt/hestiat/shared/.env</code> (permisos <code>640 root:hestiat</code>). Es el
              fichero que carga <code>hestiat.service</code> con <code>EnvironmentFile</code>.
            </li>
            <li>
              Añade una línea con la variable que el código espera de verdad, <code>IA_API_KEY</code>:
              <code> IA_API_KEY=tu-clave</code>. Nunca en el repositorio, ni en el frontend, ni en un
              mensaje: solo en ese fichero del servidor.
            </li>
            <li>
              Opcionales: <code>IA_BASE_URL</code> (por defecto <code>https://api.openai.com/v1</code>),
              <code>IA_PROVEEDOR</code>, <code>IA_MODELO_ECONOMICO</code>, <code>IA_MODELO_POTENTE</code>,
              <code>IA_PRECIO_&lt;MODELO&gt;_ENTRADA</code> y <code>_SALIDA</code> si tu proveedor cobra
              distinto de la tabla de referencia.
            </li>
            <li>Reinicia el servicio para que lea el fichero: <code>systemctl restart hestiat</code>.</li>
            <li>
              Vuelve aquí y pulsa «Probar conexión»: hace una llamada REAL y, hasta que funcione, esta
              pantalla no dará la integración por conectada.
            </li>
          </ol>
          <p style={{ fontSize: 13 }}>
            Comprobado desde este servidor: el proveedor responde (una petición sin credencial devuelve
            <b> 401 Missing bearer authentication</b>), así que la red y el TLS están bien. Lo único que
            falta es la clave. La clave no viaja al navegador: solo la lee el servidor.
          </p>
        </section>
      ) : null}

      <IaConsola
        configurada={estado.clave_configurada}
        probada={estado.probada}
        modeloEconomico={estado.modelo_economico}
        modeloPotente={estado.modelo_potente}
      />
    </>
  );
}
