import { Cargando } from "@/components/estados";

/**
 * Estado de carga del explorador de alojamientos.
 *
 * Cargando solo aquí, y no en la raíz: una frontera en la raíz adelanta el envío de la respuesta y
 * rompe el código de estado de las páginas que deciden un 404 (ver app/perfil/loading.tsx).
 */
export default function CargandoExplorar() {
  return (
    <div className="explorar">
      <Cargando lineas={5} />
    </div>
  );
}
