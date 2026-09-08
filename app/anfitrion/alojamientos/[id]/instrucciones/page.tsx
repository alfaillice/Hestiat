"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

function toMinutes(value:string){ const [h,m]=value.split(":").map(Number); return h*60+m; }
function toTime(value:number){ return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`; }

export default function InstruccionesPage({params}:{params:{id:string}}){
 const [data,setData]=useState<any>(null); const [from,setFrom]=useState("15:00"); const [to,setTo]=useState("22:00");
 const [form,setForm]=useState({accessMethod:"",arrival:"",keyLocation:"",accessCode:"",contactNote:""});
 const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false); const [error,setError]=useState("");
 useEffect(()=>{ fetch(`/api/anfitrion/alojamientos/${params.id}/instrucciones`).then(r=>r.json()).then(x=>{setData(x.listing); if(x.listing){setFrom(toTime(x.listing.checkInFromMinutes));setTo(toTime(x.listing.checkInToMinutes));setForm({...form,...(x.listing.checkInInstructions||{})});}}).catch(()=>setError("No se han podido cargar las instrucciones.")); },[params.id]);
 function set(k:string,v:string){setForm(f=>({...f,[k]:v}));setSaved(false)}
 async function save(){setSaving(true);setError("");try{const r=await fetch(`/api/anfitrion/alojamientos/${params.id}/instrucciones`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkInFromMinutes:toMinutes(from),checkInToMinutes:toMinutes(to),instructions:form})});const x=await r.json();if(!r.ok)throw new Error(x.error);setData(x.listing);setSaved(true)}catch(e:any){setError(e.message||"No se ha podido guardar.")}finally{setSaving(false)}}
 return <main className="host-onboarding"><header className="onboarding-header"><Link href="/anfitrion" className="brand">hestiat</Link><div className="save-status"><span/> {saved?"Guardado":"Instrucciones de check-in"}</div><Link href="/anfitrion" className="exit">Volver al centro</Link></header>
 <section className="form-shell"><div className="form-heading"><p className="eyebrow">ALOJAMIENTO · {data?.title||""}</p><h1>Haz que el check-in sea fácil</h1><p>Estas instrucciones estarán disponibles para tus huéspedes en su viaje y para Hestiat IA cuando necesiten ayuda.</p></div>
 <div className="rules-card">
  <div className="setting-card"><span className="setting-eyebrow">HORARIO</span><strong>¿Cuándo pueden llegar?</strong><div className="time-row"><input aria-label="Desde" type="time" value={from} onChange={e=>{setFrom(e.target.value);setSaved(false)}}/><em>→</em><input aria-label="Hasta" type="time" value={to} onChange={e=>{setTo(e.target.value);setSaved(false)}}/></div></div>
  <label className="field-label">Cómo acceder<select value={form.accessMethod} onChange={e=>set("accessMethod",e.target.value)}><option value="">Selecciona una opción</option><option>Llaves con anfitrión</option><option>Caja de llaves</option><option>Código en la puerta</option><option>Acceso digital</option><option>Otro</option></select></label>
  <label className="field-label">Cómo llegar y entrar<textarea value={form.arrival} onChange={e=>set("arrival",e.target.value)} placeholder="Ej.: Entra por la puerta azul de la calle Olivo. La vivienda está en la primera planta."/></label>
  <label className="field-label">Dónde están las llaves<textarea value={form.keyLocation} onChange={e=>set("keyLocation",e.target.value)} placeholder="Ej.: La caja está junto al buzón. El código se facilita el día de llegada."/></label>
  <label className="field-label">Código de acceso <span className="muted">(opcional)</span><input value={form.accessCode} onChange={e=>set("accessCode",e.target.value)} placeholder="Solo si utilizas código"/></label>
  <label className="field-label">Nota para el huésped <span className="muted">(opcional)</span><textarea value={form.contactNote} onChange={e=>set("contactNote",e.target.value)} placeholder="Ej.: Si tienes cualquier problema al llegar, escríbeme desde tu viaje en Hestiat."/></label>
 </div>
 <div className="availability-note"><span>✦</span><div><strong>Hestiat IA podrá usar esta información</strong><p>Cuando un huésped pregunte “¿cómo entro?” o “¿dónde están las llaves?”, la IA responderá con estos datos. No inventará información que no hayas guardado.</p></div></div>
 {error&&<p className="draft-error">{error}</p>}<div className="form-actions"><Link href="/anfitrion" className="secondary-btn">← Atrás</Link><button onClick={save} disabled={saving} className="primary-btn">{saving?"Guardando…":saved?"Guardado ✓":"Guardar instrucciones →"}</button></div>
 </section></main>
}
