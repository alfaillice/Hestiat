"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DateRangePicker from "./DateRangePicker";

const labels:any={HOUSE:"Casa",APARTMENT:"Apartamento",VILLA:"Villa",PRIVATE_ROOM:"Habitación privada",SHARED_ROOM:"Habitación compartida",OTHER:"Alojamiento"};
const amenityLabels:any={wifi:"Wifi",cocina:"Cocina",aire_acondicionado:"Aire acondicionado",calefaccion:"Calefacción",lavadora:"Lavadora",parking:"Parking",piscina:"Piscina",terraza:"Terraza",tv:"TV",espacio_trabajo:"Espacio de trabajo"};
export default function Alojamiento(){
 const [data,setData]=useState<any|null>(null); const [calendar,setCalendar]=useState<Record<string,any>>({}); const [error,setError]=useState(""); const [quote,setQuote]=useState<any|null>(null); const [quoteLoading,setQuoteLoading]=useState(false); const [quoteError,setQuoteError]=useState("");
 const [params,setParams]=useState({id:"",checkIn:"",checkOut:"",guests:"2"});
 useEffect(()=>{const q=new URLSearchParams(location.search);setParams({id:q.get("id")||q.get("listingId")||"",checkIn:q.get("checkIn")||"",checkOut:q.get("checkOut")||"",guests:q.get("guests")||"2"});},[]);
 useEffect(()=>{if(!params.id)return;fetch(`/api/alojamientos/${encodeURIComponent(params.id)}?from=${params.checkIn}&to=${params.checkOut}`,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Alojamiento no disponible");setData(j)}).catch(e=>setError(e.message));},[params.id,params.checkIn,params.checkOut]);
 useEffect(()=>{
  if(!params.id || !params.checkIn || !params.checkOut) { setQuote(null); setQuoteError(""); return; }
  let cancelled=false;
  setQuoteLoading(true); setQuoteError("");
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{
   try{
    const r=await fetch(`/api/alojamientos/${encodeURIComponent(params.id)}/cotizacion?checkIn=${encodeURIComponent(params.checkIn)}&checkOut=${encodeURIComponent(params.checkOut)}&guests=${encodeURIComponent(params.guests)}`,{cache:"no-store",signal:controller.signal});
    const j=await r.json();
    if(cancelled)return;
    if(!r.ok) throw Error(j.error||"No se pudo calcular el precio.");
    setQuote(j);
    if(j.available===false) setQuoteError("Estas fechas ya no están disponibles.");
   }catch(e:any){ if(e?.name!=="AbortError" && !cancelled){setQuote(null);setQuoteError(e?.message||"No se pudo calcular el precio.");}}
   finally{if(!cancelled)setQuoteLoading(false);}
  },180);
  return()=>{cancelled=true;controller.abort();window.clearTimeout(timer);};
 },[params.id,params.checkIn,params.checkOut,params.guests]);

 useEffect(()=>{if(!params.id)return; const today=new Date(); const from=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)); const to=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+13,0)); fetch(`/api/alojamientos/${encodeURIComponent(params.id)}/disponibilidad?from=${isoDate(from)}&to=${isoDate(to)}`,{cache:"no-store"}).then(r=>r.json()).then(j=>setCalendar(j.days||{})).catch(()=>{});},[params.id]);
 function isoDate(d:Date){return d.toISOString().slice(0,10)}
 function selectDates(a:string,b:string){setParams(p=>({...p,checkIn:a,checkOut:b}));} 
 const photos=data?.photos||[]; const price=data?.basePriceCents!=null?Number(data.basePriceCents)/100:0; const nights=params.checkIn&&params.checkOut?Math.max(1,Math.round((new Date(params.checkOut).getTime()-new Date(params.checkIn).getTime())/86400000)):0; const displayCurrency=quote?.currency||data?.currency||"EUR";
 const euro=(cents:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:displayCurrency}).format((Number(cents)||0)/100);
 const quoteReady=Boolean(quote?.available && !quoteLoading);
 const totalLabel=quoteReady?euro(quote.totalCents):quoteLoading?"Calculando…":quoteError?"No disponible":nights>0?euro(price*nights*100):"—";
 const amenities=(data?.amenities||[]).map((a:string)=>amenityLabels[a]||a.replaceAll("_"," "));
 const reserve=`/reserva?listingId=${encodeURIComponent(params.id)}&checkIn=${encodeURIComponent(params.checkIn)}&checkOut=${encodeURIComponent(params.checkOut)}&guests=${encodeURIComponent(params.guests)}`;
 if(error)return <main className="detailPage"><div className="detailWrap"><h1>Alojamiento no disponible</h1><p>{error}</p><Link href="/resultados">Volver a resultados</Link></div></main>;
 if(!data)return <main className="detailPage"><div className="detailWrap"><p>Cargando alojamiento…</p></div></main>;
 return <main className="detailPage"><header className="nav detailNav"><Link href="/" className="brand"><span className="brandMark">⌒</span><span>hestiat</span><small>Un hogar en cada viaje</small></Link><div className="navActions"><Link href="/login" className="ghost">Iniciar sesión</Link></div></header><div className="detailWrap"><div className="breadcrumbs"><Link href="/resultados">Alojamientos</Link><span>›</span>{data.city||data.region||data.country}</div><div className="detailHeading"><div><h1>{data.title||"Alojamiento Hestiat"}</h1><p>{labels[data.type]||data.type} · {data.city||data.region||data.country}</p></div></div>
 <section className="gallery">{photos.slice(0,5).map((p:any,i:number)=><div className={i===0?"galleryMain":i===4?"lastPhoto":""} key={p.url}><img src={p.url} alt={p.altText||data.title||"Alojamiento"}/>{i===4&&<span className="galleryCount">{photos.length} fotos</span>}</div>)}</section>
 <section className="detailColumns"><div className="detailMain"><div className="propertyIntro"><div><h2>{labels[data.type]||"Alojamiento"} para {data.maxGuests||"varios"} huéspedes</h2><p>{data.bedrooms??"—"} dormitorios · {data.beds??"—"} camas · {data.bathrooms??"—"} baños</p></div></div><div className="hostRow"><div className="avatar">{(data.hostName||"H").slice(0,1).toUpperCase()}</div><div><strong>{data.hostName?`Tu anfitrión/a, ${data.hostName}`:"Anfitrión de Hestiat"}</strong><p>Anfitrión en Hestiat</p></div><span className="verified">✓ Verificado</span></div>
 <div className="description"><h2>Sobre este alojamiento</h2><p>{data.description||"Este alojamiento aún no tiene descripción. Hestiat mostrará aquí la información proporcionada por el anfitrión."}</p></div>
 <div className="amenities"><h2>Lo que ofrece este alojamiento</h2><div className="amenityGrid">{amenities.length?amenities.map((a:string)=><div key={a}>⌂ <span>{a}</span></div>):<p>El anfitrión todavía no ha indicado servicios.</p>}</div></div>
 <div id="calendar" className="calendarBlock"><h2>Selecciona tus fechas</h2><p>{data.minNights>1?`Estancia mínima: ${data.minNights} noches.`:"Elige entrada y salida. Hestiat comprobará el precio exacto antes de reservar."}</p><DateRangePicker days={calendar} checkIn={params.checkIn} checkOut={params.checkOut} minNights={data.minNights||1} onChange={selectDates}/></div>
 <div className="location"><h2>Ubicación</h2><p>{[data.city,data.region,data.country].filter(Boolean).join(", ")}</p><div className="locationMap"><span>📍 {data.city||data.country}</span></div></div></div>
 <aside className="bookingCard"><div className="bookingPrice"><strong>{quoteReady?euro(quote.subtotalCents/Math.max(1,quote.nights)):price>0?euro(price*100):"—"}</strong> <span>noche</span></div><div className="bookingInputs"><div><small>ENTRADA</small><strong>{params.checkIn||"Seleccionar"}</strong></div><div><small>SALIDA</small><strong>{params.checkOut||"Seleccionar"}</strong></div><div><small>HUÉSPEDES</small><strong>{params.guests} huéspedes</strong></div></div><Link href={quoteReady?reserve:"#calendar"} className="reserveBtn" onClick={(e)=>{if(!quoteReady){e.preventDefault();document.getElementById("calendar")?.scrollIntoView({behavior:"smooth"});}}}>{!params.checkIn||!params.checkOut?"Elegir fechas":quoteLoading?"Calculando precio…":quoteReady?"Reservar":"Cambiar fechas"}</Link><p className="noCharge">No se te cobrará todavía</p>{quoteReady?<div className="priceLines"><span><span>Alojamiento · {quote.nights} noches</span><b>{euro(quote.subtotalCents)}</b></span><span><span>Limpieza</span><b>{euro(quote.cleaningCents)}</b></span>{(quote.taxesCents||0)>0&&<span><span>Impuestos</span><b>{euro(quote.taxesCents)}</b></span>}<span><span>Servicio Hestiat</span><b>{euro(quote.platformFeeCents)}</b></span></div>:<div className="priceLines"><span><span>{quoteError||"Selecciona unas fechas para ver el precio exacto."}</span><b>{nights>0&&!quoteLoading?euro(price*nights*100):""}</b></span></div>}<div className="total"><strong>Total</strong><strong>{totalLabel}</strong></div><div className="trustCard">✓ <span><strong>Precio transparente</strong><br/>{quoteReady?"Total calculado ahora mismo por Hestiat.":"El precio final se calcula en servidor al elegir las fechas."}</span></div><div className="cancel">◌ <span><strong>{data.cancellationPolicy||"Flexible"}</strong><br/>Política indicada por el anfitrión.</span></div></aside></section></div></main>
}
