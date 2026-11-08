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
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["mysql2"],

    /**
     * CACHÉ DEL ROUTER DEL CLIENTE (la que provocaba ver menús antiguos).
     *
     * Next.js guarda en el navegador los árboles de componentes de las páginas ya visitadas y
     * los reutiliza al navegar con clics dentro de la aplicación. Tras un despliegue, esa copia
     * puede seguir sirviendo la versión anterior del menú del panel AUNQUE las cabeceras HTTP
     * sean correctas, porque no hubo petición al servidor. Es exactamente lo que se comprobó:
     * el código y el bundle desplegado tenían la entrada, y una ventana de incógnito la mostraba.
     *
     * `staleTimes.dynamic = 0` desactiva esa reutilización para las páginas dinámicas. El panel
     * administrativo se sirve con `force-dynamic`, así que tras un despliegue se pide al servidor
     * y el usuario ve el menú actualizado sin recargar a mano.
     *
     * Coste: una navegación interna del panel vuelve a pedir los datos. Es el precio correcto en
     * un panel de administración, donde la frescura importa más que ahorrar una petición. Las
     * páginas públicas mantienen su comportamiento de caché habitual.
     */
    staleTimes: { dynamic: 0, static: 180 },
  },

  /**
   * CABECERAS DE LOS RECURSOS ESTÁTICOS PROPIOS.
   *
   * `/img/*` y `/marca/*` se servían con `Cache-Control: public, max-age=0`: el navegador tenía
   * que REVALIDAR cada imagen en cada visita, lo que añade peticiones sin ninguna ventaja.
   * Los recursos de `/_next/static/*` ya van con `max-age=31536000, immutable` (llevan hash de
   * versión en el nombre, así que son seguros), pero estos dos directorios NO llevan hash.
   *
   * Por eso NO se les pone `immutable`: un fichero sin hash cacheado un año sería una trampa
   * (un cambio de imagen no se vería). Se usa 1 día de validez + `stale-while-revalidate` de una
   * semana: el navegador sirve la copia al instante y la revalida en segundo plano, así que un
   * cambio aparece solo, sin que el visitante tenga que forzar nada.
   *
   * Esto se hace en Next.js y NO en NGINX: así la configuración viaja con el código, se versiona
   * y no se toca la configuración del servidor que sirve las páginas públicas.
   */
  async headers() {
    return [
      {
        source: "/img/:ruta*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/marca/:ruta*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },

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
