import { Cargando } from "@/components/estados";

/**
 * Estado de carga del panel de usuario.
 *
 * Va aquí, en la propia página, y no en la raíz: un `loading.tsx` en la raíz crea una frontera de
 * suspensión global, y eso hace que la respuesta empiece a enviarse antes de resolver la página.
 * El resultado era que un alojamiento inexistente respondía 200 con la página de «no encontrado»
 * dentro, en lugar de un 404 de verdad. Cargando solo donde hace falta, el 404 vuelve a ser 404.
 */
export default function CargandoPerfil() {
  return (
    <main className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <Cargando lineas={4} />
    </main>
  );
}
