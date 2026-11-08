/*
 * Declaraciones para las dependencias de imagen que vienen SIN tipos.
 *
 * `jpeg-js` y `pngjs` son CommonJS sin `@types`, y `optimizar.server.ts` los importa tal cual
 * porque ese código se ha portado sin tocar la lógica. Declararlos aquí evita reescribir el
 * portado solo para satisfacer al compilador.
 */
declare module "jpeg-js";
declare module "pngjs";
