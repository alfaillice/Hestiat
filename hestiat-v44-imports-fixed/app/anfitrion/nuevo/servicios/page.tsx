"use client";

import Link from "next/link";
import { useState } from "react";
import { saveListingStep } from "../../../lib/host-draft";
const amenities=["Wifi","Cocina","Aire acondicionado","Calefacción","Lavadora","Parking","Piscina","Terraza","TV","Espacio de trabajo"];
export default function ServiciosPage(){
 const [selected,setSelected]=useState(["Wifi","Cocina","Aire acondicionado","Calefacción"]);
 const [saving,setSaving]=useState(false); const [error,setError]=useState("");
 function toggle(a:string){setSelected(s=>s.includes(a)?s.filter(x=>x!==a):[...s,a])}
 async function next(){setSaving(true);setError("");try{await saveListingStep({amenities:selected});window.location.href="/anfitrion/nuevo/fotos"}catch{setError("No se ha podido guardar el borrador.")}finally{setSaving(false)}}
 return <main className="host-onboarding"><header className="onboarding-header"><Link href="/anfitrion" className="brand">hestiat</Link><div className="save-status"><span/> Guardado automáticamente</div><Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link></header>
 <section className="form-shell"><div className="form-heading"><p className="eyebrow">PASO 4 DE 11</p><h1>¿Qué ofrece tu alojamiento?</h1><p>Selecciona los servicios y comodidades que encontrarán tus huéspedes.</p></div>
 <div className="amenities-grid">{amenities.map(a=><button key={a} onClick={()=>toggle(a)} className={`amenity-card ${selected.includes(a)?"selected":""}`}><span>◇</span><strong>{a}</strong>{selected.includes(a)&&<b>✓</b>}</button>)}</div>
 {error&&<p className="draft-error">{error}</p>}<div className="form-actions"><Link href="/anfitrion/nuevo/capacidad" className="secondary-btn">← Atrás</Link><button onClick={next} disabled={saving} className="primary-btn">{saving?"Guardando…":"Continuar →"}</button></div></section></main>
}
