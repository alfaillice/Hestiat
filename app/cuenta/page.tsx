"use client";
import {useEffect,useState} from "react";

export default function Cuenta(){
 const [user,setUser]=useState<any>(null);
 const [busy,setBusy]=useState(true);
 useEffect(()=>{fetch("/api/auth/me").then(r=>r.json()).then(d=>setUser(d.user)).finally(()=>setBusy(false))},[]);
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/";}
 if(busy)return <main className="accountPage"><p>Cargando…</p></main>;
 if(!user)return <main className="accountPage"><div className="accountCard"><h1>Entra en Hestiat.</h1><p>Accede para ver tus viajes y gestionar tu cuenta.</p><a className="continueBtn" href="/login">Continuar →</a></div></main>;
 return <main className="accountPage"><div className="accountCard">
   <a href="/" className="brand">hestiat</a><p className="eyebrow">MI CUENTA</p><h1>Hola{user.name?`, ${user.name}`:""}.</h1>
   <div className="accountRow"><span>Email</span><strong>{user.email}</strong></div>
   <div className="accountRow"><span>Perfil</span><strong>{user.role==="HOST"?"Anfitrión":"Huésped"}</strong></div>
   <div className="accountActions"><a className="secondary-btn" href="/preferencias">Comunicaciones</a><a className="secondary-btn" href="/notificaciones">Notificaciones</a>{user.role==="HOST"&&<a className="secondary-btn" href="/anfitrion">Panel de anfitrión</a>}</div>
   <button className="logoutBtn" onClick={logout}>Cerrar sesión</button>
 </div></main>
}
