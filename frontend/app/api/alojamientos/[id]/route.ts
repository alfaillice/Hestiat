import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth.server";
import { limitar } from "@/lib/limite.server";
import { poolLegacy } from "@/lib/db";
import {
  guardarCaracteristicas,
  guardarGeneral,
  guardarPrecios,
  permisoEdicion,
} from "@/lib/editor.server";
import { cambiarPropietario, eliminarAlojamiento, guardarEstado, guardarReglas } from "@/lib/editor-estado.server";
import { borrarImagen } from "@/lib/almacen.server";

export const dynamic = "force-dynamic";

/**
 * Guardado del editor de alojamiento.
 *
 * Un solo punto de guardado para anfitriones y administradores: el permiso se comprueba aquí
 * (`permisoEdicion`), no en la interfaz. Es un POST de formulario normal, así que funciona sin
 * JavaScript, y responde con redirección + mensaje para que el resultado se vea siempre.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacyId = Number(id);
  const volver = `/editar/${id}`;

  const limitado = limitar(request, "editar-alojamiento", 120, 60);
  if (limitado) return limitado;

  const sesion = await getCurrentUser();
  const permiso = Number.isInteger(legacyId) ? await permisoEdicion(sesion ?? null, legacyId) : { puede: false, esAdmin: false, motivo: "Alojamiento no válido." };
  if (!permiso.puede) {
    return NextResponse.json({ ok: false, error: permiso.motivo ?? "Sin permiso." }, { status: permiso.motivo === "Necesitas iniciar sesión." ? 401 : 403 });
  }

  const f = await request.formData();
  const seccion = String(f.get("seccion") ?? "");
  // Secciones que solo puede tocar la administración: el estado de bloqueo y el cambio de
  // propietario. Eliminar NO está aquí: el anfitrión también puede borrar lo suyo, y esa regla se
  // comprueba justo debajo, con una consulta directa a la relación de propiedad.
  const SOLO_ADMIN = ["admin", "propietario"];
  if (SOLO_ADMIN.includes(seccion) && !permiso.esAdmin) {
    return NextResponse.json({ ok: false, error: "Solo un administrador puede hacer esto." }, { status: 403 });
  }

  // Eliminar: la administración sobre cualquiera; el anfitrión, solo sobre el suyo. No se fía de la
  // comprobación de arriba ni de que la interfaz haya escondido el botón: se vuelve a preguntar a la
  // base quién es el propietario. Un usuario normal no llega aquí siquiera (permiso denegado antes).
  if (seccion === "eliminar" && !permiso.esAdmin) {
    const [mia] = await poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS n FROM alojamiento_anfitrion WHERE alojamiento_id = ? AND usuario_id = ?`,
      [legacyId, Number(sesion!.id)],
    );
    if (Number(mia[0]?.n ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: "Ese alojamiento no es tuyo." }, { status: 403 });
    }
  }

  try {
    const resultado =
      seccion === "general"
        ? await guardarGeneral(legacyId, f)
        : seccion === "precios"
          ? await guardarPrecios(legacyId, f)
          : seccion === "caracteristicas"
            ? await guardarCaracteristicas(legacyId, f)
            : seccion === "reglas"
              ? await guardarReglas(legacyId, f)
              : seccion === "publicacion" || seccion === "admin"
                ? await guardarEstado(legacyId, f, permiso.esAdmin)
                : seccion === "propietario"
                  ? await cambiarPropietario(legacyId, f)
                  : seccion === "eliminar"
                    ? await eliminarAlojamiento(legacyId, borrarImagen, String(f.get("confirmacion") ?? ""))
                    : { ok: false as const, error: "Sección desconocida." };

    // Tras eliminar NO se puede volver al editor: el alojamiento ya no existe y la respuesta sería
    // un 404. Se lleva a la persona a su listado, con el mensaje de lo que acaba de pasar.
    const destino = resultado.ok
      ? seccion === "eliminar"
        ? `${permiso.esAdmin ? "/admin/alojamientos" : "/host"}?aviso=${encodeURIComponent(resultado.mensaje)}&ok=1`
        : `${volver}?seccion=${seccion}&ok=${encodeURIComponent(resultado.mensaje)}`
      : `${volver}?seccion=${seccion}&error=${encodeURIComponent(resultado.error)}`;

    // Si el navegador pide JSON (guardado sin recargar), se responde JSON; si es un formulario
    // normal, se redirige. Una sola implementación de servidor para los dos caminos.
    if ((request.headers.get("accept") ?? "").includes("application/json")) {
      return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
    }
    redirect(destino);
  } catch (error) {
    // `redirect()` no devuelve nada: lanza un error de control de flujo (NEXT_REDIRECT). Eso NO es
    // un fallo y hay que dejarlo pasar tal cual; si se anotara como error, el registro se llenaría
    // de ruido y taparía los fallos de verdad.
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;

    console.error("[hestiat] guardar alojamiento", legacyId, seccion, error);
    if ((request.headers.get("accept") ?? "").includes("application/json")) {
      return NextResponse.json({ ok: false, error: "No se han podido guardar los cambios." }, { status: 500 });
    }
    redirect(`${volver}?seccion=${seccion}&error=${encodeURIComponent("No se han podido guardar los cambios.")}`);
  }
}
