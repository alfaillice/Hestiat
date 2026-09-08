"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type Props = { bookingId: string; onSuccess: () => void };

function Inner({ bookingId, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch(`/api/reservas/${encodeURIComponent(bookingId)}/estado`, { cache: "no-store" });
        const status = await response.json();
        if (cancelled) return;
        if (response.ok && status.status === "CONFIRMED") { onSuccess(); return; }
        if (response.ok && ["processing", "requires_capture"].includes(status.paymentStatus)) {
          attempts += 1;
          if (attempts < 20) window.setTimeout(poll, 1500);
          else { setError("El pago sigue en proceso. No vuelvas a pagar; puedes consultar el estado en Mi viaje."); setProcessing(false); setBusy(false); }
          return;
        }
        if (response.ok && status.status === "EXPIRED") { setError("La reserva ha expirado. Vuelve a intentarlo con nuevas fechas."); setProcessing(false); setBusy(false); return; }
        if (response.ok && status.paymentFailureMessage) { setError(status.paymentFailureMessage); setProcessing(false); setBusy(false); return; }
        attempts += 1;
        if (attempts < 20) window.setTimeout(poll, 1500);
        else { setError("No hemos podido confirmar el pago todavía. Consulta Mi viaje antes de volver a intentarlo."); setProcessing(false); setBusy(false); }
      } catch {
        attempts += 1;
        if (attempts < 20) window.setTimeout(poll, 1500);
        else { setError("No hemos podido consultar el estado del pago. Consulta Mi viaje antes de volver a intentarlo."); setProcessing(false); setBusy(false); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [processing, bookingId, onSuccess]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true); setError("");
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (result.error) { setError(result.error.message || "No se pudo completar el pago."); setBusy(false); return; }
    setProcessing(true);
  }

  return <form onSubmit={submit} className="stripe-payment-form" aria-busy={busy}>
    <PaymentElement options={{ layout: "tabs" }} />
    {error && <p className="payment-error" role="alert">{error}</p>}
    <button className="continueBtn" disabled={!stripe || !elements || busy}>
      {processing ? "Confirmando tu reserva…" : busy ? "Procesando pago…" : "Pagar y confirmar reserva →"}
    </button>
    <small>{processing ? "No cierres esta página. Estamos verificando el pago." : "El pago se procesa de forma segura con Stripe."}</small>
  </form>;
}

export default function StripePayment({ bookingId, clientSecret, onSuccess }: { bookingId: string; clientSecret: string; onSuccess: () => void }) {
  if (!stripePromise) return <div className="paymentBox"><strong>Stripe no está configurado.</strong><p>Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.</p></div>;
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}><Inner bookingId={bookingId} onSuccess={onSuccess} /></Elements>;
}
