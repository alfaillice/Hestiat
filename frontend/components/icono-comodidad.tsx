import type { ReactElement } from "react";

/**
 * Icono profesional (SVG de trazo) para las comodidades más comunes de una ficha.
 *
 * Se elige por el NOMBRE de la comodidad (el que viene del catálogo), normalizado y por palabras
 * clave. Solo cubre el conjunto nombrado y habitual (wifi, aparcamiento, piscina, cocina, aire
 * acondicionado, calefacción, mascotas, jardín, terraza, accesibilidad y algunos más); para
 * cualquier otra comodidad NO devuelve nada, y la ficha usa entonces el icono que ya traía el dato.
 * Así no se inventa un icono que no corresponda: lo conocido se dibuja con trazo uniforme, lo demás
 * mantiene su icono de origen.
 *
 * Los SVG heredan el color del texto (`currentColor`) y el tamaño del contenedor `.servicio-icono`.
 */
const S = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 18,
  height: 18,
  "aria-hidden": true,
};

const ICONOS: { claves: string[]; svg: ReactElement }[] = [
  { claves: ["wifi", "internet", "wi-fi"], svg: (<svg {...S}><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8 15.5a6 6 0 0 1 8 0" /><path d="M2 9.5a15 15 0 0 1 20 0" /><circle cx="12" cy="19" r="1" /></svg>) },
  { claves: ["aparcamiento", "parking", "garaje", "aparca"], svg: (<svg {...S}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" /></svg>) },
  { claves: ["piscina", "pool", "alberca"], svg: (<svg {...S}><path d="M3 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1" /><path d="M7 16V6a2 2 0 0 1 4 0v10" /><path d="M7 11h4" /></svg>) },
  { claves: ["cocina", "kitchen"], svg: (<svg {...S}><path d="M8 3v6a2 2 0 0 1-4 0V3" /><path d="M6 9v12" /><path d="M16 3c-1.7 0-3 2-3 5s1.3 4 3 4" /><path d="M16 3v18" /></svg>) },
  { claves: ["aire acondicionado", "aire", "climatiz", "a/c", "ac ", "aa"], svg: (<svg {...S}><rect x="3" y="5" width="18" height="9" rx="2" /><path d="M7 18c0-1 1-1.5 1-2.5M12 18c0-1 1-1.5 1-2.5M17 18c0-1 1-1.5 1-2.5" /></svg>) },
  { claves: ["calefacc", "heating", "radiador"], svg: (<svg {...S}><path d="M12 3c2 2.5-1 4 0 6.5" /><path d="M8 5c1.3 1.7-.7 2.7 0 4.3" /><path d="M16 5c1.3 1.7-.7 2.7 0 4.3" /><path d="M5 13h14M6 13v7M18 13v7M10 13v7M14 13v7" /></svg>) },
  { claves: ["mascota", "pet", "animal", "perro", "gato"], svg: (<svg {...S}><circle cx="7" cy="10" r="1.6" /><circle cx="12" cy="8" r="1.6" /><circle cx="17" cy="10" r="1.6" /><path d="M8.5 15.5c1-1.8 2-2.5 3.5-2.5s2.5.7 3.5 2.5c1 1.8-.3 3-1.7 3-1 0-1.2-.5-1.8-.5s-.8.5-1.8.5c-1.4 0-2.7-1.2-1.7-3Z" /></svg>) },
  { claves: ["jardin", "jardín", "garden", "huerto"], svg: (<svg {...S}><path d="M12 20v-7" /><path d="M12 13c-3 0-5-2-5-5 3 0 5 2 5 5Z" /><path d="M12 11c0-3 2-5 5-5 0 3-2 5-5 5Z" /></svg>) },
  { claves: ["terraza", "balcon", "balcón", "patio", "porche"], svg: (<svg {...S}><path d="M4 11h16" /><path d="M6 11V9a6 6 0 0 1 12 0v2" /><path d="M6 11v9M18 11v9M12 11v9" /></svg>) },
  { claves: ["accesib", "accessible", "silla de ruedas", "movilidad"], svg: (<svg {...S}><circle cx="12" cy="4.5" r="1.5" /><path d="M11 8v4h4l2 5" /><path d="M15 15a5 5 0 1 1-5-6" /></svg>) },
  { claves: ["television", "televisión", "tv", "smart tv"], svg: (<svg {...S}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></svg>) },
  { claves: ["lavadora", "washer", "lavander"], svg: (<svg {...S}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4.5" /><path d="M7 6h.01M10 6h.01" /></svg>) },
  { claves: ["desayuno", "breakfast"], svg: (<svg {...S}><path d="M4 8h12a3 3 0 0 1 0 6h-1" /><path d="M4 8v4a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5" /><path d="M8 3c-.5.8-.5 1.2 0 2M11 3c-.5.8-.5 1.2 0 2" /></svg>) },
  { claves: ["chimenea", "fireplace", "lena", "leña"], svg: (<svg {...S}><path d="M12 4c2 2.5-1 4 0 6.5 2-1 2.5-3 2.5-3 1.5 1.5 2 3.5 2 5a6.5 6.5 0 0 1-13 0c0-2 1-4 3-5.5 0 1.5 1 2.5 2 3-1-2.5 0-4 1.5-6Z" /></svg>) },
];

export function iconoComodidad(nombre: string): ReactElement | null {
  const n = (nombre ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const { claves, svg } of ICONOS) {
    if (claves.some((c) => n.includes(c))) return svg;
  }
  return null;
}
