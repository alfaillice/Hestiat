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
  experimental: { optimizePackageImports: ["mysql2"] },
};

export default nextConfig;
