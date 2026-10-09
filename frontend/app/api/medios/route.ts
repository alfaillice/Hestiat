import { NextResponse } from "next/server";
import { getCurrentUser, ownsListing } from "@/lib/auth.server";
import { poolLegacy } from "@/lib/db";
import { guardarImagenOptimizada, urlsDeVariantes, borrarImagen, extensionDeMime } from "@/lib/almacen.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Medios de un alojamiento — subida, reordenación y borrado.
 *
 * Es el portado del pipeline de la aplicación antigua: misma optimización, mismas variantes
 * (`-completa`, `-w800`, `-w400`), claves por contenido y las mismas reglas de borrado.
 *
 * Autorización en cada petición, en servidor y con DOS comprobaciones: que haya sesión de
 * anfitrión y que ese alojamiento sea suyo. Una ruta de API es un endpoint público: no basta con
 * que la página que la invoca esté protegida.
 */
import { reflejarBorrado, reflejarOrden, reflejarSubida } from "@/lib/fotos-publicas.server";
import { limitar } from "@/lib/limite.server";

/**
 * LÍMITES DE ESTA RUTA.
 *
 * Comprobado en producción: la autorización estaba bien (401 sin sesión, 403 si el alojamiento no
 * es tuyo, 200 para el dueño y para administración), el formato se validaba y la subida real y el
 * borrado funcionaban. Lo que NO había era ningún tope: ni de tamaño, ni de número de ficheros, ni
 * de número de identificadores, ni de ritmo de peticiones. Se comprobó que un cuerpo grande llegaba
 * a dejar la respuesta en 504 y que 60 peticiones seguidas no encontraban ni una sola negativa (429).
 *
 * Estos topes NO sustituyen a la autorización: se aplican ANTES de leer el cuerpo, para no gastar
 * memoria en algo que se va a rechazar. Nada de lo que había se ha quitado.
 */
const MAX_PETICION = 12 * 1024 * 1024; // 12 MB por petición (nginx corta en 30m)
const MAX_FICHERO = 8 * 1024 * 1024; // 8 MB por imagen
const MAX_FICHEROS = 12; // imágenes por subida
const MAX_IDS = 500; // identificadores por reordenación
const MAX_PETICIONES = 60; // peticiones por minuto

type Peticion =
  | { accion: "subir"; alojamientoId: number; ficheros: File[] }
  | { accion: "reordenar"; alojamientoId: number; ids: number[] }
  | { accion: "principal"; alojamientoId: number; fotoId: number }
  | { accion: "eliminar"; alojamientoId: number; fotoId: number };

/**
 * Autorización: anfitrión dueño del alojamiento **o administrador**. El editor es el mismo para los
 * dos, así que el gestor de fotos tiene que aceptar a los dos; si solo aceptara anfitriones, un
 * administrador no podría subir fotos desde el editor compartido.
 */
async function autorizar(alojamientoId: number) {
  const sesion = await getCurrentUser();
  if (!sesion) return { ok: false as const, error: "Necesitas iniciar sesión.", codigo: 401 };
  if (sesion.rol === "admin") return { ok: true as const, host: sesion };
  if (sesion.rol !== "anfitrion" || !(await ownsListing(sesion.id, alojamientoId))) {
    return { ok: false as const, error: "Ese alojamiento no es tuyo.", codigo: 403 };
  }
  return { ok: true as const, host: sesion };
}

async function siguienteOrden(alojamientoId: number): Promise<number> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT COALESCE(MAX(orden), 0) AS ultimo FROM alojamiento_foto WHERE alojamiento_id = ?`,
    [alojamientoId],
  );
  return Number(filas[0]?.ultimo ?? 0) + 1;
}

export async function POST(request: Request) {
  const bloqueo = limitar(request, "medios", MAX_PETICIONES);
  if (bloqueo) return bloqueo;

  let cuerpo: Peticion;
  try {
    cuerpo = (await request.json()) as Peticion;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const alojamientoId = Number((cuerpo as { alojamientoId?: unknown }).alojamientoId);
  if (!Number.isFinite(alojamientoId) || alojamientoId <= 0) {
    return NextResponse.json({ ok: false, error: "Alojamiento no válido." }, { status: 400 });
  }

  const permiso = await autorizar(alojamientoId);
  if (!permiso.ok) return NextResponse.json({ ok: false, error: permiso.error }, { status: permiso.codigo });

  try {
    // Elegir la foto principal: pasa a la primera posición y con ella se ordena el catálogo público.
    if (cuerpo.accion === "principal") {
      const fotoId = Number(cuerpo.fotoId);
      const [ordenActual] = await poolLegacy.query<any[]>(
        `SELECT id FROM alojamiento_foto WHERE alojamiento_id = ? ORDER BY (id = ?) DESC, orden ASC, id ASC`,
        [alojamientoId, fotoId],
      );
      let pos = 1;
      for (const fila of ordenActual) {
        await poolLegacy.query(`UPDATE alojamiento_foto SET orden = ? WHERE id = ?`, [pos, Number(fila.id)]);
        pos += 1;
      }
      const [urls] = await poolLegacy.query<any[]>(
        `SELECT url FROM alojamiento_foto WHERE alojamiento_id = ? ORDER BY orden ASC, id ASC`,
        [alojamientoId],
      );
      await reflejarOrden(alojamientoId, urls.map((u) => String(u.url)));
      return NextResponse.json({ ok: true, principal: fotoId });
    }

    if (cuerpo.accion === "reordenar") {
      const ids = cuerpo.ids.map(Number).filter((n) => Number.isFinite(n));
      // Un alojamiento no tiene miles de fotos: si llegan más, la petición no es legítima.
      if (ids.length > MAX_IDS) {
        return NextResponse.json(
          { ok: false, error: `Demasiadas fotos en una sola petición (máximo ${MAX_IDS}).` },
          { status: 400 },
        );
      }
      let orden = 1;
      for (const id of ids) {
        await poolLegacy.query(
          `UPDATE alojamiento_foto SET orden = ? WHERE id = ? AND alojamiento_id = ?`,
          [orden, id, alojamientoId],
        );
        orden += 1;
      }
      // El orden nuevo se refleja en el catálogo público: la primera pasa a ser la principal.
      const [urls] = await poolLegacy.query<any[]>(
        `SELECT url FROM alojamiento_foto WHERE alojamiento_id = ? ORDER BY orden ASC, id ASC`,
        [alojamientoId],
      );
      await reflejarOrden(alojamientoId, urls.map((u) => String(u.url)));
      return NextResponse.json({ ok: true, reordenadas: ids.length });
    }

    if (cuerpo.accion === "eliminar") {
      const [filas] = await poolLegacy.query<any[]>(
        `SELECT id, url, variantes FROM alojamiento_foto WHERE id = ? AND alojamiento_id = ? LIMIT 1`,
        [Number(cuerpo.fotoId), alojamientoId],
      );
      const foto = filas[0];
      if (!foto) return NextResponse.json({ ok: false, error: "Esa foto no existe en este alojamiento." }, { status: 404 });

      // Primero se quita la fila (la web deja de servirla) y después se liberan los objetos.
      await poolLegacy.query(`DELETE FROM alojamiento_foto WHERE id = ? AND alojamiento_id = ?`, [foto.id, alojamientoId]);
      // Y su reflejo en el catálogo público: si no, la foto desaparecería del panel pero seguiría
      // publicada en la ficha. Se identifica por la URL del objeto, que es única de ese alojamiento.
      await reflejarBorrado(alojamientoId, String(foto.url));
      const urls = [String(foto.url), ...urlsDeVariantes(foto.variantes)];
      let objetosBorrados = 0;
      for (const url of urls) {
        if (await borrarImagen(url)) objetosBorrados += 1;
      }
      return NextResponse.json({ ok: true, objetosBorrados });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error interno.";
    console.error("[hestiat] /api/medios", cuerpo.accion, mensaje);
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}

/** La subida va por multipart: los ficheros reales, no data URLs en JSON. */
export async function PUT(request: Request) {
  const bloqueo = limitar(request, "medios", MAX_PETICIONES);
  if (bloqueo) return bloqueo;

  // Antes de leer nada: si el cuerpo declarado ya pasa del tope, se corta aquí. Así no se reserva
  // memoria para una subida que no se va a aceptar.
  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declarado) && declarado > MAX_PETICION) {
    return NextResponse.json(
      { ok: false, error: `La subida supera el máximo de ${MAX_PETICION / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se han recibido ficheros." }, { status: 400 });
  }

  const alojamientoId = Number(formulario.get("alojamientoId"));
  if (!Number.isFinite(alojamientoId) || alojamientoId <= 0) {
    return NextResponse.json({ ok: false, error: "Alojamiento no válido." }, { status: 400 });
  }

  const permiso = await autorizar(alojamientoId);
  if (!permiso.ok) return NextResponse.json({ ok: false, error: permiso.error }, { status: permiso.codigo });

  const ficheros = formulario.getAll("fotos").filter((f): f is File => f instanceof File);
  if (ficheros.length === 0) {
    return NextResponse.json({ ok: false, error: "No se han recibido ficheros." }, { status: 400 });
  }
  if (ficheros.length > MAX_FICHEROS) {
    return NextResponse.json(
      { ok: false, error: `Demasiadas imágenes de una vez (máximo ${MAX_FICHEROS}).` },
      { status: 413 },
    );
  }

  const guardadas: { id: number; url: string; ancho: number; alto: number }[] = [];
  const errores: string[] = [];
  let orden = await siguienteOrden(alojamientoId);

  for (const fichero of ficheros) {
    if (fichero.size > MAX_FICHERO) {
      errores.push(`${fichero.name}: supera el máximo de ${MAX_FICHERO / 1024 / 1024} MB por imagen.`);
      continue;
    }
    const extension = extensionDeMime(fichero.type.split("/").pop() ?? "");
    if (!extension) {
      errores.push(`${fichero.name}: formato no admitido (solo JPG, PNG o WebP).`);
      continue;
    }
    try {
      const datos = new Uint8Array(await fichero.arrayBuffer());
      const guardada = await guardarImagenOptimizada(datos, extension, `alojamientos/${alojamientoId}`);
      const variantes = guardada.variantes.map((v) => v.url);
      const [res] = await poolLegacy.query<any>(
        `INSERT INTO alojamiento_foto (alojamiento_id, url, alt, orden, ancho, alto, variantes)
         VALUES (?,?,?,?,?,?,?)`,
        [
          alojamientoId,
          guardada.principal.url,
          fichero.name.slice(0, 255),
          orden,
          guardada.principal.ancho || null,
          guardada.principal.alto || null,
          JSON.stringify(variantes),
        ],
      );
      guardadas.push({
        id: Number(res.insertId),
        url: guardada.principal.url,
        ancho: guardada.principal.ancho,
        alto: guardada.principal.alto,
      });
      // Reflejo inmediato en el catálogo público: sin esto, la foto subida no aparecía en la ficha.
      await reflejarSubida(alojamientoId, {
        url: guardada.principal.url,
        alt: fichero.name.slice(0, 255),
        ancho: guardada.principal.ancho || null,
        alto: guardada.principal.alto || null,
        orden,
      });
      orden += 1;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "fallo desconocido";
      errores.push(`${fichero.name}: ${mensaje}`);
    }
  }

  if (guardadas.length === 0) {
    return NextResponse.json(
      { ok: false, error: errores[0] ?? "No se ha podido guardar ninguna foto.", errores },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, guardadas, errores });
}
