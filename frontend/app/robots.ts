import type { MetadataRoute } from "next";

/**
 * robots.txt servido por la propia aplicación.
 *
 * En el hosting antiguo esto era un fichero estático en la raíz del sitio; en el VPS no existe, y
 * por eso daba 404. Aquí lo genera la aplicación, así que **viaja con cada despliegue** y no hay
 * que acordarse de reponerlo a mano.
 *
 * Las zonas privadas no se indexan; el resto sí, y se declara el sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Zonas privadas: nunca se indexan.
          "/admin",
          "/host",
          "/login",
          "/registro",
          "/api/",
          // Resultados internos de búsqueda y filtros: son casi idénticos entre sí y compiten por las
          // mismas palabras. Al buscador le interesan las fichas y las páginas de ciudad, no esto.
          "/search?",
          "/*?",
          // Sondas de escaneo que no llevan a ninguna parte (cientos al día en el registro).
          "/*.php",
          "/xmlrpc.php",
          "/wp-admin",
          "/wp-login.php",
        ],
      },
    ],
    sitemap: "https://hestiat.com/sitemap.xml",
  };
}
