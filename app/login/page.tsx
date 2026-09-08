"use client";

import {FormEvent,useState} from "react";

export default function LoginPage(){
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [devUrl,setDevUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError("");
    const r=await fetch("/api/auth/request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
    const d=await r.json();
    if(!r.ok){setError(d.error||"No se pudo continuar.");setBusy(false);return;}
    setSent(true); setDevUrl(d.devUrl||""); setBusy(false);
  }

  return <main className="authPage">
    <section className="authCard">
      <a href="/" className="brand">hestiat</a>
      {!sent ? <>
        <p className="eyebrow">BIENVENIDO</p>
        <h1>Entra en Hestiat.</h1>
        <p>Sin contraseña. Te enviaremos un enlace para continuar.</p>
        <form onSubmit={submit}>
          <label>Email<input autoFocus type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required/></label>
          <button className="continueBtn" disabled={busy}>{busy?"Enviando…":"Continuar →"}</button>
        </form>
        <small>Al continuar aceptas los términos y la política de privacidad.</small>
      </> : <>
        <div className="authSuccess">✓</div><h1>Revisa tu email.</h1>
        <p>Te hemos enviado un enlace seguro. Solo tienes que pulsarlo para entrar.</p>
        {devUrl && <a className="devLoginLink" href={devUrl}>Abrir enlace de desarrollo</a>}
        <button className="secondary-btn" onClick={()=>setSent(false)}>Usar otro email</button>
      </>}
      {error&&<p className="payment-error">{error}</p>}
    </section>
  </main>
}
