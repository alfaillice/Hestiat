"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StripePayment from "./StripePayment";

type Quote = { available: boolean; nights?: number; subtotalCents?: number; cleaningCents?: number; taxesCents?: number; platformFeeCents?: number; totalCents?: number; currency?: string; error?: string };

type Me = { user?: { id: string; email: string; name?: string | null; phone?: string | null } | null };

function euro(cents = 0, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100); }
function fmtDate(value: string) { return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`)); }

export default function Reserva() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const listingId = params.get("listingId") || params.get("id") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = Number(params.get("guests") || 1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [me, setMe] = useState<Me>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [stage, setStage] = useState<"details"|"payment">("details");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!listingId || !checkIn || !checkOut) { setError("Faltan los datos del viaje. Vuelve al alojamiento y selecciona tus fechas."); setLoading(false); return; }
      try {
        const [q, p, u] = await Promise.all([
          fetch(`/api/alojamientos/${encodeURIComponent(listingId)}/cotizacion?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`, { cache: "no-store" }),
          fetch(`/api/alojamientos/${encodeURIComponent(listingId)}`, { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const qd = await q.json(); const pd = await p.json(); const ud = await u.json();
        if (!q.ok) throw new Error(qd.error || "No se pudo calcular el precio.");
        setQuote(qd); setProperty(pd); setMe(ud);
        if (ud?.user) { setEmail(ud.user.email || ""); setName(ud.user.name || ""); setPhone(ud.user.phone || ""); }
        if (qd.available === false) setError("Estas fechas ya no están disponibles.");
      } catch (e) { setError(e instanceof Error ? e.message : "No se pudo preparar la reserva."); }
      finally { setLoading(false); }
    }
    load();
  }, [listingId, checkIn, checkOut, guests]);

  const canContinue = useMemo(() => Boolean(name.trim() && email.trim() && accepted && quote?.available && !loading), [name,email,accepted,quote,loading]);

  async function createBooking() {
    if (!canContinue || creating) { setError("Completa tus datos y acepta las condiciones para continuar."); return; }
    setError("");
    setCreating(true);
    try {
    const r = await fetch("/api/reservas", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ listingId, checkIn, checkOut, guests, name:name.trim(), email:email.trim(), phone:phone.trim() || undefined }) });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "No se pudo crear la reserva."); setCreating(false); return; }
    const p = await fetch(`/api/reservas/${d.bookingId}/pago`, { method:"POST" });
    const pd = await p.json();
    if (!p.ok) { setError(pd.error || "No se pudo preparar el pago."); setCreating(false); return; }
    setBookingId(d.bookingId); setClientSecret(pd.clientSecret || ""); setStage("payment"); setCreating(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo preparar la reserva."); setCreating(false); }
  }

  const currency = quote?.currency || "EUR";
  return <main className="checkoutPage">
    <header className="checkoutNav"><Link href="/" className="brand"><span className="brandMark">⌒</span><span>hestiat</span><small>Un hogar en cada viaje</small></Link><div className="secure">♢ Reserva segura</div></header>
    <div className="checkoutWrap">
      <div className="progress"><span className="active">1</span><b>Tu viaje</b><i></i><span className={stage==="payment"?"active":""}>2</span><b>Pago</b><i></i><span>3</span><b>Confirmación</b></div>
      <div className="checkoutGrid">
        <section className="checkoutMain">
          <Link href={`/alojamiento?id=${encodeURIComponent(listingId)}`} className="back">← Volver al alojamiento</Link>
          <h1>{stage==="details" ? "Confirma tu viaje" : "Completa el pago"}</h1>
          {loading && <div className="formBlock"><p>Estamos comprobando disponibilidad y precio exacto…</p></div>}
          {!loading && stage==="details" && <>
            <div className="formBlock"><div className="blockHead"><div><h2>Tu viaje</h2><p>Precio y disponibilidad comprobados en servidor.</p></div></div><div className="formRows"><div><small>ENTRADA</small><strong>{fmtDate(checkIn)}</strong></div><div><small>SALIDA</small><strong>{fmtDate(checkOut)}</strong></div><div><small>HUÉSPEDES</small><strong>{guests} {guests===1?"huésped":"huéspedes"}</strong></div></div></div>
            <div className="formBlock"><div className="blockHead"><div><h2>Tus datos</h2><p>Si ya tienes cuenta, reutilizamos tus datos y no te los volvemos a pedir.</p></div></div><div className="fields"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" /></label><label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+34" autoComplete="tel" /></label><label className="wide">Email<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" type="email" autoComplete="email" /></label></div></div>
            <div className="formBlock policy"><h2>Condiciones</h2><p>Al continuar aceptas las condiciones de Hestiat y las normas del alojamiento.</p><label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} /> He leído y acepto las condiciones.</label></div>
            <button className="continueBtn" disabled={!canContinue || creating} onClick={createBooking}>{creating ? "Preparando tu reserva…" : "Continuar al pago →"}</button>
          </>}
          {!loading && stage==="payment" && clientSecret && <StripePayment bookingId={bookingId} clientSecret={clientSecret} onSuccess={()=>window.location.href=`/confirmacion?bookingId=${encodeURIComponent(bookingId)}`} />}
          {error && <p className="payment-error">{error}</p>}
        </section>
        <aside className="summaryCard">
          <div className="summaryTop">{property?.photos?.[0]?.url ? <img src={property.photos[0].url} alt="" /> : <div className="image-placeholder">hestiat</div>}<div><h2>{property?.title || "Tu alojamiento"}</h2><p>{property?.city || "España"}{property?.region ? `, ${property.region}` : ""}</p></div></div>
          <div className="summarySection"><strong>Tu viaje</strong><div><span>Entrada</span><b>{fmtDate(checkIn)}</b></div><div><span>Salida</span><b>{fmtDate(checkOut)}</b></div><div><span>Huéspedes</span><b>{guests}</b></div></div>
          {quote?.available && <div className="priceLines"><span>Alojamiento <b>{euro(quote.subtotalCents, currency)}</b></span><span>Limpieza <b>{euro(quote.cleaningCents, currency)}</b></span>{(quote.taxesCents||0)>0 && <span>Impuestos <b>{euro(quote.taxesCents, currency)}</b></span>}<span>Servicio Hestiat <b>{euro(quote.platformFeeCents, currency)}</b></span><div className="total"><strong>Total</strong><strong>{euro(quote.totalCents, currency)}</strong></div></div>}
          <div className="secureNote">✓ <span><b>Precio transparente</b><br/>El total procede del servidor y se comprueba de nuevo al reservar.</span></div>
        </aside>
      </div>
    </div>
  </main>
}
