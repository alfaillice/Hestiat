import Link from "next/link";
import type { CategoriaHome } from "@/lib/home.server";
import ImagenSegura from "@/components/imagen-segura";
import { altDeCategoria } from "@/lib/imagenes-home";

/**
 * Tarjeta de categoría, para Servicios y Experiencias.
 *
 * Imagen arriba y nombre debajo, como en la referencia, con un único estilo para que las dos
 * secciones se vean iguales. Las imágenes de categoría son de ambientación, generadas con el propio
 * generador del proyecto y con un estilo común; por eso el pie lo dice con esas palabras. No se
 * presenta una imagen de ambientación como si fuera la foto de un negocio concreto.
 */
export default function TarjetaCategoria({
  categoria,
  pie,
}: {
  categoria: CategoriaHome;
  /** Qué se cuenta debajo del nombre: «servicios» o «experiencias». */
  pie: string;
}) {
  return (
    <Link className="tcat" href={categoria.href}>
      <span className="tcat-media">
        {/* Texto alternativo con sentido para quien no ve la imagen y para los buscadores: dice qué se
            ve y de qué categoría es, sin hacerlo pasar por la foto de un negocio concreto. */}
        <ImagenSegura src={categoria.imagenes} alt={altDeCategoria(categoria.valor)} />
      </span>
      <span className="tcat-txt">
        <b>{categoria.nombre}</b>
        <span>
          {categoria.total.toLocaleString("es-ES")} {pie}
        </span>
      </span>
    </Link>
  );
}
