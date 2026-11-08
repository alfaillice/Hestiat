import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALTA DE EXPERIENCIAS Y SERVICIOS POR PARTE DE PROVEEDORES.
 *
 * Lo que llega aquí NO se publica: entra en la cola `solicitud_catalogo`, que administración revisa y
 * aprueba desde el panel. Así el catálogo (58.539 experiencias y 35.585 servicios) no se ensucia con
 * altas sin comprobar, y el alta es real en lugar de un formulario decorativo.
 *
 * Defensas: límite de peticiones, validación de todos los campos, campo trampa antispam y nada de SQL
 * construido con texto: todo va por parámetros.
 */
const MAX = { nombre: 255, categoria: 120, descripcion: 4000, municipio: 128, provincia: 128, direccion: 255, web: 512, telefono: 40, email: 191, organizador: 255 };

export async function POST(request: Request) {
  const excedido = limitar(request, "/api/solicitudes", 8, 60);
  if (excedido) return excedido;

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se entiende la petición." }, { status: 400 });
  }
  const texto = (clave: string, max: number) => String(formulario.get(clave) ?? "").trim().slice(0, max);

  const tipo = texto("tipo", 12);
  const volver = tipo === "servicio" ? "/publicar-servicio" : "/publicar-experiencia";
  const irA = (parametros: string) => {
    const destino = new URL(volver, request.url);
    destino.search = parametros;
    // Relativa: detrás del proxy la absoluta apunta al host interno.
    return new NextResponse(null, { status: 303, headers: { Location: `${destino.pathname}${destino.search}` } });
  };

  // Trampa antispam: si viene rellena, se descarta sin decir nada.
  if (String(formulario.get("web_extra") ?? "").trim() !== "") {
    return irA("?ok=1");
  }

  if (!["experiencia", "servicio"].includes(tipo)) {
    return NextResponse.json({ ok: false, error: "Tipo no válido." }, { status: 400 });
  }

  const nombre = texto("nombre", MAX.nombre);
  const municipio = texto("municipio", MAX.municipio);
  const provincia = texto("provincia", MAX.provincia);
  const email = texto("email", MAX.email);
  const web = texto("web", MAX.web);
  const telefono = texto("telefono", MAX.telefono) || null;
  const direccion = texto("direccion", MAX.direccion) || null;
  const descripcion = texto("descripcion", MAX.descripcion) || null;
  const organizador = texto("organizador", MAX.organizador) || null;
  const categoria = texto("categoria", MAX.categoria) || null;

  if (nombre.length < 2 || municipio.length < 2 || provincia.length < 2) {
    return irA("?error=1&aviso=" + encodeURIComponent("Faltan el nombre, el municipio o la provincia."));
  }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return irA("?error=1&aviso=" + encodeURIComponent("El correo de contacto no parece válido."));
  }
  if (web && !/^https?:\/\//i.test(web)) {
    return irA("?error=1&aviso=" + encodeURIComponent("La web debe empezar por http:// o https://"));
  }

  const precioCrudo = texto("precio", 12).replace(",", ".");
  const precio = precioCrudo === "" ? null : Number(precioCrudo);
  if (precio !== null && (!Number.isFinite(precio) || precio < 0 || precio > 1_000_000)) {
    return irA("?error=1&aviso=" + encodeURIComponent("El precio no es un número razonable."));
  }

  try {
    await pool.query(
      `INSERT INTO solicitud_catalogo
         (tipo, nombre, categoria, descripcion, municipio, provincia, direccion, web, telefono, email, precio, organizador)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tipo, nombre, categoria, descripcion, municipio, provincia, direccion, web, telefono, email, precio, organizador],
    );
    console.log(`[hestiat] solicitud de alta recibida: ${tipo} «${nombre}» (${municipio}, ${provincia})`);
    return irA("?ok=1");
  } catch (error) {
    const motivo = error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    console.error("[hestiat] /api/solicitudes", motivo);
    return irA("?error=1&aviso=" + encodeURIComponent("No se ha podido registrar la solicitud. Inténtalo de nuevo en un momento."));
  }
}
