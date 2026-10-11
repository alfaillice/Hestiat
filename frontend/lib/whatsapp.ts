/**
 * WHATSAPP DEL ANFITRIÓN.
 *
 * Este fichero no depende de nada (ni base de datos, ni sesiones): solo decide si un número sirve para
 * WhatsApp y arma el mensaje. Así se puede probar sin servidor y sin tocar datos.
 *
 * Reglas:
 *  · Solo se aceptan dígitos. Los separadores (espacios, guiones, paréntesis) se quitan.
 *  · Un móvil español de 9 dígitos que empiece por 6 o 7 se completa con el 34.
 *  · El resultado tiene que tener entre 8 y 15 dígitos: fuera de ahí no es un número utilizable y se
 *    devuelve null, para que NO se muestre un botón que llevaría a un contacto equivocado.
 */
export function normalizarWhatsapp(bruto: string | null | undefined): string | null {
  const limpio = String(bruto ?? "").replace(/[^\d+]/g, "");
  if (!limpio) return null;
  let d = limpio.startsWith("+") ? limpio.slice(1) : limpio;
  if (d.startsWith("00")) d = d.slice(2);
  if (/^[67]\d{8}$/.test(d)) d = "34" + d;
  if (!/^\d{8,15}$/.test(d)) return null;
  return d;
}

/** Enlace de WhatsApp, con el mensaje ya escrito para que la persona lo revise y lo envíe. */
export function enlaceWhatsapp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/** Mensaje inicial en español: dice el alojamiento y lleva su ficha. No se envía solo. */
export function mensajeWhatsapp(titulo: string, enlaceFicha: string): string {
  return `Hola, he visto «${titulo}» en Hestiat y quería preguntar por su disponibilidad. Te dejo la ficha: ${enlaceFicha}`;
}
