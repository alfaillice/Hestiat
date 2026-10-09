/**
 * CONOCIMIENTO PÚBLICO DE HESTIAT — una sola fuente para la web Y para el agente.
 *
 * De aquí salen dos cosas y las dos dicen exactamente lo mismo:
 *   · la página /preguntas-frecuentes, que ya se servía desde este mismo texto;
 *   · las herramientas `search_public_faq` y `get_help_article` del agente, que responden al
 *     usuario con esta información en vez de improvisarla.
 *
 * REGLAS DE ESTE FICHERO
 *   1. Nada de datos inventados: cada artículo es un resumen de lo que la web dice de verdad y
 *      lleva el enlace a la página donde está escrito con todo detalle.
 *   2. Si algo NO está decidido todavía (por ejemplo, la política de cancelación), se dice que no
 *      está definido y se ofrece pasar el caso a una persona. No se rellena el hueco a la ligera.
 *   3. Si una respuesta depende de un dato concreto (un precio, una reserva, una publicación), aquí
 *      no se responde: el agente tiene que consultarlo con sus herramientas.
 */

export interface PreguntaFrecuente {
  id: string;
  q: string;
  a: string;
  /** Enlace opcional que la página muestra dentro de la respuesta. */
  enlace?: { texto: string; href: string };
}

export interface ArticuloAyuda {
  id: string;
  titulo: string;
  resumen: string;
  /** Página real donde está explicado con detalle. */
  fuente: string;
  /** Palabras por las que el buscador del agente debe encontrarlo. */
  claves: string[];
  /** true = la información todavía no está cerrada y hay que derivar a una persona. */
  pendiente?: boolean;
}

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    id: "precio-consultar",
    q: "¿Por qué algunas fichas dicen «Consultar» en el precio?",
    a: "Porque esa ficha no tiene ningún precio publicado y no nos lo inventamos. Puedes preguntar directamente usando el teléfono o la web que sí aparezcan en la ficha.",
  },
  {
    id: "precio-orientativo",
    q: "¿Qué significa que un precio sea «orientativo»?",
    a: "Que procede de una tarifa publicada por el propio sitio (por ejemplo «desde 12 €») y todavía no es un precio confirmado. Se enseña marcado como orientativo, nunca como precio cerrado.",
  },
  {
    id: "fotos-procedencia",
    q: "¿Las fotos son del alojamiento o del negocio?",
    a: "En su mayoría son imágenes de referencia del entorno, y la ficha lo dice. Cuando se ha encontrado la imagen oficial del propio sitio, se muestra esa y se rotula como oficial. Nunca ponemos la foto de otro sitio en una ficha.",
  },
  {
    id: "datos-procedencia",
    q: "¿De dónde salen los datos del catálogo?",
    a: "De fuentes públicas como OpenStreetMap, con su autoría, y de lo que publican los propios anfitriones. Por eso puede haber fichas antiguas: si ves una que está mal, escríbenos o usa «reclamar una ficha».",
  },
  {
    id: "valoraciones",
    q: "¿Las valoraciones las generáis vosotros?",
    a: "No. Si una ficha muestra una valoración, es la que trae la fuente de la que procede el dato; no la calculamos ni la rellenamos nosotros.",
  },
  {
    id: "como-reservar",
    q: "¿Cómo reservo?",
    a: "Abre la ficha, elige fechas y número de personas y reserva. Recibirás la confirmación por correo y podrás consultar el estado de la reserva con su código.",
  },
  {
    id: "publicar-coste",
    q: "¿Puedo publicar mi alojamiento? ¿Tiene coste?",
    a: "Sí puedes publicarlo desde «Publica tu espacio» en la cabecera, y publicar no tiene coste en Hestiat. Después lo gestionas todo desde tu panel: calendario, precios, fotos y reservas.",
  },
  {
    id: "alojamiento-desconocido",
    q: "Veo un alojamiento de mi ciudad que no conozco.",
    a: "Es lo normal en un catálogo que arranca de fuentes públicas: recoge lo que ya estaba registrado. Si es tu negocio, reclama la ficha para completarla o corregirla; si es un error, cuéntanoslo y lo revisamos.",
  },
  {
    id: "retirar-ficha",
    q: "¿Puedo pedir que se retire una ficha?",
    a: "Sí. Escríbenos desde contacto o desde la reclamación de la ficha indicando cuál es, y se revisa.",
  },
];

export const ARTICULOS_AYUDA: ArticuloAyuda[] = [
  {
    id: "que-es-hestiat",
    titulo: "Qué es Hestiat",
    resumen:
      "Hestiat reúne alojamientos, experiencias y servicios de toda España. El catálogo arranca de fuentes públicas y se va completando con lo que publican los propios negocios. No es una agencia de viajes: no intermedia en el pago.",
    fuente: "https://hestiat.com/sobre",
    claves: ["que es hestiat", "hestiat", "catalogo", "empresa", "sobre"],
  },
  {
    id: "publicar-gratis",
    titulo: "Publicar es gratis y sin comisiones",
    resumen:
      "Publicar en Hestiat no cuesta nada: no hay comisión por reserva, ni cuota de publicación, ni cuota mensual. El precio que ponga el anfitrión es el precio que ve el huésped. La idea es que la web se sostenga más adelante con publicidad, no cobrando a los negocios.",
    fuente: "https://hestiat.com/hazte-anfitrion",
    claves: ["gratis", "coste", "comision", "cuota", "tarifa", "precio publicar", "publicar", "cobro", "mensualidad"],
  },
  {
    id: "como-publicar",
    titulo: "Cómo publicar un alojamiento",
    resumen:
      "Desde «Publica tu espacio» en la cabecera se crea la cuenta y se da de alta la ficha. Después, todo se gestiona desde el panel: calendario y disponibilidad, precios, fotos y reservas.",
    fuente: "https://hestiat.com/hazte-anfitrion",
    claves: ["publicar", "alta", "anfitrion", "panel", "crear ficha", "dar de alta"],
  },
  {
    id: "como-funciona-reserva",
    titulo: "Cómo funciona una reserva",
    resumen:
      "Se elige la ficha, las fechas y el número de personas. La reserva se registra y llega la confirmación por correo, y se puede consultar su estado con el código. En Hestiat no hay pasarela de pago: el pago se acuerda directamente con el anfitrión.",
    fuente: "https://hestiat.com/como-reservar",
    claves: ["reserva", "reservar", "reservas", "codigo", "confirmacion", "pago", "pagar", "pasarela"],
  },
  {
    id: "experiencias-y-servicios",
    titulo: "Experiencias y servicios",
    resumen:
      "Además de alojamientos, Hestiat tiene experiencias (planes y actividades) y servicios (peluquería, bienestar, transporte, gastronomía…). Cada uno tiene su ficha con su ubicación y, cuando está publicado, su precio.",
    fuente: "https://hestiat.com/experiencias",
    claves: ["experiencia", "experiencias", "servicio", "servicios", "actividades", "planes"],
  },
  {
    id: "registro-acceso",
    titulo: "Registro y acceso a la cuenta",
    resumen:
      "La cuenta se crea desde «Entrar» y se accede siempre con el correo y la contraseña. Ojo: ahora mismo no hay un sistema automático de recuperación de contraseña, así que si alguien no puede entrar hay que pasar el caso a una persona para resolverlo.",
    fuente: "https://hestiat.com/registro",
    claves: ["registro", "registrar", "cuenta", "entrar", "acceso", "login", "contrasena", "contraseña", "no puedo entrar", "recuperar"],
    pendiente: true,
  },
  {
    id: "editar-publicacion",
    titulo: "Editar una publicación",
    resumen:
      "El propietario edita su propia ficha desde su panel (calendario, precios, fotos y datos). El botón público «Editar publicación» que aparece en las fichas está reservado a la administración de Hestiat, y esa regla no se cambia desde una conversación: para editar la ficha de alguien hay que ser su titular y acreditarlo.",
    fuente: "https://hestiat.com/como-funciona",
    claves: ["editar", "edicion", "modificar publicacion", "cambiar ficha", "corregir ficha", "propietario"],
  },
  {
    id: "cancelaciones",
    titulo: "Cancelaciones",
    resumen:
      "La política de cancelación con plazos concretos todavía no está cerrada, así que no se puede prometer una fecha límite ni un importe: esos casos se pasan a una persona. Las reservas ya registradas se pueden consultar con su código y el anfitrión es quien acuerda las condiciones con el huésped.",
    fuente: "https://hestiat.com/cancelaciones",
    claves: ["cancelar", "cancelacion", "cancelaciones", "anular", "devolucion", "reembolso"],
    pendiente: true,
  },
  {
    id: "fotos-y-datos",
    titulo: "De dónde salen las fotos y los datos",
    resumen:
      "Los datos proceden de fuentes públicas, con su autoría, y de lo que publican los negocios. Las fotos son en su mayoría imágenes de referencia del entorno y así se indica en la ficha; cuando existe la imagen oficial del propio sitio, se muestra esa y se rotula como oficial.",
    fuente: "https://hestiat.com/preguntas-frecuentes",
    claves: ["fotos", "imagenes", "datos", "procedencia", "fuente", "openstreetmap", "licencia"],
  },
  {
    id: "reclamar-ficha",
    titulo: "Reclamar una ficha que es tuya",
    resumen:
      "Si una ficha es de tu negocio, se puede reclamar para completarla o corregirla; si es un error, se avisa y se revisa. También se puede pedir la retirada de una ficha escribiendo desde contacto.",
    fuente: "https://hestiat.com/reclamar",
    claves: ["reclamar", "reclamacion", "mi ficha", "es mio", "retirar", "borrar ficha", "corregir"],
  },
  {
    id: "problemas-tecnicos",
    titulo: "Problemas técnicos",
    resumen:
      "Si algo no carga, no deja reservar o da un error, se puede contar y se abre una incidencia. Conviene decir qué página, qué se estaba haciendo y, si se puede, una captura; así se resuelve mucho antes.",
    fuente: "https://hestiat.com/contacto",
    claves: ["error", "no funciona", "problema", "tecnico", "fallo", "no carga", "incidencia", "bug"],
  },
  {
    id: "contacto",
    titulo: "Contacto",
    resumen: "El correo de contacto de Hestiat es hola@hestiat.com.",
    fuente: "https://hestiat.com/contacto",
    claves: ["contacto", "correo", "email", "escribir", "hablar con alguien", "telefono", "persona"],
  },
  {
    id: "avisos-legales",
    titulo: "Aviso legal, privacidad y cookies",
    resumen:
      "Hestiat publica su aviso legal, su política de privacidad y su política de cookies, y cumple con el Reglamento General de Protección de Datos. No se usan rastreadores de publicidad ni de analítica de terceros.",
    fuente: "https://hestiat.com/privacidad",
    claves: ["legal", "privacidad", "cookies", "datos personales", "rgpd", "aviso legal", "condiciones"],
  },
];

/** Búsqueda sencilla pero real: por título, palabras clave y resumen. */
export function buscarArticulos(consulta: string, maximo = 5): ArticuloAyuda[] {
  const palabras = consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2);
  if (palabras.length === 0) return [];

  const puntuados = ARTICULOS_AYUDA.map((a) => {
    const texto = `${a.titulo} ${a.claves.join(" ")} ${a.resumen}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    let puntos = 0;
    for (const p of palabras) {
      if (a.claves.some((k) => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(p))) puntos += 3;
      if (texto.includes(p)) puntos += 1;
    }
    return { articulo: a, puntos };
  })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, maximo);

  return puntuados.map((x) => x.articulo);
}

/** Búsqueda en las preguntas frecuentes: devuelve las que mejor encajan. */
export function buscarPreguntas(consulta: string, maximo = 5): PreguntaFrecuente[] {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const palabras = norm(consulta).split(/[^a-z0-9]+/).filter((p) => p.length > 2);
  if (palabras.length === 0) return [];

  return PREGUNTAS_FRECUENTES.map((p) => {
    const texto = norm(`${p.q} ${p.a}`);
    return { p, puntos: palabras.reduce((n, palabra) => n + (texto.includes(palabra) ? 1 : 0), 0) };
  })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, maximo)
    .map((x) => x.p);
}
