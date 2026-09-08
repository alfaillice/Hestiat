"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function MiViaje(){
 const [bookings,setBookings]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [auth,setAuth]=useState(true);
 useEffect(()=>{fetch("/api/auth/bookings").then(async r=>{const d=await r.json(); if(r.status===401){setAuth(false);return;} setBookings(d.bookings||[]);}).finally(()=>setLoading(false))},[]);
 if(loading)return <main className="tripPage"><p>Cargando tus viajes…</p></main>;
 if(!auth)return <main className="tripPage"><div className="emptyTrip"><h1>Entra para ver tus viajes.</h1><p>Tus reservas quedan vinculadas a tu cuenta automáticamente.</p><Link href="/login" className="continueBtn">Entrar en Hestiat →</Link></div></main>;
 return <main className="tripPage"><header className="tripHeader"><Link href="/" className="brand">hestiat</Link><nav><Link href="/cuenta">Mi cuenta</Link></nav></header><div className="emptyTrip" style={{textAlign:"left",maxWidth:900}}><p className="eyebrow">MIS VIAJES</p><h1>Tus viajes.</h1>{!bookings.length?<><p>Aún no tienes reservas.</p><Link href="/resultados" className="continueBtn">Explorar alojamientos →</Link></>:<div className="tripSwitcher">{bookings.map(b=><Link key={b.id} href={`/mi-viaje/${b.id}`} className="active">{b.listing?.title||"Alojamiento"} · {new Date(b.checkIn).toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})} · {b.status}</Link>)}</div>}</div></main>
}
