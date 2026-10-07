"use client";

import { PanelError } from "@/components/estados";

/**
 * Límite de error general.
 *
 * Si una página pública falla al pedir sus datos, el visitante **no ve una pantalla rota**: ve qué
 * ha pasado y puede reintentar. El detalle técnico no se le enseña.
 */
export default function ErrorAplicacion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof window !== "undefined") {
    console.error("[hestiat] error de aplicación", error?.digest ?? "", error?.message ?? "");
  }
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <PanelError
        titulo="No se ha podido cargar esta página"
        detalle="Ha ocurrido un problema al pedir los datos. Puede ser algo temporal: vuelve a intentarlo o busca de nuevo."
        onReintentar={reset}
      />
    </main>
  );
}
