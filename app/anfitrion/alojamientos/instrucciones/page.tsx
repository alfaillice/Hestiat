"use client";
import {useEffect} from "react";
export default function RedirectInstructions(){useEffect(()=>{fetch("/api/anfitrion/alojamientos/mios").then(r=>r.json()).then(x=>{const id=x?.listings?.[0]?.id;if(id)window.location.replace(`/anfitrion/alojamientos/${id}/instrucciones`);});},[]);return <main className="host-onboarding"><section className="form-shell"><div className="form-heading"><p className="eyebrow">CENTRO DE ANFITRIÓN</p><h1>Cargando alojamiento…</h1><p>Estamos preparando tus instrucciones de check-in.</p></div></section></main>}
