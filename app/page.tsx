"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const destinations = [
  ["Mallorca", "+1.200 alojamientos", "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80"],
  ["Costa Brava", "+950 alojamientos", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"],
  ["Andalucía", "+1.500 alojamientos", "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80"],
  ["Canarias", "+800 alojamientos", "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80"],
  ["Barcelona", "+1.100 alojamientos", "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80"],
  ["Valencia", "+700 alojamientos", "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=800&q=80"],
];

const stays = [
  ["Villa Mar Serena", "Jávea, Alicante", "4.9", "128", "220", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80"],
  ["Finca Sa Pleta", "Pollença, Mallorca", "4.8", "96", "180", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80"],
  ["Luz del Atlántico", "Lanzarote, Canarias", "4.9", "74", "200", "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=80"],
  ["Apartamento El Carmen", "Valencia", "4.7", "62", "120", "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80"],
];

const categories = ["Villas", "Frente al mar", "Casas rurales", "Apartamentos", "Cabañas", "Alojamientos únicos", "Larga estancia", "Pet friendly"];

export default function Home() {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const searchHref = `/resultados?${new URLSearchParams({ ...(destination ? { destino: destination } : {}), ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), guests }).toString()}`;
  return (
    <main>
      <header className="nav">
        <div className="brand"><span className="brandMark">⌒</span><span>hestiat</span><small>Un hogar en cada viaje</small></div>
        <nav><Link href="/resultados">Alojamientos</Link><a href="#experiencias">Experiencias</a><Link href="/anfitrion/nuevo">Conviértete en anfitrión</Link></nav>
        <div className="navActions"><span>ES⌄</span><Link href="/login"><button className="ghost">Iniciar sesión</button></Link><Link href="/login"><button>Regístrate</button></Link></div>
      </header>

      <section className="hero">
        <Image src="/hero.png" alt="Alojamiento mediterráneo" fill priority className="heroImage" />
        <div className="heroShade" />
        <div className="heroContent">
          <h1>Lugares únicos<br />para sentirte en casa</h1>
          <p>Alojamientos extraordinarios, experiencias reales<br />y un mundo por descubrir.</p>
          <div className="searchBox">
            <label><b>⌕</b><strong>¿Dónde?</strong><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Destino, ciudad o región" aria-label="Destino" /></label>
            <label><b>▣</b><strong>Entrada</strong><input type="date" min={new Date().toISOString().slice(0,10)} value={checkIn} onChange={e=>setCheckIn(e.target.value)} aria-label="Fecha de entrada" /></label>
            <label><b>▣</b><strong>Salida</strong><input type="date" min={checkIn || new Date().toISOString().slice(0,10)} value={checkOut} onChange={e=>setCheckOut(e.target.value)} aria-label="Fecha de salida" /></label>
            <label><b>♙</b><strong>Huéspedes</strong><select value={guests} onChange={e=>setGuests(e.target.value)} aria-label="Huéspedes">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?"huésped":"huéspedes"}</option>)}</select></label>
            <Link href={searchHref} className="searchBtn">⌕ &nbsp; Buscar</Link>
          </div>
          <div className="trust"><span>◉ Sin comisiones ocultas</span><span>♧ Reserva segura</span><span>◌ Anfitriones verificados</span></div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><h2>Destinos populares</h2><Link href="/resultados">Ver todos →</Link></div>
        <div className="destinationGrid">
          {destinations.map(([name, count, img]) => <Link href={`/resultados?destino=${encodeURIComponent(name)}`} className="destination" key={name}><img src={img} alt="" /><h3>{name}</h3><p>{count}</p></Link>)}
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><h2>Alojamientos destacados</h2><Link href="/resultados">Ver todos →</Link></div>
        <div className="stayGrid">
          {stays.map(([name, loc, rating, reviews, price, img]) => <article className="stay" key={name}>
            <div className="stayImage"><img src={img} alt="" /><button>♡</button></div>
            <h3>{name}</h3><p>{loc}</p><div className="rating">★ {rating} ({reviews})</div><strong>€ {price} <small>noche</small></strong>
          </article>)}
        </div>
      </section>

      <section className="section" id="experiencias">
        <div className="sectionHead"><h2>Explora por tipo de alojamiento</h2><Link href="/resultados">Ver todos →</Link></div>
        <div className="categoryGrid">{categories.map((c, i) => <div className="category" key={c}><span>{["⌂","♨","♧","▥","⌁","◇","↔","♧"][i]}</span><p>{c}</p></div>)}</div>
      </section>

      <section className="hostBanner">
        <div className="hostImage"><img src="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=80" alt="" /></div>
        <div className="hostCopy"><small>ANFITRIONES</small><h2>Comparte tu espacio<br />y llega más lejos</h2><p>Únete a una comunidad de anfitriones que hacen posible que más personas vivan experiencias únicas.</p><button>Conviértete en anfitrión →</button></div>
        <ul><li>♧ Publicación sencilla</li><li>◌ Sin comisiones iniciales</li><li>◉ Soporte 24/7</li><li>✥ Llegar a viajeros de todo el mundo</li></ul>
      </section>

      <footer>
        <div className="footerBrand"><div className="brand"><span className="brandMark">⌒</span><span>hestiat</span><small>Un hogar en cada viaje</small></div></div>
        <div><h4>Explorar</h4><a>Alojamientos</a><a>Experiencias</a><a>Destinos</a><a>Ofertas</a></div>
        <div><h4>Anfitriones</h4><a>Cómo funciona</a><a>Recursos</a><a>Historias</a><a>Centro de ayuda</a></div>
        <div><h4>Sobre nosotros</h4><a>Nuestra misión</a><a>Blog</a><a>Carreras</a><a>Contacto</a></div>
        <div><h4>Legal</h4><a>Términos y condiciones</a><a>Privacidad</a><a>Cookies</a><a>Mapa del sitio</a></div>
        <div><h4>Suscríbete a nuestras novedades</h4><div className="newsletter"><input placeholder="Tu email" /><button>→</button></div><div className="social">◎ &nbsp;♪ &nbsp;◉ &nbsp;▶</div></div>
        <div className="copyright">© 2026 Hestiat. Todos los derechos reservados.</div>
      </footer>
    </main>
  );
}
