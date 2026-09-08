import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../../src/server/lib/prisma";
import { getCurrentUser } from "../../src/server/lib/auth";

function money(cents: number, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100); }
function dateLabel(d: Date) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(d).replace(".", ""); }

export default async function Anfitrion() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HOST") redirect("/login?next=/anfitrion");
  const listings = await prisma.listing.findMany({ where: { hostId: user.id }, include: { photos: { where: { isCover: true }, take: 1 } }, orderBy: { updatedAt: "desc" } });
  const listingIds = listings.map(l => l.id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1);
  const [upcoming, monthAgg, confirmedCount] = await Promise.all([
    prisma.booking.findMany({ where: { listingId: { in: listingIds }, status: { in: ["PENDING","CONFIRMED"] }, checkOut: { gte: now } }, include: { guest: { select: { name: true, email: true } }, listing: { select: { title: true } } }, orderBy: { checkIn: "asc" }, take: 5 }),
    prisma.booking.aggregate({ where: { listingId: { in: listingIds }, status: { in: ["CONFIRMED","COMPLETED"] }, checkIn: { gte: monthStart, lt: nextMonth } }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.booking.count({ where: { listingId: { in: listingIds }, status: "CONFIRMED", checkIn: { gte: now } } })
  ]);
  const hostName = user.name?.split(" ")[0] || "anfitrión";
  const first = listings[0];
  return <main className="hostPage">
    <aside className="hostSidebar">
      <Link href="/" className="hostLogo"><span>⌒</span>hestiat</Link>
      <div className="hostUser"><div>{hostName[0].toUpperCase()}</div><span><b>{hostName}</b><small>Anfitrión</small></span></div>
      <nav><Link href="/anfitrion" className="active">▦ Resumen</Link><Link href="/anfitrion">⌂ Alojamientos</Link><Link href={first ? `/anfitrion/alojamientos/${first.id}/instrucciones` : "/anfitrion/nuevo"}>◫ Calendario</Link><Link href="/anfitrion/mensajes">◉ Mensajes</Link></nav>
      <div className="hostBottom"><Link href="/anfitrion/alojamientos/instrucciones">⚙ Instrucciones de check-in</Link><Link href="/cuenta">♧ Mi cuenta</Link><Link href="/">← Volver a Hestiat</Link></div>
    </aside>
    <section className="hostContent">
      <header className="hostHeader"><div><span className="eyebrow">CENTRO DE ANFITRIÓN</span><h1>Buenos días, {hostName}</h1><p>Gestiona tus alojamientos, reservas y calendario desde un solo lugar.</p></div><div><Link href="/anfitrion/nuevo" className="hostAction">Añadir alojamiento +</Link></div></header>
      <div className="kpiGrid"><div><small>INGRESOS ESTE MES</small><strong>{money(monthAgg._sum.totalCents || 0)}</strong><span>Reservas confirmadas/completadas</span></div><div><small>RESERVAS PRÓXIMAS</small><strong>{confirmedCount}</strong><span>Con check-in pendiente</span></div><div><small>ALOJAMIENTOS</small><strong>{listings.length}</strong><span>{listings.filter(l=>l.status==="PUBLISHED").length} publicados</span></div><div><small>ESTADO</small><strong>{listings.some(l=>l.status==="PUBLISHED") ? "Activo" : "En preparación"}</strong><span>{listings.length ? "Tu panel está conectado a tus datos reales" : "Crea tu primer alojamiento"}</span></div></div>
      <div className="hostGrid">
        <section className="hostPanel"><div className="panelHead"><div><h2>Próximas reservas</h2><p>Reservas reales asociadas a tus alojamientos.</p></div></div>{upcoming.length ? <div className="bookingList">{upcoming.map(b=><div className="hostBooking" key={b.id}><div className="dateBox"><b>{b.checkIn.getDate()}</b><small>{dateLabel(b.checkIn).split(" ")[1]}</small></div><div><strong>{b.listing.title || "Alojamiento sin título"}</strong><p>{b.guest.name || b.guest.email} · {b.guests} huéspedes</p></div><div><b>{money(b.totalCents,b.currency)}</b><small>{b.status === "PENDING" ? "Pendiente de pago" : "Confirmada"}</small></div></div>)}</div> : <div className="emptyHost"><strong>Aún no tienes reservas</strong><p>Cuando llegue tu primera reserva aparecerá aquí automáticamente.</p></div>}</section>
        <section className="hostPanel"><div className="panelHead"><div><h2>Tus alojamientos</h2><p>Estado actual de cada anuncio.</p></div><Link href="/anfitrion/nuevo">Añadir →</Link></div>{listings.length ? listings.map(l=><div className="propertyHost" key={l.id}>{l.photos[0]?.url ? <img src={l.photos[0].url} alt=""/> : <div className="propertyPlaceholder">⌂</div>}<div><strong>{l.title || "Borrador sin título"}</strong><p>{l.city || "Ubicación pendiente"} · {l.status === "PUBLISHED" ? "Publicado" : "Borrador"}</p><span>{l.basePriceCents ? money(l.basePriceCents) : "—"} <small>precio base por noche</small></span></div><Link href={`/anfitrion/nuevo/vista-previa?id=${l.id}`}>Editar →</Link></div>) : <div className="emptyHost"><strong>Empieza a recibir huéspedes</strong><p>Crea tu primer alojamiento. Hestiat guardará el progreso automáticamente.</p><Link href="/anfitrion/nuevo" className="hostAction">Crear alojamiento</Link></div>}</section>
      </div>
    </section>
  </main>
}
