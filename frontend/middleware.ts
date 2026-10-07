import { NextResponse, type NextRequest } from "next/server";

/**
 * Portero del editor.
 *
 * Motivo: la comprobación de sesión dentro de la página llega **después** de que la respuesta haya
 * empezado a enviarse, así que el navegador recibía un 200 con la página de «no encontrado» dentro.
 * El contenido era correcto (no se filtraba nada), pero el código de estado no, y eso importa: lo
 * leen los buscadores, los monitores y cualquier cliente.
 *
 * El middleware actúa ANTES de renderizar, así que devuelve un 307 de verdad. Solo comprueba que
 * exista la cookie: no valida la sesión ni la propiedad del alojamiento —eso se sigue comprobando en
 * el servidor, en la página y en cada guardado— porque el middleware no debe consultar la base de
 * datos. Si el token no vale, la página lo rechazará igual.
 */
/**
 * Páginas del panel antiguo que ahora viven dentro del editor único. Se redirigen AQUÍ, antes de
 * renderizar, para que el código de estado sea un 307 de verdad y no un 200 con la orden de
 * redirección dentro de la página (lo que además obligaría a tener JavaScript encendido).
 */
const PESTANAS_DEL_EDITOR: Record<string, string> = {
  "/host/precios": "precios",
  "/host/calendario": "disponibilidad",
  "/host/integraciones": "calendarios",
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get("hestiat_sesion")?.value;

  // Las tres rutas antiguas llevan al editor conservando el alojamiento seleccionado.
  const pestana = PESTANAS_DEL_EDITOR[request.nextUrl.pathname];
  if (pestana) {
    const id = Number(request.nextUrl.searchParams.get("a"));
    if (Number.isInteger(id) && id > 0) {
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      // Sin sesión se pasa por el inicio de sesión; con ella, directo a la pestaña.
      const destino = token
        ? new URL(`/editar/${id}?pestana=${pestana}`, `${proto}://${host}`)
        : new URL(`/login?volver=${encodeURIComponent(`/editar/${id}?pestana=${pestana}`)}`, `${proto}://${host}`);
      return NextResponse.redirect(destino);
    }
  }

  if (token) return NextResponse.next();

  // Detrás de nginx la aplicación se ve a sí misma como localhost:3000, así que construir la
  // redirección con `request.url` mandaba al navegador a localhost:3000/login — una dirección rota.
  // El destino se arma con el host real que ve el visitante.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const destino = new URL("/login", `${proto}://${host}`);
  destino.searchParams.set("volver", request.nextUrl.pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // Toda la zona que exige sesión. Antes estas rutas respondían 200 con la página de «no
  // encontrado» o con un redirect interno; ahora responden 307 de verdad, que es lo que espera
  // cualquier cliente.
  matcher: ["/editar/:path*", "/favoritos", "/perfil", "/host/:path*", "/admin/:path*"],
};
