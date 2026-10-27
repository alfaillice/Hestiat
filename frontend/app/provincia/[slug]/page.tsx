import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MigasJsonLd from "@/components/migas-jsonld";
import { MINIMO_ALOJAMIENTOS_INDEXABLE, datosProvincia, listaProvincias } from "@/lib/provincias.server";

export const dynamic = "force-dynamic";

/**
 * PÁGINA DE PROVINCIA — /provincia/<slug>
 *
 * Sustituye al enlace que antes apuntaba a `/search?provincia=…`, una dirección bloqueada por
 * robots.txt. Todo lo que aparece son datos reales del catálogo; si una provincia no tiene
 * contenido suficiente, la página existe pero se marca `noindex` para no ensuciar el índice.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await datosProvincia(slug);
  if (!datos) return { title: "Provincia no encontrada — Hestiat", robots: { index: false, follow: true } };

  const indexable = datos.alojamientos >= MINIMO_ALOJAMIENTOS_INDEXABLE;
  const titulo = `Alojamientos en ${datos.provincia}: ${datos.alojamientos.toLocaleString("es-ES")} fichas — Hestiat`;
  const descripcion =
    `Qué hay publicado en la provincia de ${datos.provincia}: ${datos.alojamientos.toLocaleString("es-ES")} alojamientos, ` +
    `${datos.experiencias.toLocaleString("es-ES")} experiencias y ${datos.servicios.toLocaleString("es-ES")} servicios, ` +
    `con las ciudades y las fichas que se pueden abrir.`;

  return {
    title: titulo.length > 65 ? titulo.slice(0, 62).trimEnd() + "…" : titulo,
    description: descripcion.slice(0, 158),
    alternates: { canonical: `/provincia/${datos.slug}` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Provincia({ params }: Props) {
  const { slug } = await params;
  const datos = await datosProvincia(slug);
  if (!datos) notFound();

  const ciudadesConPagina = datos.ciudades.filter((c) => c.slug);
  const totalProvincias = (await listaProvincias()).length;

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <MigasJsonLd
        items={[
          { nombre: "Hestiat", ruta: "/" },
          { nombre: "Destinos", ruta: "/destinos" },
          { nombre: datos.provincia, ruta: `/provincia/${datos.slug}` },
        ]}
      />

      <nav aria-label="Migas de pan" className="migas">
        <Link href="/">Hestiat</Link> / <Link href="/destinos">Destinos</Link> / <span>{datos.provincia}</span>
      </nav>

      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>{datos.provincia}</h1>
      <p className="m" style={{ color: "var(--muted-fg)", maxWidth: "70ch", marginBottom: 20 }}>
        Esto es lo que el catálogo de Hestiat tiene hoy en la provincia de {datos.provincia}:{" "}
        <strong>{datos.alojamientos.toLocaleString("es-ES")}</strong> alojamientos,{" "}
        <strong>{datos.experiencias.toLocaleString("es-ES")}</strong> experiencias y{" "}
        <strong>{datos.servicios.toLocaleString("es-ES")}</strong> servicios. Todo sale de fichas
        publicadas; lo que no está publicado, no se cuenta.
      </p>

      {ciudadesConPagina.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ marginBottom: 10 }}>Ciudades con página en {datos.provincia}</h2>
          <div className="f-chips">
            {ciudadesConPagina.map((c) => (
              <Link className="f-chip" key={c.slug} href={`/destino/${c.slug}`}>
                {c.nombre} <em>({c.total.toLocaleString("es-ES")})</em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {datos.fichas.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ marginBottom: 10 }}>Alojamientos publicados</h2>
          <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "6px 18px", fontSize: 14 }}>
            {datos.fichas.map((f) => (
              <li key={f.slug}>
                <Link href={`/alojamiento/${f.slug}`}>{f.name}</Link>
                {f.city ? <span style={{ color: "var(--muted-fg)" }}> · {f.city}</span> : null}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 10, fontSize: 14 }}>
            <Link href={`/search?provincia=${encodeURIComponent(datos.provincia)}`}>
              Ver los {datos.alojamientos.toLocaleString("es-ES")} alojamientos de {datos.provincia}
            </Link>
          </p>
        </section>
      ) : null}

      {datos.experienciasTop.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ marginBottom: 10 }}>Experiencias en {datos.provincia}</h2>
          <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "6px 18px", fontSize: 14 }}>
            {datos.experienciasTop.map((e) => (
              <li key={e.slug}>
                <Link href={`/experiencias/${e.slug}`}>{e.name}</Link>
                {e.municipality ? <span style={{ color: "var(--muted-fg)" }}> · {e.municipality}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {datos.serviciosTop.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ marginBottom: 10 }}>Servicios en {datos.provincia}</h2>
          <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "6px 18px", fontSize: 14 }}>
            {datos.serviciosTop.map((s) => (
              <li key={s.slug}>
                <Link href={`/servicios/${s.slug}`}>{s.name}</Link>
                {s.municipality ? <span style={{ color: "var(--muted-fg)" }}> · {s.municipality}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p style={{ marginTop: 30, fontSize: 14 }}>
        <Link href="/destinos">Ver las {totalProvincias} provincias y todas las ciudades con página</Link>
      </p>
    </main>
  );
}
