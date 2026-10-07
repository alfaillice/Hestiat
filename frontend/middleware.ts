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
export function middleware(request: NextRequest) {
  const token = request.cookies.get("hestiat_sesion")?.value;
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
