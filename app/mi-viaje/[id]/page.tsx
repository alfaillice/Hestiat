"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  useEffect(() => { params.then(({ id }) => fetch(`/api/auth/bookings/${id}`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo cargar el viaje."); setBooking(d.booking); }).catch(e => setError(e.message)).finally(() => setLoading(false))); }, [params]);

  async function ask(q = question) {
    if (!q.trim() || !booking) return;
    setBusy(true); setAnswer("");
    const r = await fetch(`/api/auth/bookings/${booking.id}/ia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
    const d = await r.json(); setAnswer(d.answer || d.error || "No he podido responder."); setQuestion(""); setBusy(false);
  }
  async function sendSupport() {
    if (!support.trim() || !booking) return;
    const r = await fetch(`/api/auth/bookings/${booking.id}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: support, category: "TRIP_SUPPORT" }) });
    if (r.ok) { setSupport(""); setSupportSent(true); }
  }
  if (loading) return <main className="tripPage"><p>Cargando tu viaje…</p></main>;
  if (error) return <main className="tripPage"><div className="emptyTrip"><h1>{error}</h1><Link href="/login" className="continueBtn">Entrar en Hestiat →</Link></div></main>;
  const l = booking.listing; const cover = l?.photos?.[0]?.url;
  const date = (v: string) => new Date(v).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  return <main className="tripPage">
    <header className="tripHeader"><Link href="/" className="brand">hestiat</Link><nav><Link href="/mi-viaje">Mis viajes</Link><Link href="/cuenta">Mi cuenta</Link></nav></header>
    <Link href="/mi-viaje">← Todos mis viajes</Link>
    <section className="tripHero"><div>{cover && <img src={cover} alt="" />}</div><div className="tripHeroCopy"><p className="eyebrow">TU VIAJE · {booking.status}</p><h1>{l?.title || "Tu alojamiento"}</h1><p>{l?.city}{l?.country ? `, ${l.country}` : ""}</p><div className="tripDates"><span>Entrada<strong>{date(booking.checkIn)}</strong></span><span>Salida<strong>{date(booking.checkOut)}</strong></span><span>Huéspedes<strong>{booking.guests}</strong></span></div></div></section>
    <div className="tripGrid"><section>
      <div className="aiCard"><div className="aiIcon">✦</div><div><p className="eyebrow">HESTIAT IA</p><h2>Yo me encargo de tu viaje.</h2><p>Pregúntame por el check-in, el alojamiento o cualquier cosa que necesites.</p><div className="aiActions"><button onClick={() => ask("¿Cómo hago el check-in?")}>Check-in</button><button onClick={() => ask("¿Cuál es la dirección y cómo llego?")}>Cómo llegar</button><button onClick={() => ask("¿Qué necesito saber antes de llegar?")}>Antes de llegar</button></div><div className="aiAsk"><input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Pregúntame sobre tu viaje…"/><button onClick={() => ask()} disabled={busy}>{busy ? "…" : "Preguntar"}</button></div>{answer && <p>{answer}</p>}</div></div>
      <div className="tripCardBlock"><h2>Tu estancia</h2><div className="timeline"><div><b>Reserva</b><span>{booking.status === "CONFIRMED" ? "Confirmada" : "Pendiente de pago"}</span></div><div><b>{date(booking.checkIn)}</b><span>Entrada al alojamiento</span></div><div><b>{date(booking.checkOut)}</b><span>Salida</span></div></div></div>
      <div className="tripCardBlock"><h2>Información útil</h2><div className="infoRows"><div><span>Dirección</span><strong>{l?.address || "Disponible antes del check-in"}</strong></div><div><span>Anfitrión</span><strong>{l?.host?.name || "Tu anfitrión"}</strong></div><div><span>Reserva</span><strong>{booking.id}</strong></div></div></div>
      <div className="tripCardBlock"><h2>¿Necesitas ayuda humana?</h2><p>Si Hestiat IA no puede resolverlo, abrimos una solicitud para nuestro equipo.</p><textarea value={support} onChange={e => setSupport(e.target.value)} placeholder="Cuéntanos qué necesitas…" rows={4}/><button className="continueBtn" onClick={sendSupport} disabled={!support.trim()}>Contactar con Hestiat</button>{supportSent && <p>✓ Solicitud enviada. Te responderemos desde Hestiat.</p>}</div>
    </section><aside className="tripSide"><div className="sideCard"><h3>Tu reserva</h3><div><span>{booking.nights} noches</span><b>{(booking.totalCents / 100).toFixed(2)} €</b></div><small>{booking.status}</small></div></aside></div>
  </main>;
}
