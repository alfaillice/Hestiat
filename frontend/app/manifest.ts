import type { MetadataRoute } from "next";

/**
 * Manifiesto para móvil: es lo que usa el navegador cuando alguien añade Hestiat a su pantalla de
 * inicio. Los iconos salen del emblema de la marca, no del logotipo completo: en el móvil se recortan
 * en formas redondeadas y la palabra desaparecería.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hestiat",
    short_name: "Hestiat",
    description: "Alojamientos, experiencias y servicios en toda España",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1435",
    theme_color: "#0A1435",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
