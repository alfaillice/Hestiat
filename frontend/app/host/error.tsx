"use client";

import { PanelError } from "@/components/estados";

/**
 * Límite de error del panel del anfitrión.
 *
 * Si una página del panel falla al pedir sus datos, el anfitrión **no ve una pantalla rota**: ve
 * qué ha pasado y un botón para reintentar sin salir de donde estaba.
 */
export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // El detalle técnico no se enseña: se registra para quien administra el servidor.
  if (typeof window !== "undefined") {
    console.error("[hestiat] error en el panel del anfitrión", error?.digest ?? "", error?.message ?? "");
  }

  return (
    <div style={{ padding: "22px 18px", maxWidth: 1360, margin: "0 auto" }}>
      <PanelError onReintentar={reset} />
    </div>
  );
}
