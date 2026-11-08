/**
 * Limitación de peticiones — SOLO servidor.
 *
 * Por qué hace falta: las rutas de API de Hestiat son públicas y crean datos (cuentas, reservas,
 * reclamaciones). Sin límite, cualquiera puede inundarlas, crear cientos de cuentas o bloquear
 * noches en masa.
 *
 * Cómo funciona: cubo de fichas por (ruta + IP). Cada cubo tiene un máximo de fichas y se recarga
 * de forma proporcional al tiempo transcurrido. Una petición consume una ficha; sin fichas, 429.
 *
 * Es en memoria del proceso: esta aplicación corre como **un solo proceso**, así que es exacto.
 * Si algún día se escala a varios procesos habría que moverlo a un almacén compartido (Redis), y
 * eso queda anotado como limitación conocida.
 */
import { NextResponse } from "next/server";

interface Cubo {
  fichas: number;
  ultimo: number;
}

const cubos = new Map<string, Cubo>();
const MAX_CLAVES = 5000;

/** IP del cliente. Detrás de nginx llega en las cabeceras de reenvío. */
export function ipDe(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}

/**
 * Consume una ficha. Devuelve `null` si se permite, o una respuesta 429 lista para devolver.
 *
 * @param maximo  peticiones permitidas por ventana
 * @param ventana segundos de la ventana
 */
export function limitar(request: Request, ruta: string, maximo = 20, ventana = 60): NextResponse | null {
  const ahora = Date.now();
  const clave = `${ruta}|${ipDe(request)}`;

  // Poda: si el mapa crece demasiado, se descartan los cubos que ya están llenos (inactivos).
  if (cubos.size > MAX_CLAVES) {
    for (const [k, v] of cubos) {
      if (v.fichas >= maximo) cubos.delete(k);
      if (cubos.size <= MAX_CLAVES * 0.8) break;
    }
  }

  const c = cubos.get(clave) ?? { fichas: maximo, ultimo: ahora };
  const transcurrido = ahora - c.ultimo;
  c.fichas = Math.min(maximo, c.fichas + (transcurrido / (ventana * 1000)) * maximo);
  c.ultimo = ahora;

  if (c.fichas < 1) {
    cubos.set(clave, c);
    const segundos = Math.max(1, Math.ceil(((1 - c.fichas) * ventana * 1000) / maximo / 1000));
    return NextResponse.json(
      { ok: false, error: "Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo." },
      { status: 429, headers: { "Retry-After": String(segundos) } },
    );
  }

  c.fichas -= 1;
  cubos.set(clave, c);
  return null;
}

/** Poda periódica para que el mapa no crezca sin control en procesos de larga vida. */
export function podarLimites(): void {
  const ahora = Date.now();
  for (const [k, v] of cubos) {
    if (ahora - v.ultimo > 10 * 60 * 1000) cubos.delete(k);
  }
}
