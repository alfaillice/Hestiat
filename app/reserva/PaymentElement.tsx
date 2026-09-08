"use client";

import { useState } from "react";

export default function PaymentElement({ bookingId }: { bookingId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startPayment() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/reservas/${bookingId}/pago`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago.");
      if (data.clientSecret) {
        // Stripe.js / Payment Element is intentionally the next browser integration.
        // The server-side PaymentIntent is already created securely.
        setMessage("Pago preparado. Conecta aquí Stripe Payment Element para confirmar el pago.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error de pago.");
    } finally { setBusy(false); }
  }

  return <div className="paymentBox">
    <h3>Pago seguro</h3>
    <p>Tu reserva se confirmará cuando Stripe confirme el pago.</p>
    <button className="continueBtn" onClick={startPayment} disabled={busy}>
      {busy ? "Preparando pago…" : "Preparar pago con Stripe →"}
    </button>
    {message && <p className="paymentMessage">{message}</p>}
  </div>;
}
