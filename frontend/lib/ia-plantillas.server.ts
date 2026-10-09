/**
 * PLANTILLAS DE CORREO PARA LA CAPTACIÓN — SOLO SERVIDOR.
 *
 * QUÉ DICEN Y QUÉ NO
 *   · Identidad clara de Hestiat y motivo del contacto.
 *   · La ventaja real: publicar es gratis, sin cuotas de publicación y sin comisiones de Hestiat.
 *   · Enlace real a https://hestiat.com (no a una landing inventada).
 *   · Cómo dejar de recibir mensajes, en el pie de todos los correos.
 *
 *   · NO prometen reservas, ingresos ni resultados. No se dice «tendrás más clientes» ni «aumenta tus
 *     reservas»: no se puede garantizar y sería engañoso.
 *
 * AVISO LEGAL QUE HAY QUE LEER ANTES DE USARLAS
 *   Escribir a una empresa para ofrecerle un servicio gratuito es comunicación comercial. Antes de
 *   enviar nada hay que comprobar la norma aplicable al país del destinatario y el tipo de dirección:
 *   en la Unión Europea, la Directiva 2002/58 y el RGPD exigen interés legítimo documentado y un
 *   mecanismo de oposición claro; en España, además, el artículo 21 de la LSSI. Estas plantillas
 *   incluyen la oposición, pero **la base jurídica de cada envío la tiene que valorar una persona**.
 *   Por eso ningún correo sale sin aprobación humana.
 */

export interface Plantilla {
  id: string;
  /** A quién va dirigida. */
  destinatario: string;
  asunto: string;
  cuerpo: string;
  /** Por qué se escribe a este tipo de negocio. */
  motivo: string;
}

const PIE = `— 
Hestiat · https://hestiat.com · hola@hestiat.com

Escribimos a direcciones profesionales publicadas por el propio negocio. Si no quieres recibir más
mensajes nuestros, responde a este correo con la palabra BAJA y no volveremos a escribirte.`;

export const PLANTILLAS: Plantilla[] = [
  {
    id: "alojamientos",
    destinatario: "Propietarios de alojamientos y apartamentos turísticos",
    motivo: "Su alojamiento ya aparece en el catálogo de Hestiat o está en su provincia.",
    asunto: "Tu alojamiento en Hestiat, sin cuotas ni comisiones",
    cuerpo: `Hola:

Somos Hestiat, una web española donde se pueden encontrar alojamientos, experiencias y servicios de toda España.

Te escribimos porque tu alojamiento encaja en lo que ya se busca en Hestiat. Publicar es gratis: no hay
cuota de publicación, ni cuota mensual, ni comisión de Hestiat por reserva. El precio que pongas es el
precio que ve quien te reserva.

Si quieres, puedes reclamar tu ficha y completarla con tus fotos, tu disponibilidad y tus precios:
https://hestiat.com/hazte-anfitrion

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "casas-rurales",
    destinatario: "Casas rurales",
    motivo: "Aparecen en el catálogo procedentes de fuentes públicas y su ficha suele estar incompleta.",
    asunto: "Tu casa rural en Hestiat: publicar es gratis",
    cuerpo: `Hola:

Somos Hestiat (https://hestiat.com). En el catálogo hay muchas casas rurales cuyos datos vienen de
fuentes públicas, así que la ficha puede estar incompleta o con una foto que no es la tuya.

Puedes reclamarla y dejarla como quieras: fotos propias, precios, calendario. Publicar es gratis: sin
cuota de publicación y sin comisión de Hestiat. Y si la ficha no debería estar, dínoslo y la revisamos.

Reclamar tu ficha: https://hestiat.com/reclamar

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "hoteles-hostales",
    destinatario: "Hoteles, hostales y pensiones",
    motivo: "Su establecimiento figura en el catálogo con datos de fuentes públicas.",
    asunto: "Tu establecimiento en Hestiat (publicar no cuesta nada)",
    cuerpo: `Hola:

Te escribimos desde Hestiat (https://hestiat.com), una web de alojamientos, experiencias y servicios
en España. Tu establecimiento aparece en el catálogo con datos que proceden de fuentes públicas.

Publicar en Hestiat no tiene coste: ni cuota de publicación ni comisión por reserva. Si quieres tomar
el control de la ficha (fotos, precios, disponibilidad y reservas), puedes reclamarla aquí:
https://hestiat.com/reclamar

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "campings",
    destinatario: "Campings y alojamientos al aire libre",
    motivo: "Queremos que su ficha esté al día y a su nombre.",
    asunto: "Campings en Hestiat: ficha gratis y sin comisiones",
    cuerpo: `Hola:

Somos Hestiat (https://hestiat.com). Publicar tu camping no tiene coste: sin cuota de publicación y
sin comisión de Hestiat por reserva. El pago se acuerda directamente con quien te reserva.

Si quieres reclamar tu ficha y completarla con tus datos reales:
https://hestiat.com/hazte-anfitrion

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "experiencias",
    destinatario: "Organizadores de experiencias y actividades",
    motivo: "Sus actividades encajan en el catálogo de experiencias.",
    asunto: "Publica tus experiencias en Hestiat, sin coste",
    cuerpo: `Hola:

Somos Hestiat (https://hestiat.com), donde además de alojamientos se publican experiencias y actividades.

Organizas actividades y puedes publicarlas gratis: no hay cuota de publicación ni comisión de Hestiat.
Cada experiencia tiene su ficha con su ubicación y su precio cuando lo publicas.

Puedes darla de alta aquí: https://hestiat.com/publicar-experiencia
(las altas pasan una revisión antes de publicarse)

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "servicios",
    destinatario: "Proveedores de servicios turísticos",
    motivo: "Ofrecen servicios que encajan en las categorías del catálogo.",
    asunto: "Publica tu servicio en Hestiat, sin cuotas ni comisiones",
    cuerpo: `Hola:

Somos Hestiat (https://hestiat.com). En el catálogo hay servicios de todo tipo: bienestar, transporte,
gastronomía, visitas guiadas y más.

Publicar tu servicio es gratis: sin cuota de publicación y sin comisión de Hestiat. Cada servicio tiene
su ficha con su ubicación y su precio cuando lo publicas.

Alta de servicios: https://hestiat.com/publicar-servicio

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
  {
    id: "agencias",
    destinatario: "Agencias y gestores de alojamientos",
    motivo: "Gestionan varias propiedades que pueden estar en el catálogo.",
    asunto: "Gestionas varios alojamientos: en Hestiat se publican gratis",
    cuerpo: `Hola:

Somos Hestiat (https://hestiat.com), una web española de alojamientos, experiencias y servicios.

Si gestionas varias propiedades, cada una se publica gratis: sin cuota de publicación, sin cuota
mensual y sin comisión de Hestiat por reserva. Todas se gestionan desde el mismo panel: calendario,
precios, fotos y reservas.

Más información: https://hestiat.com/hazte-anfitrion

Si prefieres que no volvamos a escribirte, responde con la palabra BAJA.

${PIE}`,
  },
];

export function plantillaDe(id: string): Plantilla | null {
  return PLANTILLAS.find((p) => p.id === id) ?? null;
}

/**
 * Personaliza una plantilla SIN inventar datos: solo sustituye lo que se sepa de verdad.
 * Si falta la empresa o la localidad, se deja un texto neutro (nunca «Hola [EMPRESA]»).
 */
export function personalizar(plantilla: Plantilla, datos: { empresa?: string | null; localidad?: string | null; contacto?: string | null }) {
  const saludo = datos.contacto ? `Hola ${datos.contacto}:` : "Hola:";
  const sitio = [datos.empresa, datos.localidad].filter(Boolean).join(", ");
  const cuerpo = plantilla.cuerpo
    .replace(/^Hola:/, saludo)
    .replace(/tu alojamiento encaja/i, sitio ? `«${sitio}» encaja` : "tu alojamiento encaja");
  return { asunto: plantilla.asunto, cuerpo };
}

/** Comprobación antes de proponer un envío: nada sale sin estos cinco elementos. */
export function plantillaCompleta(plantilla: Plantilla): { ok: boolean; faltan: string[] } {
  const texto = `${plantilla.asunto}\n${plantilla.cuerpo}`.toLowerCase();
  const faltan: string[] = [];
  if (!texto.includes("hestiat")) faltan.push("identidad de Hestiat");
  if (!texto.includes("gratis") && !texto.includes("no tiene coste") && !texto.includes("sin cuota")) faltan.push("ventaja de publicar gratis");
  if (!plantilla.cuerpo.includes("https://hestiat.com")) faltan.push("enlace real a Hestiat");
  if (!texto.includes("baja")) faltan.push("forma de dejar de recibir comunicaciones");
  if (!/porque|te escribimos/i.test(plantilla.cuerpo)) faltan.push("motivo del contacto");
  const promesas = ["reservas garantizadas", "ingresos", "más clientes garantizados", "aumenta tus reservas"];
  const prohibidas = promesas.filter((p) => texto.includes(p));
  if (prohibidas.length) faltan.push(`promesas que no se pueden hacer: ${prohibidas.join(", ")}`);
  return { ok: faltan.length === 0, faltan };
}
