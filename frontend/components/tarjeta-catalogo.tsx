import Link from "next/link";
import ImagenSegura from "@/components/imagen-segura";

/**
 * LA TARJETA DEL CATÁLOGO. Una sola pieza para experiencias y servicios, y la misma para las filas
 * del servidor que para las que añade el scroll infinito: así no puede pasar que la primera pantalla
 * y las siguientes se vean distintas.
 */
export interface ItemCatalogo {
  id: number;
  nombre: string;
  href: string;
  categoria: string | null;
  subcategoria: string | null;
  municipio: string | null;
  provincia: string | null;
  imagen: string | null;
  /** true cuando la imagen es la oficial del propio sitio (no una de referencia). */
  imagenOficial: boolean;
  /** Qué es exactamente la imagen que se muestra, para nombrarla bien. */
  imagenEtiqueta?: string;
  precio: string;
  precioOrientativo: boolean;
  /** «a 3,2 km», cuando hay un punto real desde el que medir. */
  nota?: string;
  rating?: number | null;
  ratingCount?: number;
}

/** Adaptador: las tarjetas del servidor ya traen esta forma; esto solo deja claro qué usa la tarjeta. */
export function aItemCatalogo(x: ItemCatalogo): ItemCatalogo {
  return {
    id: x.id,
    nombre: x.nombre,
    href: x.href,
    categoria: x.categoria ?? null,
    subcategoria: x.subcategoria ?? null,
    municipio: x.municipio ?? null,
    provincia: x.provincia ?? null,
    imagen: x.imagen ?? null,
    imagenOficial: Boolean(x.imagenOficial),
    imagenEtiqueta: x.imagenEtiqueta ?? "sin_imagen_verificada",
    precio: x.precio,
    precioOrientativo: Boolean(x.precioOrientativo),
    nota: x.nota,
    rating: x.rating ?? null,
    ratingCount: x.ratingCount ?? 0,
  };
}

/**
 * CÓMO SE NOMBRA CADA IMAGEN. Una sola tabla para toda la web: una imagen de Wikipedia nunca se
 * presenta como fotografía oficial del proveedor, y una de referencia se dice que lo es.
 */
export const ETIQUETA_IMAGEN: Record<string, string> = {
  oficial: "Imagen oficial del sitio",
  proveedor: "Imagen del proveedor",
  turismo_oficial: "Imagen de turismo oficial",
  wikipedia: "Imagen de Wikipedia",
  directorio: "Imagen de directorio",
  representativa: "Imagen de referencia",
  sin_imagen_verificada: "Sin imagen verificada",
};

export function textoDeImagen(tipo: string | null | undefined): string {
  return ETIQUETA_IMAGEN[tipo ?? "sin_imagen_verificada"] ?? "Imagen de referencia";
}

export default function TarjetaCatalogo({ item }: { item: ItemCatalogo }) {
  const lugar = [item.municipio, item.provincia].filter(Boolean).join(", ");
  // La imagen se rotula por lo que es: oficial del sitio o de referencia. Nunca se hace pasar una por
  // la otra.
  const etiquetaImagen = textoDeImagen(item.imagenEtiqueta);
  const alt = `${item.nombre}: ${etiquetaImagen.toLowerCase()}`;
  return (
    <Link className="serv-card" href={item.href}>
      <span className="serv-media">
        <ImagenSegura src={item.imagen} alt={alt} />
      </span>
      <span className="serv-txt">
        <b>{item.nombre}</b>
        {lugar ? <span className="m">{lugar}</span> : null}
        <span className="m">
          {item.categoria ?? "Sin categoría"}
          {item.subcategoria ? ` · ${item.subcategoria}` : ""}
        </span>
        <span className="serv-fuente">
          {item.precio}
          {item.precioOrientativo ? " · orientativo" : ""}
          {typeof item.rating === "number" && item.rating > 0
            ? ` · ${item.rating.toFixed(1).replace(".", ",")} (${(item.ratingCount ?? 0).toLocaleString("es-ES")})`
            : ""}
          {item.nota ? ` · ${item.nota}` : ""}
        </span>
        {item.imagenEtiqueta && item.imagenEtiqueta !== "sin_imagen_verificada" ? (
          <span className="serv-fuente">{etiquetaImagen}</span>
        ) : null}
      </span>
    </Link>
  );
}
