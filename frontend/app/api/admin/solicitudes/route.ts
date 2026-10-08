import { NextResponse } from "next/server";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * APROBAR O RECHAZAR UNA SOLICITUD DE ALTA.
 *
 * Solo administración (403 al resto). Al aprobar se crea la ficha REAL en el catálogo con los datos
 * que envió el proveedor, y se le añade su categoría en la tabla de clasificación para que aparezca
 * en los filtros y en la portada. Al rechazar no se toca el catálogo: solo se anota el motivo.
 *
 * La ficha nueva nace sin coordenadas y sin fotografía a propósito: no se inventan ni la ubicación
 * exacta ni una imagen. Se completa después, cuando el proveedor o el equipo la aporten.
 */
function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/admin/solicitudes", 60, 60);
  if (excedido) return excedido;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Solo administración puede revisar solicitudes." }, { status: 403 });
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se entiende la petición." }, { status: 400 });
  }
  const texto = (clave: string) => String(formulario.get(clave) ?? "").trim();
  const id = Number(texto("id"));
  const accion = texto("accion");
  const motivo = texto("motivo").slice(0, 255) || null;

  const irA = (parametros: string) => {
    const destino = new URL("/admin/solicitudes", request.url);
    destino.search = parametros;
    return new NextResponse(null, { status: 303, headers: { Location: `${destino.pathname}${destino.search}` } });
  };

  if (!Number.isInteger(id) || id <= 0 || !["aprobar", "rechazar"].includes(accion)) {
    return NextResponse.json({ ok: false, error: "Solicitud o acción no válidas." }, { status: 400 });
  }

  try {
    const [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, tipo, nombre, categoria, descripcion, municipio, provincia, direccion, web, telefono, precio, estado
         FROM solicitud_catalogo WHERE id = ? LIMIT 1`,
      [id],
    );
    const s = filas[0];
    if (!s) return irA("?aviso=" + encodeURIComponent("Esa solicitud no existe."));

    if (accion === "rechazar") {
      await pool.query(
        `UPDATE solicitud_catalogo SET estado = 'rechazada', motivo = ?, revisor = ?, revisada_en = NOW() WHERE id = ?`,
        [motivo, `admin-${admin.id}`, id],
      );
      return irA("?ok=1&aviso=" + encodeURIComponent("Solicitud rechazada. El catálogo no se ha tocado."));
    }

    if (String(s.estado) !== "pendiente") {
      return irA("?aviso=" + encodeURIComponent("Esa solicitud ya estaba revisada."));
    }

    const esExperiencia = String(s.tipo) === "experiencia";
    const tabla = esExperiencia ? "experiencia" : "servicio_turistico";
    const columnaDescripcion = esExperiencia ? "description" : "short_description";
    const slug = `${aSlug(String(s.nombre))}-${Date.now().toString(36)}`;
    const precio = s.precio === null || s.precio === undefined ? null : Number(s.precio);
    // `osm` es obligatoria y única: es la clave de la fuente original. Un alta de proveedor no viene
    // de OpenStreetMap, así que se marca como tal («proveedor:…») en vez de inventar un identificador
    // de OSM. `category` tampoco admite nulos: si no se eligió categoría, se guarda vacío.
    const osm = `proveedor:${tabla}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const categoriaTexto = s.categoria && !Number.isInteger(Number(s.categoria)) ? String(s.categoria).slice(0, 64) : "";

    const [res] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO ${tabla}
         (osm, name, slug, ${columnaDescripcion}, category, municipality, province, address, website_url, phone,
          price, price_type, is_active, source_name, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,NOW())`,
      [
        osm, String(s.nombre).slice(0, 200), slug, s.descripcion ? String(s.descripcion).slice(0, 4000) : null,
        categoriaTexto, s.municipio ?? null, s.provincia ?? null,
        s.direccion ?? null, s.web ?? null, s.telefono ?? null,
        precio, precio === null ? "unavailable" : "exact", "Alta de proveedor",
      ],
    );
    const itemId = Number(res.insertId);

    // La categoría elegida se guarda en la tabla de clasificación, que es la que usan los filtros y
    // la portada. Los valores del enumerado son los del catálogo: confianza «alta» y origen «manual»
    // (la ha aprobado una persona, no una regla automática).
    //
    // Va en su propio try/catch a propósito: si la clasificación fallara, la ficha ya está creada y la
    // aprobación no se pierde. Se anota el aviso y se sigue.
    let avisoClasificacion = "";
    if (s.categoria && Number.isInteger(Number(s.categoria))) {
      try {
        const tablaClasificacion = esExperiencia ? "experiencia_clasificacion" : "servicio_clasificacion";
        const columnaId = esExperiencia ? "experiencia_id" : "servicio_id";
        await pool.query(
          `INSERT INTO ${tablaClasificacion} (${columnaId}, categoria_id, confianza, origen) VALUES (?,?, 'alta', 'manual')`,
          [itemId, Number(s.categoria)],
        );
      } catch (e) {
        avisoClasificacion = " La ficha se ha publicado sin categoría (la clasificación falló): revísala.";
        console.error("[hestiat] clasificación al aprobar", e instanceof Error ? e.message.slice(0, 160) : e);
      }
    }

    await pool.query(
      `UPDATE solicitud_catalogo SET estado = 'aprobada', item_id = ?, revisor = ?, revisada_en = NOW() WHERE id = ?`,
      [itemId, `admin-${admin.id}`, id],
    );
    console.log(`[hestiat] solicitud ${id} aprobada: ${tabla} #${itemId} «${String(s.nombre)}»`);

    return irA("?ok=1&aviso=" + encodeURIComponent(`Publicada: ${esExperiencia ? "experiencia" : "servicio"} #${itemId}. Revisa la ficha y complétala si hace falta.${avisoClasificacion}`));
  } catch (error) {
    const m = error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    console.error("[hestiat] /api/admin/solicitudes", m);
    return irA("?aviso=" + encodeURIComponent("No se ha podido completar la acción: " + m));
  }
}
