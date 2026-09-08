"use client";

import Link from "next/link";
import { useState } from "react";
import { saveListingStep } from "../../../lib/host-draft";

const counters = [["maxGuests","Huéspedes","Número máximo de personas.",4],["bedrooms","Dormitorios","Espacios privados para dormir.",2],["beds","Camas","Camas disponibles.",3],["bathrooms","Baños","Baños completos o con ducha.",1]] as const;

export default function CapacidadPage() {
  const [values,setValues] = useState(Object.fromEntries(counters.map(([key,, ,value])=>[key,value])));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const change=(key:string,delta:number)=>setValues(v=>({...v,[key]:Math.max(1,Number(v[key])+delta)}));
  async function next(){setSaving(true);setError("");try{await saveListingStep(values);window.location.href="/anfitrion/nuevo/servicios"}catch{setError("No se ha podido guardar el borrador.")}finally{setSaving(false)}}
  return <main className="host-onboarding">
    <header className="onboarding-header"><Link href="/anfitrion" className="brand">hestiat</Link><div className="save-status"><span/> Guardado automáticamente</div><Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link></header>
    <section className="form-shell capacity-shell">
      <div className="form-heading"><p className="eyebrow">PASO 3 DE 11</p><h1>Cuéntanos un poco más sobre el espacio</h1><p>Indica la capacidad real del alojamiento.</p></div>
      <div className="capacity-card">{counters.map(([key,name,desc])=><div className="counter-row" key={key}><div className="counter-info"><strong>{name}</strong><small>{desc}</small></div><div className="counter"><button onClick={()=>change(key,-1)}>−</button><span>{values[key]}</span><button onClick={()=>change(key,1)}>+</button></div></div>)}</div>
      {error && <p className="draft-error">{error}</p>}
      <div className="form-actions"><Link href="/anfitrion/nuevo/ubicacion" className="secondary-btn">← Atrás</Link><button onClick={next} disabled={saving} className="primary-btn">{saving?"Guardando…":"Continuar →"}</button></div>
    </section>
  </main>;
}
