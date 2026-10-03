import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fichaPorSlug } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Metadatos por ficha: SEO real, sin contenido duplicado. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const datos = await fichaPorSlug(decodeURIComponent(slug));
  if (!datos) return { title: "Alojamiento no encontrado — Hestiat" };
  const { alojamiento, fotos } = datos;
  const lugar = [alojamiento.city, alojamiento.province].filter(Boolean).join(", ");
  return {
    title: `${alojamiento.title}${lugar ? ` — ${lugar}` : ""} — Hestiat`,
    description:
      alojamiento.description?.slice(0, 155) ??
      `${alojamiento.title} en ${lugar}. Consulta precios, servicios y disponibilidad en Hestiat.`,
    openGraph: { images: fotos[0]?.url ? [fotos[0].url] : [] },
  };
}

export default async function Ficha({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await fichaPorSlug(decodeURIComponent(slug));
  if (!datos) notFound();
  const { alojamiento: a, fotos, servicios } = datos;
  const lugar = [a.city, a.province].filter(Boolean).join(", ");
  const [principal, ...resto] = fotos;

  return (
    <main className="wrap">
      <div className="hero">
        {principal?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={principal.url} alt={principal.alt ?? a.title} />
        ) : (
          <div className="nofoto" />
        )}
        <div className="grid2">
          {resto.slice(0, 2).map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} src={f.url ?? ""} alt={f.alt ?? a.title} style={{ height: 146, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      </div>

      <div className="cols">
        <div>
          <h1 style={{ fontSize: 38, lineHeight: 1.15, margin: "18px 0 6px" }}>{a.title}</h1>
          <p className="meta">
            {lugar}
            {a.review_count > 0 ? ` · ${Number(a.review_score).toFixed(2).replace(".", ",")} (${a.review_count} reseñas)` : " · nuevo"}
          </p>

          <div className="facts">
            <span><b>{a.capacity ?? "—"}</b> huéspedes</span>
            <span><b>{a.bedrooms ?? "—"}</b> dormitorios</span>
            <span><b>{a.beds ?? "—"}</b> camas</span>
            <span><b>{a.baths ?? "—"}</b> baños</span>
          </div>

          {servicios.length > 0 && (
            <div className="chips">
              {servicios.map((s) => (
                <span className="chip" key={s.amenity}>
                  {s.amenity}
                </span>
              ))}
            </div>
          )}

          <p className="desc">
            {a.description?.slice(0, 900) ?? "Descripción pendiente de completar por el propietario."}
          </p>

          <table className="info">
            <tbody>
              <tr><td>Tipo</td><td>{a.type ?? "—"}</td></tr>
              <tr><td>Categoría</td><td>{a.category ?? "—"}</td></tr>
              <tr><td>Dirección</td><td>{a.address ?? "—"}</td></tr>
              <tr><td>Ubicación</td><td>{a.lat && a.lng ? `${a.lat}, ${a.lng}` : "sin coordenadas"}</td></tr>
              <tr><td>Reserva inmediata</td><td>{a.instant_booking ? "sí" : "no"}</td></tr>
            </tbody>
          </table>
        </div>

        <aside className="card-reserva">
          <div className="price">
            {a.price_per_night ? `${Number(a.price_per_night).toLocaleString("es-ES")} €` : "Consultar"}
            <span style={{ fontSize: 15, color: "var(--stone)" }}> / noche</span>
          </div>
          <p className="meta" style={{ marginTop: 6 }}>
            {a.price_type === "real" ? "Precio publicado" : "Precio orientativo"}
            {a.price_source ? ` · ${a.price_source}` : ""}
          </p>
          <button className="btn" type="button">Reservar</button>
          <p className="note">Sin cargos ocultos</p>
        </aside>
      </div>

      <p className="warn">
        Las fotografías conservan su procedencia original. El sistema nuevo las migrará a almacenamiento
        propio y servirá variantes optimizadas.
      </p>
    </main>
  );
}
