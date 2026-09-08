"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const types = [
  ["", "Todos"], ["HOUSE", "Casa"], ["APARTMENT", "Apartamento"], ["VILLA", "Villa"], ["PRIVATE_ROOM", "Habitación privada"], ["SHARED_ROOM", "Habitación compartida"],
];

export default function Resultados() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [type, setType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("recommended");
  const [error, setError] = useState("");

  function readUrl() {
    const q = new URLSearchParams(window.location.search);
    setDestination(q.get("destino") || q.get("destination") || "");
    setCheckIn(q.get("checkIn") || "");
    setCheckOut(q.get("checkOut") || "");
    setGuests(q.get("guests") || "2");
    setType(q.get("type") || "");
    setMinPrice(q.get("minPrice") || "");
    setMaxPrice(q.get("maxPrice") || "");
    setSort(q.get("sort") || "recommended");
    return q;
  }

  async function load(next?: URLSearchParams) {
    setLoading(true); setError("");
    try {
      const q = next || new URLSearchParams(window.location.search);
      const params = new URLSearchParams();
      const d = q.get("destino") || q.get("destination");
      if (d) params.set("destination", d);
      for (const key of ["checkIn", "checkOut", "guests", "type", "minPrice", "maxPrice"]) if (q.get(key)) params.set(key, q.get(key)!);
      params.set("limit", "50");
      const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
      const endpoint = Number.isFinite(lat) && Number.isFinite(lng)
        ? `/api/alojamientos/cerca?lat=${lat}&lng=${lng}&radiusKm=${Number(q.get("radiusKm") || 25)}&limit=50`
        : `/api/alojamientos?${params.toString()}`;
      const r = await fetch(endpoint, { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "No se ha podido realizar la búsqueda");
      setListings(json.listings || json.results || []);
    } catch (e: any) { setError(e.message || "No se ha podido realizar la búsqueda"); setListings([]); }
    finally { setLoading(false); }
  }

  function apply(patch: Record<string, string>) {
    const q = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([k, v]) => v ? q.set(k, v) : q.delete(k));
    history.replaceState(null, "", `/resultados?${q.toString()}`);
    readUrl();
    load(q);
  }

  useEffect(() => { const q = readUrl(); load(q).catch(() => undefined); }, []);

  const visibleListings = useMemo(() => [...listings].sort((a,b) => {
    if (sort === "price") return Number(a.basePriceCents||0) - Number(b.basePriceCents||0);
    if (sort === "price_desc") return Number(b.basePriceCents||0) - Number(a.basePriceCents||0);
    return 0;
  }), [listings, sort]);
  const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0;
  const title = visibleListings.length ? `${visibleListings.length} lugares para tu viaje` : "Alojamientos disponibles";
  const today = new Date().toISOString().slice(0,10);

  return <main className="resultsPage">
    <header className="nav resultsNav"><Link href="/" className="brand"><span className="brandMark">⌒</span><span>hestiat</span><small>Un hogar en cada viaje</small></Link><div className="navActions"><span>◉ ES⌄</span><Link href="/login" className="ghost">Iniciar sesión</Link><Link href="/anfitrion/nuevo" className="button">Sé anfitrión</Link></div></header>
    <div className="resultsSearch">
      <label><b>⌕</b><strong>Destino</strong><input value={destination} onChange={e=>setDestination(e.target.value)} onBlur={()=>apply({ destino: destination })} placeholder="Destino, ciudad o región" /></label>
      <label><b>▣</b><strong>Entrada</strong><input type="date" min={today} value={checkIn} onChange={e=>{setCheckIn(e.target.value); apply({checkIn:e.target.value})}} /></label>
      <label><b>▣</b><strong>Salida</strong><input type="date" min={checkIn || today} value={checkOut} onChange={e=>{setCheckOut(e.target.value); apply({checkOut:e.target.value})}} /></label>
      <label><b>♙</b><strong>Huéspedes</strong><select value={guests} onChange={e=>{setGuests(e.target.value); apply({guests:e.target.value})}}>{Array.from({length:16},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?"huésped":"huéspedes"}</option>)}</select></label>
      <button onClick={()=>load()}>⌕ Buscar</button>
    </div>
    <div className="filterBar">
      <label>Precio mínimo <input inputMode="decimal" value={minPrice} onChange={e=>setMinPrice(e.target.value)} onBlur={()=>apply({minPrice})} placeholder="€" /></label>
      <label>Precio máximo <input inputMode="decimal" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} onBlur={()=>apply({maxPrice})} placeholder="€" /></label>
      <select value={type} onChange={e=>{setType(e.target.value); apply({type:e.target.value})}}>{types.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>
      <button onClick={()=>{setMinPrice("");setMaxPrice("");setType("");apply({minPrice:"",maxPrice:"",type:""})}}>Limpiar</button>
      <span className="resultCount">{loading ? "Buscando…" : `${visibleListings.length} alojamientos`} · <b>{destination || "España"}</b>{nights ? ` · ${nights} noches` : ""} · {guests} huéspedes</span>
    </div>
    {error && <div className="emptyState"><h2>No hemos podido completar la búsqueda</h2><p>{error}</p><button onClick={()=>load()}>Intentar de nuevo</button></div>}
    <section className="resultsLayout"><div className="listingPane"><div className="listingTop"><div><h1>{title}</h1><p>Encuentra un lugar que se sienta como casa.</p></div><select value={sort} onChange={e=>{setSort(e.target.value);apply({sort:e.target.value})}}><option value="recommended">Recomendados</option><option value="price">Precio más bajo</option><option value="price_desc">Precio más alto</option></select></div>
      <div className="cardsGrid">{visibleListings.map((stay, i) => <Link href={`/alojamiento?id=${encodeURIComponent(stay.id)}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${encodeURIComponent(guests)}`} className="resultCard" key={stay.id || i}><div className="resultImage">{stay.coverUrl ? <img src={stay.coverUrl} alt={stay.title || "Alojamiento"}/> : <div className="image-placeholder">hestiat</div>}<span className="heart">♡</span></div><div className="resultInfo"><h2>{stay.title || "Alojamiento Hestiat"}</h2><p>{stay.city || stay.country || "España"}</p><small>{stay.maxGuests ? `${stay.maxGuests} huéspedes` : "Alojamiento completo"}</small><div className="resultPrice">{stay.basePriceCents != null && <><strong>€ {Math.round(Number(stay.basePriceCents)/100)}</strong> noche {nights > 0 && <><em>·</em> <u>€ {Math.round(Number(stay.basePriceCents)/100 * nights)} estancia</u></>}</>}</div></div></Link>)}</div>
      {!loading && !error && !listings.length && <div className="emptyState"><h2>No hemos encontrado alojamientos</h2><p>Prueba otra zona, reduce los huéspedes o amplía tus fechas.</p></div>}
    </div><aside className="mapPane"><div className="mapTop"><strong>Mapa</strong></div><div className="mapCanvas"><div className="mapLabel">Mapa Hestiat</div>{listings.slice(0,8).map((x,i)=><div className="mapMarker" key={x.id || i} style={{left:`${18+(i*17)%70}%`,top:`${24+(i*23)%58}%`}}>{x.basePriceCents!=null?`€ ${Math.round(Number(x.basePriceCents)/100)}`:"Hestiat"}</div>)}</div></aside></section>
  </main>
}
