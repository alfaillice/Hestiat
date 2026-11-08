import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { configR2, subirObjeto, urlPublica } from "@/lib/r2.server";
import { sePuedeCopiar } from "@/lib/imagen-propia";

/**
 * IMÁGENES PROPIAS — trae una copia de una imagen de terceros a nuestro almacén y la sirve desde ahí.
 *
 * POR QUÉ EXISTE: las fotos de las tarjetas se cargaban desde Wikimedia, que limita las peticiones
 * (se midió un `429`) y añade latencia ajena. Con esto, el navegador solo habla con nosotros.
 *
 * CÓMO FUNCIONA, paso a paso:
 *   1. Se valida la dirección: solo https y solo de la lista blanca de `lib/imagen-propia.ts`. Así
 *      esto no puede usarse como puerta abierta hacia cualquier servidor.
 *   2. Si la copia YA está en nuestro almacén, se responde con una redirección a su dirección
 *      pública: se sirve desde el almacén, sin descargar nada de nuevo.
 *   3. Si no está, se descarga UNA vez (con límite de tiempo y de tamaño), se guarda y se redirige.
 *   4. Si algo falla, se redirige a la dirección original: la página nunca pierde la imagen por
 *      culpa de esto.
 *
 * La clave del objeto depende de la dirección y del ancho, así que la misma imagen pedida dos veces
 * se descarga una sola vez en toda la vida del sitio.
 */
export const runtime = "nodejs";

/** Ancho razonable: ni ridículamente pequeño ni una foto de 20 MB. */
const ANCHO_MIN = 80;
const ANCHO_MAX = 2400;
/** Tope del fichero que aceptamos traernos (8 MB). */
const TAMANO_MAX = 8 * 1024 * 1024;
/** Tiempo máximo de descarga. */
const TIEMPO_MAX_MS = 8000;

function claveDe(url: string, ancho: number): string {
  const huella = createHash("sha256").update(`${url}|${ancho}`).digest("hex").slice(0, 40);
  const extension = url.toLowerCase().includes(".png") ? "png" : "jpg";
  return `espejo/${huella}.${extension}`;
}

/** Añade (o cambia) el ancho pedido a la dirección original, para traerse la variante pequeña. */
function conAncho(url: string, ancho: number): string {
  if (/[?&]width=\d+/.test(url)) return url.replace(/([?&]width=)\d+/, `$1${ancho}`);
  return url;
}

async function existeEnAlmacen(destino: string): Promise<boolean> {
  try {
    const respuesta = await fetch(destino, { method: "HEAD", cache: "no-store" });
    return respuesta.ok;
  } catch {
    return false;
  }
}

export async function GET(peticion: Request) {
  const parametros = new URL(peticion.url).searchParams;
  const original = parametros.get("u") ?? "";
  const anchoPedido = Number(parametros.get("w") ?? 0);
  const ancho = Number.isFinite(anchoPedido) && anchoPedido > 0
    ? Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, Math.round(anchoPedido)))
    : 0;

  // Puerta cerrada: solo direcciones válidas y de la lista blanca.
  if (!sePuedeCopiar(original)) {
    return NextResponse.json({ ok: false, error: "Dirección no admitida." }, { status: 400 });
  }

  const cfg = configR2();
  const fuente = ancho ? conAncho(original, ancho) : original;

  // Sin almacén configurado no se puede copiar: se sirve la original, que es lo honesto.
  if (!cfg) {
    return NextResponse.redirect(fuente, 302);
  }

  const clave = claveDe(original, ancho || 0);
  const destino = urlPublica(cfg, clave);

  // 1. ¿Ya la tenemos? Se sirve desde el almacén, sin volver a descargarla nunca.
  if (await existeEnAlmacen(destino)) {
    return NextResponse.redirect(destino, 302);
  }

  // 2. Traer una copia, una sola vez.
  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIEMPO_MAX_MS);
    const respuesta = await fetch(fuente, {
      signal: control.signal,
      cache: "no-store",
      headers: { "user-agent": "Hestiat/1.0 (+https://hestiat.com; copia de imagen de referencia)" },
    });
    clearTimeout(reloj);

    const tipo = respuesta.headers.get("content-type") ?? "";
    if (!respuesta.ok || !tipo.startsWith("image/")) {
      return NextResponse.redirect(fuente, 302);
    }

    const datos = new Uint8Array(await respuesta.arrayBuffer());
    if (datos.byteLength === 0 || datos.byteLength > TAMANO_MAX) {
      return NextResponse.redirect(fuente, 302);
    }

    // 3. Guardar la copia y servirla desde casa.
    await subirObjeto(clave, datos, tipo.split(";")[0]);
    return NextResponse.redirect(urlPublica(cfg, clave), 302);
  } catch {
    // 4. Si no se pudo traer (por ejemplo, un límite temporal del origen), se sirve la original:
    //    la imagen se ve igual y no se rompe nada.
    return NextResponse.redirect(fuente, 302);
  }
}
