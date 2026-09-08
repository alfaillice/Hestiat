"use client";

import { useState } from "react";
import Link from "next/link";
import { setHostDraft } from "../../../lib/host-draft";

const types = [
  ["⌂", "Casa", "Una casa completa para tus huéspedes.", "HOUSE"],
  ["▱", "Apartamento", "Un apartamento o piso independiente.", "APARTMENT"],
  ["◇", "Villa", "Una villa o casa con espacio exterior.", "VILLA"],
  ["○", "Habitación privada", "Una habitación privada dentro de un espacio compartido.", "PRIVATE_ROOM"],
  ["□", "Habitación compartida", "Una cama o espacio compartido.", "SHARED_ROOM"],
  ["✦", "Otro", "Un alojamiento que no encaja en las categorías anteriores.", "OTHER"],
];

export default function TipoAlojamientoPage() {
  const [selected, setSelected] = useState("HOUSE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function continueStep() {
    setLoading(true);
    setError("");
    try {
      const existing = localStorage.getItem("hestiat_host_draft");
      if (existing) {
        const draft = JSON.parse(existing);
        setHostDraft({ ...draft, type: selected });
        window.location.href = "/anfitrion/nuevo/ubicacion";
        return;
      }

      const res = await fetch("/api/anfitrion/alojamientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected }),
      });

      if (!res.ok) throw new Error("No se pudo crear el borrador");
      const data = await res.json();
      setHostDraft({ id: data.id, type: selected });
      window.location.href = "/anfitrion/nuevo/ubicacion";
    } catch {
      setError("No se ha podido iniciar el borrador. Comprueba que la base de datos esté conectada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="host-onboarding">
      <header className="onboarding-header">
        <Link href="/anfitrion" className="brand">hestiat</Link>
        <div className="save-status"><span /> Guardado automáticamente</div>
        <Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link>
      </header>
      <section className="form-shell">
        <div className="form-progress"><span className="done">01</span><div className="line active" /><span>02</span><div className="line" /><span>03</span><div className="line" /><span>04</span><div className="line" /><span>05</span></div>
        <div className="form-heading"><p className="eyebrow">PASO 1 DE 11</p><h1>¿Qué tipo de alojamiento vas a ofrecer?</h1><p>Elige la opción que mejor describa el espacio que recibirá a tus huéspedes.</p></div>
        <div className="type-grid">
          {types.map(([icon, title, desc, value]) => (
            <button key={value} onClick={() => setSelected(value)} className={`type-card ${selected === value ? "selected" : ""}`}>
              <span className="type-icon">{icon}</span><span className="type-check">{selected === value ? "✓" : ""}</span><strong>{title}</strong><small>{desc}</small>
            </button>
          ))}
        </div>
        {error && <p className="draft-error">{error}</p>}
        <div className="form-actions"><Link href="/anfitrion/nuevo" className="secondary-btn">← Atrás</Link><button onClick={continueStep} disabled={loading} className="primary-btn">{loading ? "Creando borrador…" : "Continuar →"}</button></div>
      </section>
    </main>
  );
}
