import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pool, poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Perfil público del anfitrión.
 *
 * Existe porque la ficha enlaza aquí y **un enlace muerto está prohibido**: si se enseña «Ver perfil»,
 * la página tiene que existir de verdad. Se muestra solo lo que hay en la base —nombre, alta,
 * ciudad, biografía y sus alojamientos publicados— y nada más.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const usuarioId = Number(id);
  // El 404 se decide aquí para que sea un 404 de verdad: en la página ya no se puede cambiar el
  // estado, porque la respuesta se ha empezado a enviar.
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) notFound();
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT COALESCE(nombre_mostrado, nombre, apellidos) AS n FROM usuario WHERE id = ? LIMIT 1`,
    [usuarioId],
  );
  if (!filas[0]) notFound();
  const nombre = filas[0]?.n ? String(filas[0].n) : null;
  return {
    title: nombre ? `${nombre} — Anfitrión en Hestiat` : "Anfitrión — Hestiat",
    alternates: { canonical: `/anfitrion/${id}` },
  };
}

export default async function PerfilAnfitrion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) notFound();

  const [usuarios] = await poolLegacy.query<any[]>(
    `SELECT id, COALESCE(nombre_mostrado, nombre, apellidos) AS nombre, avatar_url, bio, ciudad, creado_en
       FROM usuario WHERE id = ? LIMIT 1`,
    [usuarioId],
  );
  const u = usuarios[0];
  if (!u) notFound();

  // Sus alojamientos: el vínculo vive en el esquema antiguo y el catálogo público en el nuevo.
  const [vinculos] = await poolLegacy.query<any[]>(
    `SELECT alojamiento_id FROM alojamiento_anfitrion WHERE usuario_id = ? LIMIT 60`,
    [usuarioId],
  );
  const legacyIds = vinculos.map((v) => Number(v.alojamiento_id)).filter((n) => Number.isInteger(n));

  let alojamientos: any[] = [];
  if (legacyIds.length > 0) {
    const [filas] = await pool.query<any[]>(
      `SELECT a.slug, a.title, a.city, a.province, a.price_per_night, a.indicative_price, a.price_type,
              (SELECT COALESCE(p.origin_url, p.storage_key) FROM accommodation_photo p
                WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
                ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) AS portada
         FROM accommodation a
        WHERE a.legacy_id IN (${legacyIds.map(() => "?").join(",")}) AND a.status = 'published' AND a.slug IS NOT NULL
        ORDER BY a.title LIMIT 30`,
      legacyIds,
    );
    alojamientos = filas;
  }

  const nombre = String(u.nombre ?? "Anfitrión");

  return (
    <main className="wrap ficha">
      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link> <span>/</span> <Link href="/search">Alojamientos</Link> <span>/</span> Anfitrión
      </nav>

      <section className="anfitrion-cabecera">
        {u.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar_url} alt={nombre} className="anfitrion-foto anfitrion-foto-grande" />
        ) : (
          <span className="anfitrion-inicial anfitrion-inicial-grande" aria-hidden="true">{nombre.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <h1>{nombre}</h1>
          <p className="meta">
            {u.ciudad ? `${u.ciudad} · ` : ""}
            {u.creado_en ? `Anfitrión en Hestiat desde ${String(u.creado_en).slice(0, 4)}` : "Anfitrión en Hestiat"}
          </p>
          {u.bio && <p className="ficha-texto" style={{ marginTop: 8 }}>{u.bio}</p>}
        </div>
      </section>

      <section className="ficha-seccion">
        <h2>{alojamientos.length === 1 ? "Su alojamiento" : `Sus alojamientos (${alojamientos.length})`}</h2>
        {alojamientos.length === 0 ? (
          <p className="ficha-texto">Este anfitrión todavía no tiene alojamientos publicados.</p>
        ) : (
          <div className="grid3">
            {alojamientos.map((s) => (
              <Link key={s.slug} href={`/alojamiento/${s.slug}`} className="tarjeta tarjeta-enlace">
                {s.portada ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.portada} alt={s.title} loading="lazy" className="tarjeta-foto" />
                ) : (
                  <span className="tarjeta-sinfoto" aria-hidden="true" />
                )}
                <p className="tarjeta-titulo">{String(s.title).slice(0, 46)}</p>
                <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>{[s.city, s.province].filter(Boolean).join(", ") || "—"}</p>
                <p className="m" style={{ fontSize: 13 }}>
                  {Number(s.price_per_night) > 0
                    ? `${Number(s.price_per_night).toLocaleString("es-ES")} € / noche`
                    : Number(s.indicative_price) > 0
                      ? `desde ${Number(s.indicative_price).toLocaleString("es-ES")} € / noche`
                      : "Precio a consultar"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
