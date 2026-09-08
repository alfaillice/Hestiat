"use client";
import { useEffect, useState } from "react";

type Pref = { emailTransactional:boolean; whatsappTransactional:boolean; emailMarketing:boolean; whatsappMarketing:boolean };
export default function Preferencias(){
  const [p,setP]=useState<Pref|null>(null); const [phone,setPhone]=useState<string|null>(null); const [msg,setMsg]=useState("");
  useEffect(()=>{Promise.all([fetch("/api/auth/preferencias").then(r=>r.json()),fetch("/api/auth/me").then(r=>r.json())]).then(([a,b])=>{setP(a.preferences||null);setPhone(b.user?.phone||null)})},[]);
  async function save(key:keyof Pref,value:boolean){ if(!p)return; setMsg(""); const r=await fetch("/api/auth/preferencias",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({[key]:value})}); const j=await r.json(); if(!r.ok){setMsg(j.error||"No se pudo guardar.");return;} setP(j.preferences);setMsg("Preferencias actualizadas."); }
  if(!p)return <main className="accountPage"><p>Cargando…</p></main>;
  return <main className="accountPage"><div className="accountCard"><a href="/" className="brand">hestiat</a><p className="eyebrow">COMUNICACIONES</p><h1>Que Hestiat te avise, sin molestarte.</h1><p>Los avisos relacionados con tus reservas deben ser útiles. Puedes elegir cómo recibirlos.</p>
  <div className="accountRow"><span>Email de servicio</span><input type="checkbox" checked={p.emailTransactional} onChange={e=>save("emailTransactional",e.target.checked)}/></div>
  <div className="accountRow"><span>WhatsApp de servicio</span><input type="checkbox" checked={p.whatsappTransactional} disabled={!phone} onChange={e=>save("whatsappTransactional",e.target.checked)}/></div>
  {!phone&&<small>Añade un teléfono a tu cuenta para activar WhatsApp.</small>}
  <div className="accountRow"><span>Ofertas y novedades por email</span><input type="checkbox" checked={p.emailMarketing} onChange={e=>save("emailMarketing",e.target.checked)}/></div>
  <div className="accountRow"><span>Ofertas y novedades por WhatsApp</span><input type="checkbox" checked={p.whatsappMarketing} disabled={!phone} onChange={e=>save("whatsappMarketing",e.target.checked)}/></div>
  {msg&&<p>{msg}</p>}<a className="secondary-btn" href="/cuenta">← Volver a mi cuenta</a></div></main>
}
