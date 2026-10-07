import { NextResponse } from "next/server";

/**
 * Redirección para los POST de formulario.
 *
 * Una sola implementación para todas las rutas de API (nada de repetirla).
 *
 * El `Location` es RELATIVO a propósito: detrás de nginx la aplicación se ve a sí misma como
 * `localhost:3000`, así que una URL absoluta construida desde `request.url` mandaría al usuario a
 * localhost. Una ruta relativa la resuelve el navegador contra el dominio público real.
 *
 * Se usa 303 (See Other) para que el navegador vuelva a pedir la página con GET: así, si alguien
 * recarga, no reenvía el formulario.
 */
export function redirigir(ruta: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: ruta } });
}
