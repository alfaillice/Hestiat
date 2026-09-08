"use client";

import Link from "next/link";
import { useState } from "react";
import { saveListingStep } from "../../../lib/host-draft";

export default function UbicacionPage() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function next() {
    setSaving(true); setError("");
    try {
      const values = Object.fromEntries(new FormData(document.querySelector("form") as HTMLFormElement));
      await saveListingStep(values);
      window.location.href = "/anfitrion/nuevo/capacidad";
    } catch {
      setError("No se ha podido guardar. Comprueba la conexión con la base de datos.");
    } finally { setSaving(false); }
  }

  return <main className="host-onboarding">
    <header className="onboarding-header"><Link href="/anfitrion" className="brand">hestiat</Link><div className="save-status"><span/> Guardado automáticamente</div><Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link></header>
    <section className="form-shell location-shell">
      <div className="form-heading"><p className="eyebrow">PASO 2 DE 11</p><h1>¿Dónde está tu alojamiento?</h1><p>La dirección exacta se mostrará a los huéspedes según las condiciones de tu reserva.</p></div>
      <form className="location-card">
        <label>Dirección<input name="address" placeholder="Calle, número y puerta" /></label>
        <div className="location-row"><label>Ciudad<input name="city" placeholder="Ej. Murcia" /></label><label>Código postal<input name="postalCode" placeholder="Ej. 30001" /></label></div>
        <div className="location-row"><label>Provincia / región<input name="region" placeholder="Ej. Murcia" /></label><label>País<input name="country" defaultValue="España" /></label></div>
        <div className="privacy-hint"><span>⌖</span><div><strong>Privacidad de tu dirección</strong><p>Antes de reservar, los viajeros verán una ubicación aproximada. La dirección completa se facilitará cuando corresponda.</p></div></div>
      </form>
      {error && <p className="draft-error">{error}</p>}
      <div className="form-actions"><Link href="/anfitrion/nuevo/tipo" className="secondary-btn">← Atrás</Link><button onClick={next} disabled={saving} className="primary-btn">{saving ? "Guardando…" : "Continuar →"}</button></div>
    </section>
  </main>;
}
