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

/**
 * ¿Esta línea del cuerpo es un título de sección?
 *
 * Los títulos del cuerpo van en mayúsculas (por ejemplo «CÓMO ELEGIR ZONA»). Se detectan para
 * servirlos como encabezados <h2> de verdad, que es lo que necesitan un buscador y un lector de
 * pantalla. La detección es deliberadamente conservadora: una línea solo cuenta como título si
 * tiene al menos cuatro letras y ninguna minúscula, y nunca si es una dirección.
 */
export function esTituloDeSeccion(linea: string): boolean {
  const t = String(linea ?? "").trim();
  if (t.length < 6 || t.length > 130) return false;
  if (/^https?:\/\//i.test(t)) return false;
  const letras = t.replace(/[^\p{L}]/gu, "");
  if (letras.length < 4) return false;
  return letras === letras.toUpperCase();
}

/**
 * Fecha de publicación en ISO 8601.
 *
 * El servidor y MariaDB van en UTC (comprobado: zona Etc/UTC y NOW() igual a UTC_TIMESTAMP()), así
 * que la fecha guardada se publica tal cual con el desfase +00:00. Si no hay fecha, no se inventa
 * ninguna: devuelve undefined y el dato estructurado simplemente no la lleva.
 */
export function fechaISO(valor: unknown): string | undefined {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const s = String(valor).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+00:00`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
