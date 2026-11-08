/**
 * Tipo de catálogo pedido en una URL: experiencias o servicios.
 *
 * Vive aquí, separado de la ruta, por dos razones: una sola implementación para todos los sitios que
 * lo necesiten, y poder probarlo sin levantar el servidor ni tocar la base de datos.
 *
 * Acepta el valor en inglés y en español. Un valor NO reconocido devuelve `null`, que quien llama
 * debe traducir a un error explícito: antes, cualquier valor que no fuese exactamente «service»
 * caía en experiencias sin avisar, de modo que un tipo mal escrito devolvía datos equivocados con
 * respuesta correcta.
 */
export type TipoLista = "service" | "experience";

const EQUIVALENCIAS: Record<string, TipoLista> = {
  service: "service",
  servicios: "service",
  servicio: "service",
  servicio_turistico: "service",
  experience: "experience",
  experiencias: "experience",
  experiencia: "experience",
};

/**
 * Normaliza el tipo pedido.
 *
 * · Un valor reconocido devuelve su forma canónica.
 * · Un valor vacío o ausente devuelve `experience`, que es el comportamiento que ya existía.
 * · Cualquier otra cosa devuelve `null`: el llamador responde 400.
 */
export function normalizarTipoCatalogo(valor: string | null | undefined): TipoLista | null {
  const crudo = (valor ?? "").trim().toLowerCase();
  if (crudo === "") return "experience";
  return EQUIVALENCIAS[crudo] ?? null;
}

/** ¿Es un tipo canónico válido? */
export function esTipoLista(valor: unknown): valor is TipoLista {
  return valor === "service" || valor === "experience";
}
