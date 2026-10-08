import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * EDICIÓN DE CATÁLOGO PARA ADMINISTRACIÓN (experiencias y servicios).
 *
 * Autorización REAL en el servidor: si la sesión no es de administración, se responde 403 y no se
 * toca nada. Ocultar el botón en la ficha no es la defensa; esto lo es.
 *
 * Solo se aceptan los campos de una lista cerrada y solo los tipos soportados: nada de SQL libre ni
 * de escribir en tablas que no toque. Los alojamientos tienen su propia ruta de edición y no pasan
 * por aquí.
 */
const TABLAS: Record<string, { tabla: string; campos: string[] }> = {
  experiencia: {
    tabla: "experiencia",
    campos: ["name", "description", "phone", "website_url", "address", "price", "price_type"],
  },
  servicio: {
    tabla: "servicio_turistico",
    campos: ["name", "short_description", "phone", "website_url", "address", "price", "price_type"],
  },
};

const TIPOS_PRECIO = ["", "free", "exact", "from", "variable", "unavailable"];

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/admin/catalogo", 30, 60);
  if (excedido) return excedido;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Solo administración puede editar el catálogo." },
      { status: 403 },
    );
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se entiende la petición." }, { status: 400 });
  }
  const texto = (clave: string) => String(formulario.get(clave) ?? "").trim();

  const tipo = texto("tipo");
  const id = Number(texto("id"));
  const conf = TABLAS[tipo];
  if (!conf || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Tipo o identificador no válidos." }, { status: 400 });
  }

  const nombre = texto("nombre").slice(0, 255);
  if (nombre.length < 2) {
    return NextResponse.json({ ok: false, error: "El nombre no puede quedar vacío." }, { status: 400 });
  }
  const descripcion = texto("descripcion").slice(0, 4000);
  const telefono = texto("telefono").slice(0, 40) || null;
  const web = texto("web").slice(0, 512) || null;
  if (web && !/^https?:\/\//i.test(web)) {
    return NextResponse.json({ ok: false, error: "La web debe empezar por http:// o https://" }, { status: 400 });
  }
  const direccion = texto("direccion").slice(0, 255) || null;
  const tipoPrecio = texto("tipoPrecio");
  if (!TIPOS_PRECIO.includes(tipoPrecio)) {
    return NextResponse.json({ ok: false, error: "Tipo de precio no válido." }, { status: 400 });
  }
  const precioCrudo = texto("precio").replace(",", ".");
  const precio = precioCrudo === "" ? null : Number(precioCrudo);
  if (precio !== null && (!Number.isFinite(precio) || precio < 0 || precio > 1_000_000)) {
    return NextResponse.json({ ok: false, error: "El precio no es un número razonable." }, { status: 400 });
  }

  try {
    // Se escribe en la columna de descripción que corresponde a cada tipo, y solo en las columnas
    // permitidas: el resto del registro queda intacto.
    const columnas = tipo === "experiencia"
      ? ["name", "description", "phone", "website_url", "address", "price", "price_type"]
      : ["name", "short_description", "phone", "website_url", "address", "price", "price_type"];
    const valores = [nombre, descripcion, telefono, web, direccion, precio, tipoPrecio || null];
    const asignaciones = columnas.map((c) => `${c} = ?`).join(", ");

    const [res] = await pool.query(
      `UPDATE ${conf.tabla} SET ${asignaciones} WHERE id = ? LIMIT 1`,
      [...valores, id],
    );
    const afectadas = Number((res as { affectedRows?: number }).affectedRows ?? 0);
    if (afectadas === 0) {
      return NextResponse.json({ ok: false, error: "No existe esa publicación." }, { status: 404 });
    }

    console.log(`[hestiat] edición de catálogo por admin-${admin.id}: ${tipo} ${id}`);
    const destino = new URL(`/admin/editar/${tipo}/${id}`, request.url);
    destino.searchParams.set("aviso", "Cambios guardados");
    destino.searchParams.set("ok", "1");
    // Dirección relativa: detrás del proxy, la absoluta apunta al host interno.
    return new NextResponse(null, { status: 303, headers: { Location: `${destino.pathname}${destino.search}` } });
  } catch (error) {
    const motivo = error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    console.error("[hestiat] /api/admin/catalogo", motivo);
    return NextResponse.json({ ok: false, error: "No se han podido guardar los cambios." }, { status: 500 });
  }
}
