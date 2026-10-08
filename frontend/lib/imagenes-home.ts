/**
 * Imágenes de la portada: las de destino son fotografías reales; las de categoría, ambientación.
 *
 * ── DESTINOS ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Son fotografías reales de Wikimedia Commons del monumento o el paisaje más reconocible de cada
 * ciudad (Madrid → Edificio Metrópolis; Barcelona → Park Güell; Granada → Alhambra; València →
 * Ciudad de las Artes y las Ciencias; Bilbao → Guggenheim; Sevilla → Giralda; Córdoba →
 * Mezquita-Catedral; Santiago → Catedral; Salamanca → Plaza Mayor; Alicante → Castillo de Santa
 * Bárbara; Málaga → Alcazaba).
 *
 * Cada URL se comprobó una a una contra Commons antes de escribirla aquí, y se descartaron las
 * candidatas cuyo nombre de fichero no correspondía al monumento buscado. NO se usan fotografías
 * del catálogo de alojamientos para esto: se comprobó que las que hay en cada ciudad no representan
 * la ciudad (aparecía, por ejemplo, un parador de Gredos en Madrid), y enseñarlas como «Madrid»
 * sería engañar.
 *
 * Se guardan como datos fijos —no se consulta Commons en cada visita— para que la portada no
 * dependa de un servicio externo y cargue igual de rápido siempre. «ficha» es la página del fichero
 * en Commons, para poder citar la autoría.
 *
 * ── CATEGORÍAS ───────────────────────────────────────────────────────────────────────────────────
 *
 * Las de Servicios y Experiencias NO son fotos de negocios concretos: no se puede afirmar «esta es
 * una peluquería de Hestiat» cuando no lo es. Son imágenes de ambientación generadas con el propio
 * generador del proyecto, con un estilo común (luz natural, paleta clara y cálida, sin texto ni
 * logotipos) para que las tarjetas se vean homogéneas. Cada tarjeta lo dice en su pie, y la página
 * de servicios repite el aviso: son imágenes de referencia.
 *
 * Se probó a sacarlas de fuentes públicas reales, pero el resultado no era fiable: salían cosas que
 * no correspondían a la categoría (una foto de moscas para «Familias», un crucero para «Bienestar y
 * relajación», un edificio de la Alemania nazi para «Eventos»). Se descartó por completo: antes sin
 * imagen que con una imagen equivocada.
 */
export interface ImagenDestino {
  url: string;
  /** Página del fichero en Commons, por si hay que citar la autoría. */
  ficha: string;
}

export const IMAGEN_DESTINO: Record<string, ImagenDestino> = {
  "Madrid": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Edificio_Metr%C3%B3polis%2C_calle_de_Alcal%C3%A1%2C_Madrid%2C_Espa%C3%B1a%2C_2017-05-18%2C_DD_08.jpg/960px-Edificio_Metr%C3%B3polis%2C_calle_de_Alcal%C3%A1%2C_Madrid%2C_Espa%C3%B1a%2C_2017-05-18%2C_DD_08.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Edificio_Metrópolis,_calle_de_Alcalá,_Madrid,_España,_2017-05-18,_DD_08.jpg" },
  "Barcelona": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Barcelona_-_Park_G%C3%BCell_-_Antonio_Gaud%C3%AD_-_ICE_Fisheye.jpg/960px-Barcelona_-_Park_G%C3%BCell_-_Antonio_Gaud%C3%AD_-_ICE_Fisheye.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Barcelona_-_Park_Güell_-_Antonio_Gaudí_-_ICE_Fisheye.jpg" },
  "Granada": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Alhambra_evening_panorama_Mirador_San_Nicolas_sRGB-1.jpg/960px-Alhambra_evening_panorama_Mirador_San_Nicolas_sRGB-1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Alhambra_evening_panorama_Mirador_San_Nicolas_sRGB-1.jpg" },
  "Málaga": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Alcazaba%2C_M%C3%A1laga%2C_Espa%C3%B1a%2C_2023-05-20%2C_DD_09.jpg/960px-Alcazaba%2C_M%C3%A1laga%2C_Espa%C3%B1a%2C_2023-05-20%2C_DD_09.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Alcazaba,_Málaga,_España,_2023-05-20,_DD_09.jpg" },
  "Sevilla": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Giralda%2C_Sevilla%2C_Espa%C3%B1a%2C_2015-12-06%2C_DD_131.JPG/960px-Giralda%2C_Sevilla%2C_Espa%C3%B1a%2C_2015-12-06%2C_DD_131.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Giralda,_Sevilla,_España,_2015-12-06,_DD_131.JPG" },
  "València": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Ciudad_de_las_Artes_y_las_Ciencias1-edit.jpg/960px-Ciudad_de_las_Artes_y_las_Ciencias1-edit.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Ciudad_de_las_Artes_y_las_Ciencias1-edit.jpg" },
  "Bilbao": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Bilbao_-_Museo_Guggenheim_01.jpg/960px-Bilbao_-_Museo_Guggenheim_01.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Bilbao_-_Museo_Guggenheim_01.jpg" },
  "Córdoba": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Mezquita-Catedral_de_C%C3%B3rdoba_-_Blending_of_Christian_and_Moorish_architecture.jpg/960px-Mezquita-Catedral_de_C%C3%B3rdoba_-_Blending_of_Christian_and_Moorish_architecture.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Mezquita-Catedral_de_Córdoba_-_Blending_of_Christian_and_Moorish_architecture.jpg" },
  "Santiago de Compostela": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/2010-Catedral_de_Santiago_de_Compostela-Galicia_%28Spain%29_3.jpg/960px-2010-Catedral_de_Santiago_de_Compostela-Galicia_%28Spain%29_3.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:2010-Catedral_de_Santiago_de_Compostela-Galicia_(Spain)_3.jpg" },
  "Salamanca": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Plaza_Mayor%2C_Salamanca%2C_Spain.jpg/960px-Plaza_Mayor%2C_Salamanca%2C_Spain.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Plaza_Mayor,_Salamanca,_Spain.jpg" },
  "Alicante": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Alicante_-_Castillo_de_Santa_B%C3%A1rbara_22.11.2010_16.JPG/960px-Alicante_-_Castillo_de_Santa_B%C3%A1rbara_22.11.2010_16.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail", ficha: "https://commons.wikimedia.org/wiki/File:Alicante_-_Castillo_de_Santa_Bárbara_22.11.2010_16.JPG" },
};

/**
 * Imágenes de ambientación de las categorías, generadas con el generador del proyecto.
 * La clave es «servicio:<categoría>» o «experiencia:<categoría>», con el valor exacto de la base.
 */
const BASE_IMG = "https://d8j0ntlcm91z4.cloudfront.net/user_3IzMsB0U9hxTBv2euznNUvtGJpE/";

export const IMAGEN_CATEGORIA: Record<string, string> = {
  "servicio:Belleza y cuidado personal": BASE_IMG + "hf_20261007_225924_4680962f-a011-4403-a24f-c0efee255ae0.png",
  "servicio:Deporte y fitness": BASE_IMG + "hf_20261007_225925_832a9c19-47c3-49be-a2d0-43d9db8306ef.png",
  "servicio:Viaje y comodidad": BASE_IMG + "hf_20261007_225925_7356e765-d68f-46b1-8cba-8b4282a38fcb.png",
  "servicio:Outdoor y aventura": BASE_IMG + "hf_20261007_225926_b6617ea5-928d-40d1-b812-21f6b1093ac4.png",
  "servicio:Mascotas": BASE_IMG + "hf_20261007_230133_cc0ec3ca-0330-4f84-bcbe-46d59577646c.png",
  "servicio:Servicios para el alojamiento": BASE_IMG + "hf_20261007_230134_4de6701b-3bd9-45bb-8a2f-537ff084f54d.png",
  "servicio:Comida y catering": BASE_IMG + "hf_20261007_230134_6980c88a-1e5c-44f8-8211-8e726a9f9728.png",
  "servicio:Fotografía y contenido": BASE_IMG + "hf_20261007_230216_e34dcde0-ce4e-4d8a-bc7a-e5da769e7818.png",
  "experiencia:Gastronomía": BASE_IMG + "hf_20261007_230217_a8ccd146-f60e-4f1e-9fd8-495861ee5123.png",
  "experiencia:Naturaleza": BASE_IMG + "hf_20261007_230218_e769b6fe-54a8-4af0-8ff2-9ed1238ec0f7.png",
  "experiencia:Vida nocturna": BASE_IMG + "hf_20261007_230218_50db17fb-75f7-4cc5-b28b-2ddb58eeb42c.png",
  "experiencia:Historia": BASE_IMG + "hf_20261007_230341_178092b8-5df2-4922-9f43-68a4c92fefff.png",
  "experiencia:Belleza": BASE_IMG + "hf_20261007_230341_dbda946b-7ebd-4d87-84b4-75edb0d795b7.png",
  "experiencia:Arte": BASE_IMG + "hf_20261007_230342_1b644888-9201-4fee-a226-8456b8ca7000.png",
  "experiencia:Lugares de interés": BASE_IMG + "hf_20261007_230342_d1a9310f-e33e-4ca1-9f68-e89526e6d0a7.png",
  "experiencia:Cultura": BASE_IMG + "hf_20261007_230423_ac58a80e-b345-4779-a8fd-1bf509bf9d28.png",
  "experiencia:Agua": BASE_IMG + "hf_20261007_230932_2caa38d6-2385-4cb5-9376-38bd73a85fe6.png",
};

/* ===================================================================================
   IMÁGENES DE LOS CARRUSELES DE CATEGORÍA (Servicios populares y Experiencias destacadas)

   Una imagen PROPIA por categoría —nunca la misma para dos— generada con el generador del
   proyecto en estilo común (luz natural, paleta clara y cálida, sin texto ni logotipos).
   Son imágenes representativas de la CATEGORÍA, no fotografías de un negocio concreto, y así
   se dice en el pie de cada tarjeta.

   Cada categoría lleva una CADENA de direcciones, no una sola:
     1. la versión WebP (más ligera, la que se sirve cuando el navegador la acepta);
     2. la versión PNG de la misma imagen (respaldo inmediato);
     3. imágenes de ambientación anteriores de esa misma categoría;
     4. y, como último recurso, una imagen segura de su tipo.
   Si una falla, se prueba la siguiente: NUNCA se queda un bloque vacío.

   La clave se normaliza (minúsculas, sin acentos, con guiones), así que da igual que la
   categoría venga como identificador («bienestar-belleza») o como nombre («Bienestar y belleza»).
   =================================================================================== */

/** Versión WebP y PNG de una misma imagen: se intentan en ese orden. */
const par = (fichero: string): string[] => [`${BASE_IMG}${fichero}_min.webp`, `${BASE_IMG}${fichero}.png`];

const IMAGENES_SERVICIOS: Record<string, string[]> = {
  peluqueria: par("hf_20261008_171110_ffff431a-2ae8-45a8-a210-0dbb4f636d76"),
  "bienestar-belleza": par("hf_20261008_171110_2873c9c0-a87b-45c2-864e-3b32b2d39540"),
  transporte: par("hf_20261008_171111_f20448c2-b942-4de1-a50e-c941021d4a7d"),
  "deporte-fitness": par("hf_20261008_171111_facd0a05-bf7f-4b6f-b5ea-f686f32f5c33"),
  mascotas: par("hf_20261008_171143_cdef0731-4ccd-4afc-b302-afb3ac2ff91c"),
  "hogar-asistencia": par("hf_20261008_171143_180509e7-c6fb-4c8b-aa57-d0baee6747ef"),
  "servicios-turisticos": par("hf_20261008_171144_3f7d00b0-18ff-4097-95d0-a98b52f76cfb"),
  gastronomia: par("hf_20261008_171144_ed341286-5373-4e88-802a-c91a4d10efb9"),
};

const IMAGENES_EXPERIENCIAS: Record<string, string[]> = {
  // Las categorías reales llegan como «cultura-historia», «naturaleza-paisajes»... (una sola «y» de
  // unión no aparece). Se dejan también las variantes con «y» para que cualquier forma encuentre su
  // imagen: es mejor dos claves que una tarjeta con la imagen de otra categoría.
  "cultura-historia": par("hf_20261008_171209_3ac8b754-0439-4615-bae9-9bdd17f712ce"),
  "cultura-e-historia": par("hf_20261008_171209_3ac8b754-0439-4615-bae9-9bdd17f712ce"),
  "naturaleza-paisajes": par("hf_20261008_171209_4407be13-a4fe-4cff-8e87-8803a2050e83"),
  "naturaleza-y-paisajes": par("hf_20261008_171209_4407be13-a4fe-4cff-8e87-8803a2050e83"),
  arte: par("hf_20261008_171353_89d4a333-1bdd-4b8a-b17c-74d3c797bf67"),
  "parques-atracciones": par("hf_20261008_171210_2833d82d-da7c-42f3-98a3-545c31712ba1"),
  "parques-y-atracciones": par("hf_20261008_171210_2833d82d-da7c-42f3-98a3-545c31712ba1"),
  "museos-exposiciones": par("hf_20261008_171240_7116723a-6076-4edb-84d5-2e0cbd780092"),
  "museos-y-exposiciones": par("hf_20261008_171240_7116723a-6076-4edb-84d5-2e0cbd780092"),
  "ocio-entretenimiento": par("hf_20261008_171241_9d81b68c-712a-42df-910f-baa9d5a74d2d"),
  "ocio-y-entretenimiento": par("hf_20261008_171241_9d81b68c-712a-42df-910f-baa9d5a74d2d"),
  "gastronomia-bebidas": par("hf_20261008_171242_51238f6d-96e9-4a16-bab4-75c557e331d7"),
  "gastronomia-y-bebidas": par("hf_20261008_171242_51238f6d-96e9-4a16-bab4-75c557e331d7"),
  "mar-acuaticas": par("hf_20261008_171242_9f8cb2e5-b942-4b15-9049-0376eb1aef03"),
  "mar-y-actividades-acuaticas": par("hf_20261008_171242_9f8cb2e5-b942-4b15-9049-0376eb1aef03"),
};

/** Imagen segura de cada tipo, para que nunca quede un hueco. */
const RESPALDO_SERVICIO = par("hf_20261008_171143_180509e7-c6fb-4c8b-aa57-d0baee6747ef");
const RESPALDO_EXPERIENCIA = par("hf_20261008_171209_4407be13-a4fe-4cff-8e87-8803a2050e83");

/** Clave normalizada: «Bienestar y belleza» y «bienestar-belleza» son la misma. */
export function claveCategoria(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Imágenes de ambientación antiguas, como tercer escalón del respaldo. */
function antiguasDe(tipo: "servicio" | "experiencia", clave: string): string[] {
  const porNombre: Record<string, string[]> = {
    "servicio:peluqueria": ["servicio:Belleza y cuidado personal"],
    "servicio:transporte": ["servicio:Viaje y comodidad"],
    "servicio:deporte-fitness": ["servicio:Deporte y fitness"],
    "servicio:mascotas": ["servicio:Mascotas"],
    "servicio:hogar-asistencia": ["servicio:Servicios para el alojamiento"],
    "servicio:gastronomia": ["servicio:Comida y catering"],
    "servicio:servicios-turisticos": ["servicio:Outdoor y aventura"],
    "experiencia:cultura-e-historia": ["experiencia:Historia", "experiencia:Cultura"],
    "experiencia:naturaleza-y-paisajes": ["experiencia:Naturaleza"],
    "experiencia:arte": ["experiencia:Arte"],
    "experiencia:museos-y-exposiciones": ["experiencia:Lugares de interés"],
    "experiencia:ocio-y-entretenimiento": ["experiencia:Vida nocturna"],
    "experiencia:gastronomia-y-bebidas": ["experiencia:Gastronomía"],
    "experiencia:mar-y-actividades-acuaticas": ["experiencia:Agua"],
  };
  const claves = porNombre[`${tipo}:${clave}`] ?? [];
  return claves.map((k) => IMAGEN_CATEGORIA[k]).filter((u): u is string => Boolean(u));
}

/**
 * categoryImageMap: LA función que usan las tarjetas. Devuelve la cadena completa de imágenes de
 * una categoría, en orden de preferencia, sin repetir ninguna.
 */
export function categoryImageMap(tipo: "servicio" | "experiencia", valor: string): string[] {
  const clave = claveCategoria(valor);
  const propias = tipo === "servicio" ? IMAGENES_SERVICIOS[clave] : IMAGENES_EXPERIENCIAS[clave];
  const respaldo = tipo === "servicio" ? RESPALDO_SERVICIO : RESPALDO_EXPERIENCIA;
  const cadena = [...(propias ?? []), ...antiguasDe(tipo, clave), ...respaldo];
  return [...new Set(cadena.filter(Boolean))];
}
