/** @type {import('next').NextConfig} */

/**
 * Configuración de Hestiat 2.0.
 *
 * `output: "standalone"` es DELIBERADO y es la pieza que hace posible el puente de arranque:
 * genera un servidor autónomo (`server.js`) con sólo las dependencias que usa, sin arrastrar
 * los 345 MB de `node_modules` al servidor. Es lo que permite que LiteSpeed siga arrancando
 * por `app.cjs` → `.output/server/index.mjs` sin tocar la configuración del hosting.
 *
 * `images.unoptimized`: las fotos siguen alojándose en origen externo mientras no estén
 * migradas a R2; el optimizador de Next necesitaría configurar cada dominio y ahora mismo
 * añadiría una dependencia innecesaria. Cuando las fotos estén en R2, se activa con
 * `images.remotePatterns` apuntando a la base pública propia.
 */
const nextConfig = {
  // EL CORREO SE CARGA EN TIEMPO DE EJECUCIÓN, NO EMPAQUETADO.
  // `lib/correo.server.ts` carga el paquete con un import dinámico dentro de un try. El efecto
  // secundario era grave: el empaquetado no lo detectaba y NO lo copiaba a la release, así que en
  // producción el import fallaba, se capturaba en silencio y NINGÚN correo salía. Declarándolo aquí,
  // Next lo trata como dependencia externa y lo incluye en la release.
  serverExternalPackages: ["nodemailer"],
  // EL CORREO SE CARGA EN TIEMPO DE EJECUCIÓN, NO EMPAQUETADO.
  // `lib/correo.server.ts` carga el paquete con un import dinámico dentro de un try. El efecto
  // secundario era grave: el empaquetado no lo detectaba y NO lo copiaba a la release, así que en
  // producción el import fallaba, se capturaba en silencio y NINGÚN correo salía. Declarándolo aquí,
  // Next lo trata como dependencia externa y lo incluye en la release.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: { optimizePackageImports: ["mysql2"] },

  /**
   * MAPA DE REDIRECCIONES — imprescindible para no perder el posicionamiento.
   *
   * Las fichas publicadas hasta hoy viven en `/stays/<slug>`; el frontend nuevo sirve
   * `/alojamiento/<slug>`. Sin esto, cada URL indexada se convertiría en un 404 y Google
   * iría soltando el catálogo. Se conservan con un 301 permanente.
   *
   * Nota honesta: `/admin/*` y `/host/*` NO se redirigen. No existe todavía su equivalente
   * en el frontend nuevo, y redirigir un panel a la portada confundiría a quien lo usa:
   * es preferible un 404 claro mientras se construyen.
   */
  async redirects() {
    return [
      { source: "/stays/:slug", destination: "/alojamiento/:slug", permanent: true },
      { source: "/stays", destination: "/search", permanent: true },
      { source: "/alojamientos", destination: "/search", permanent: true },
      { source: "/cerca", destination: "/search", permanent: true },
      { source: "/buscar", destination: "/search", permanent: true },
      // OJO: aquí había tres reglas que mandaban /servicios y /servicio/:slug a /search. Se pusieron
      // cuando el apartado de servicios todavía no existía; ahora SÍ existe, y un 308 permanente las
      // convertía en un portero que impedía ver la página real.
      // Y estas dos últimas MANDABAN A LA LISTA SIN CONSERVAR EL IDENTIFICADOR: cualquier enlace
      // antiguo en singular (de la web anterior, de un enlace compartido o del índice de un buscador)
      // acababa en el listado en vez de abrir la ficha. Ahora conservan el identificador y llegan a la
      // ficha correcta. Las direcciones buenas que ya existen (/experiencias/<slug>) no se tocan.
      { source: "/servicio/:slug", destination: "/servicios/:slug", permanent: true },
      { source: "/experiencia/:slug", destination: "/experiencias/:slug", permanent: true },
      { source: "/accesibilidad", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
