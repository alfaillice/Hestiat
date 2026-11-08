import { NextResponse } from "next/server";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DECISIONES DE REVISIÓN — solo administración.
 *
 * Cada propuesta de enriquecimiento dudosa (confianza LOW o AMBIGUOUS) se puede:
 *   APROBAR          → el dato pasa a confianza media y se publica
 *   RECHAZAR         → se queda en confianza baja y NO se publica
 *   CORREGIR         → se guarda el valor corregido a mano, con confianza media
 *   VOLVER A BUSCAR  → la ficha vuelve a pendiente y el próximo lote la reintenta
 *
 * Nunca se borra nada: se cambia el estado. Y nunca se toca el dato ORIGINAL del catálogo: se
 * escribe solo en catalogo_*.
 */
const ACCIONES = ["aprobar", "rechazar", "corregir", "volver_a_buscar"] as const;
type Accion = (typeof ACCIONES)[number];

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/revision", 60, 60);
  if (excedido) return excedido;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede revisar propuestas." }, { status: 403 });
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se entiende la petición." }, { status: 400 });
  }
  const texto = (clave: string) => String(formulario.get(clave) ?? "").trim();
  const tipo = texto("tipo");
  const item = Number(texto("item"));
  const accion = texto("accion") as Accion;
  const valor = texto("valor");
  const problema = texto("problema");

  if (!["experience", "service", "accommodation"].includes(tipo) || !item || !ACCIONES.includes(accion)) {
    return NextResponse.json({ ok: false, error: "Faltan datos o la acción no es válida.", permitidas: ACCIONES }, { status: 400 });
  }
  if (accion === "corregir" && (valor.length < 1 || valor.length > 700)) {
    return NextResponse.json({ ok: false, error: "El valor corregido debe tener entre 1 y 700 caracteres." }, { status: 400 });
  }

  const estadoRevision =
    accion === "aprobar" ? "aprobado" : accion === "rechazar" ? "rechazado" : accion === "corregir" ? "corregido" : "volver_a_buscar";

  try {
    // 1 · La decisión queda anotada en la propuesta.
    await pool.query(
      `UPDATE catalogo_revision
          SET estado = ?, revisor = ?, decidido_en = NOW()
        WHERE catalog_type = ? AND item_id = ? ${problema ? "AND problema = ?" : ""}`,
      problema
        ? [estadoRevision, `admin-${admin.id}`, tipo, item, problema.slice(0, 200)]
        : [estadoRevision, `admin-${admin.id}`, tipo, item],
    );

    // 2 · Lo que decide la web: la confianza del dato.
    if (accion === "aprobar") {
      await pool.query(
        `UPDATE catalogo_dato SET confidence = 'medium', verified_at = NOW()
          WHERE catalog_type = ? AND item_id = ? AND confidence = 'low'`,
        [tipo, item],
      );
    }
    if (accion === "rechazar") {
      await pool.query(
        `UPDATE catalogo_dato SET confidence = 'low'
          WHERE catalog_type = ? AND item_id = ? AND source <> 'database'`,
        [tipo, item],
      );
    }
    if (accion === "corregir") {
      // Se corrige el dato propuesto que corresponda; si la propuesta venía con el campo en el JSON,
      // se usa ese. Se guarda con confianza media y procedencia de revisión manual.
      const [filas] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT problema, propuesta FROM catalogo_revision
          WHERE catalog_type = ? AND item_id = ? AND estado = 'corregido' ORDER BY id DESC LIMIT 1`,
        [tipo, item],
      );
      let campo = "";
      try {
        campo = String(JSON.parse(String(filas[0]?.propuesta ?? "{}"))?.campo ?? "");
      } catch {
        campo = "";
      }
      if (campo) {
        await pool.query(
          `UPDATE catalogo_dato
              SET enriched_value = ?, confidence = 'medium', source_type = 'corregido_a_mano',
                  verificacion = 'corregido por administración', verified_at = NOW()
            WHERE catalog_type = ? AND item_id = ? AND campo = ?`,
          [valor, tipo, item, campo],
        );
      }
    }
    if (accion === "volver_a_buscar") {
      // La ficha vuelve a pendiente y con versión 0: el próximo lote la reintenta con las reglas nuevas.
      await pool.query(
        `UPDATE catalogo_enriquecimiento
            SET estado = 'pending', enrichment_version = 0, actualizado_en = NOW()
          WHERE catalog_type = ? AND item_id = ?`,
        [tipo, item],
      );
    }

    const destino = new URL("/admin/revision", request.url);
    destino.searchParams.set("aviso", `Propuesta ${estadoRevision.replace("_", " ")}`);
    destino.searchParams.set("ok", "1");
    // Dirección RELATIVA a propósito: detrás de un proxy, la absoluta apunta al host interno
    // (localhost) y el navegador acabaría en un sitio que no existe para él.
    return new NextResponse(null, { status: 303, headers: { Location: `${destino.pathname}${destino.search}` } });
  } catch (error) {
    const motivo = error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    console.error("[hestiat] /api/revision", motivo);
    return NextResponse.json({ ok: false, error: "No se ha podido guardar la decisión.", detalle: motivo }, { status: 500 });
  }
}
