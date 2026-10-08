/**
 * Formas de datos de «Cerca de ti», en un fichero sin dependencias.
 *
 * Vive aparte a propósito: los tipos los usan el servidor (que consulta la base) y el navegador
 * (que pinta la sección). Si estuvieran en el módulo del servidor, el navegador arrastraría el
 * acceso a datos solo por importar un tipo.
 */
import type { TarjetaGaleria } from "@/lib/tarjetas";

export interface AlojamientoCerca extends TarjetaGaleria {
  /** «a 3,2 km». Solo existe cuando hay un punto de referencia real; nunca se inventa. */
  nota?: string;
}

export interface ExperienciaCerca {
  id: number;
  nombre: string;
  categoria: string | null;
  municipio: string | null;
  provincia: string | null;
  imagen: string | null;
  precio: string | null;
  nota?: string;
  href: string;
}

/** En qué se ha basado la sección: una ubicación real, un destino, o una selección del catálogo. */
export type ModoCerca = "punto" | "destino" | "descubre";

export interface RespuestaCerca {
  modo: ModoCerca;
  /** El destino, cuando el modo es «destino». */
  etiqueta: string | null;
  alojamientos: AlojamientoCerca[];
  experiencias: ExperienciaCerca[];
  guardados: number[];
  haySesion: boolean;
  totales: { alojamientos: number; experiencias: number };
}
