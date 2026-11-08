import { Cargando } from "@/components/estados";

/** Estado de carga de la administración, en su propia página (no en la raíz: ver app/perfil/loading.tsx). */
export default function CargandoAdmin() {
  return (
    <div style={{ padding: "10px 0" }}>
      <Cargando lineas={6} />
    </div>
  );
}
