import { Cargando } from "@/components/estados";

/**
 * Estado de carga general de la aplicación.
 *
 * Cubre cualquier página que no tenga uno más cercano, así que **ninguna navegación se queda en
 * blanco**: se ve al instante que la página está cargando. El panel de anfitrión tiene el suyo
 * propio (`app/host/loading.tsx`) para no depender de este.
 */
export default function CargandoAplicacion() {
  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <Cargando lineas={5} />
    </main>
  );
}
