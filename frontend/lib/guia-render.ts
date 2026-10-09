/**
 * CUERPO DE UNA GUÍA: TEXTO Y ENLACES.
 *
 * El cuerpo de una guía se guarda como texto plano. Esta función lo parte en trozos:
 * lo que es una dirección pasa a ser un enlace, y todo lo demás se queda igual.
 *
 * Regla que no se rompe nunca: el texto NO cambia. Al pegar los trozos en orden sale
 * exactamente el cuerpo original, carácter a carácter. Eso es lo que comprueba la
 * prueba automática, para que nadie pueda colar una edición del texto por esta vía.
 */

export type Trozo =
  | { tipo: "texto"; valor: string }
  | { tipo: "enlace"; valor: string; href: string; interno: boolean };

/** Cualquier dirección http o https. */
const DIRECCION = /(https?:\/\/[^\s<>"']+)/g;

/** Puntuación que se escribe después de una dirección y no forma parte de ella. */
const PUNTUACION = /[.,;:!?)\]]+$/;

export function trozosDelCuerpo(cuerpo: string): Trozo[] {
  const texto = String(cuerpo ?? "");
  const trozos: Trozo[] = [];
  let ultimo = 0;
  for (const encontrado of texto.matchAll(DIRECCION)) {
    const bruto = encontrado[1];
    const inicio = encontrado.index ?? 0;
    const limpia = bruto.replace(PUNTUACION, "");
    const cola = bruto.slice(limpia.length);
    if (inicio > ultimo) trozos.push({ tipo: "texto", valor: texto.slice(ultimo, inicio) });
    if (limpia) {
      trozos.push({
        tipo: "enlace",
        valor: limpia,
        href: limpia,
        interno: /^https:\/\/(www\.)?hestiat\.com\//.test(limpia),
      });
    }
    if (cola) trozos.push({ tipo: "texto", valor: cola });
    ultimo = inicio + bruto.length;
  }
  if (ultimo < texto.length) trozos.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return trozos;
}

/**
 * El cuerpo reconstruido a partir de los trozos. Tiene que ser idéntico al original:
 * es la comprobación de que convertir las direcciones en enlaces no toca ni una letra.
 */
export function textoReconstruido(trozos: Trozo[]): string {
  return trozos.map((t) => t.valor).join("");
}
