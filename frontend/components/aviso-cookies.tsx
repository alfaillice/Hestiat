"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENTO_ABRIR,
  guardarConsentimiento,
  leerConsentimiento,
  pedirAbrirAviso,
  type Eleccion,
} from "@/lib/consentimiento";

/**
 * AVISO DE COOKIES.
 *
 * ── QUÉ HACE ────────────────────────────────────────────────────────────────────────────────────
 * Pide permiso ANTES de que se cargue nada de publicidad, explica en dos líneas qué se usa y permite
 * aceptar o rechazar con la misma facilidad (los dos botones tienen el mismo tamaño y el mismo peso
 * visual: una elección escondida no es una elección libre). Enlaza con la política de cookies del
 * sitio, que es donde está el detalle.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────────────────────────
 * · No bloquea el acceso al sitio: se puede seguir navegando sin contestar.
 * · No pide datos, no guarda identificadores y no usa cookies para recordar la elección (se guarda
 *   en `localStorage`, que es justo lo que evita crear una cookie nueva mientras se pide permiso
 *   sobre las cookies).
 * · No vuelve a aparecer si ya se decidió, pero el botón «Configurar cookies» del pie lo reabre para
 *   cambiar de opinión: retirar el permiso cuesta lo mismo que darlo.
 *
 * ── NOTA IMPORTANTE PARA EL PROPIETARIO ─────────────────────────────────────────────────────────
 * Google exige, además, publicar su propio mensaje de consentimiento (CMP) en el panel de AdSense
 * para servir publicidad personalizada en el Espacio Económico Europeo. Ese paso no se puede hacer
 * desde el código: es una opción del panel de AdSense y la tiene que activar el propietario.
 */
export default function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(leerConsentimiento() === null);
    const abrir = () => setVisible(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  function decidir(eleccion: Eleccion) {
    guardarConsentimiento(eleccion);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Aviso de cookies"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 60,
        maxWidth: 720,
        margin: "0 auto",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "calc(var(--radio) + 4px)",
        boxShadow: "0 10px 30px rgba(10,20,53,.16)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <p style={{ lineHeight: 1.6, fontSize: 13.5, margin: 0 }}>
        <b>Cookies.</b> Usamos una cookie técnica de sesión, que es imprescindible para mantener tu
        cuenta abierta. Además, si lo aceptas, cargamos <b>cookies publicitarias de Google</b> para
        mostrar anuncios y medirlos. Puedes rechazarlas sin problema: el sitio funciona igual. El
        detalle está en la <Link href="/cookies">política de cookies</Link>.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => decidir("aceptado")}
          style={{
            flex: "1 1 200px",
            background: "var(--hestiat-primary)",
            color: "var(--ink)",
            border: 0,
            borderRadius: "var(--radio-pill)",
            padding: "12px 20px",
            font: "inherit",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Aceptar la publicidad
        </button>
        <button
          type="button"
          onClick={() => decidir("rechazado")}
          style={{
            flex: "1 1 200px",
            background: "var(--card)",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radio-pill)",
            padding: "12px 20px",
            font: "inherit",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Rechazar la publicidad
        </button>
      </div>
    </div>
  );
}

/**
 * Enlace para CAMBIAR DE OPINIÓN. Retirar el consentimiento tiene que costar lo mismo que darlo, así
 * que este botón reabre el aviso desde el pie de página en cualquier momento.
 */
export function BotonConfigurarCookies() {
  return (
    <button
      type="button"
      onClick={pedirAbrirAviso}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        font: "inherit",
        color: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      Configurar cookies
    </button>
  );
}
