"use client";
import { useEffect, useState } from "react";

type N={id:string;channel:string;title:string;body:string;status:string;readAt:string|null;createdAt:string};
export default function Notificaciones(){
 const [items,setItems]=useState<N[]>([]);
 useEffect(()=>{fetch("/api/auth/notificaciones").then(r=>r.json()).then(d=>setItems(d.notifications||[]));},[]);
 async function read(id:string){await fetch("/api/auth/notificaciones",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});setItems(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));}
 async function readAll(){await fetch("/api/auth/notificaciones",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})});setItems(x=>x.map(n=>({...n,readAt:new Date().toISOString()})));}
 return <main style={{maxWidth:760,margin:"40px auto",padding:20,fontFamily:"Arial"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><p style={{color:"#687"}}>HESTIAT</p><h1>Notificaciones</h1><p>Hestiat te avisa solo cuando hay algo útil que saber.</p></div><button onClick={readAll}>Marcar todo leído</button></div><div style={{display:"grid",gap:12,marginTop:24}}>{items.map(n=><article key={n.id} onClick={()=>read(n.id)} style={{padding:18,border:"1px solid #ddd",borderRadius:16,background:n.readAt?"#fff":"#faf7f0",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{n.title}</strong><small>{new Date(n.createdAt).toLocaleString("es-ES")}</small></div><p>{n.body}</p><small>{n.channel} · {n.status}</small></article>)}{!items.length&&<p>No tienes notificaciones.</p>}</div></main>
}
