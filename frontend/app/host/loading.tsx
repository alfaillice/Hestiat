import { Cargando } from "@/components/estados";

/**
 * Estado de carga del panel del anfitrión.
 *
 * Next lo muestra automáticamente mientras se resuelven los datos de cualquier página bajo /host,
 * así que **todas** las secciones del panel comparten el mismo estado de carga sin repetirlo en
 * cada una. Antes, al navegar no había ninguna señal de que algo estuviera pasando.
 */
export default function CargandoPanel() {
  return (
    <div style={{ padding: "22px 18px", maxWidth: 1360, margin: "0 auto" }}>
      <Cargando lineas={6} />
    </div>
  );
}
