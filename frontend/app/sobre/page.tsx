import Link from "next/link";
import type { Metadata } from "next";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sobre Hestiat — qué es y de dónde salen los datos",
  description:
    "Hestiat reúne alojamientos, experiencias y servicios de toda España. Aquí se explica de dónde salen los datos, qué significan las fotos y los precios, y qué no hacemos nunca.",
  alternates: { canonical: "/sobre" },
};

/**
 * Sobre Hestiat: qué es, de dónde sale cada cosa y qué reglas seguimos.
 * Las cifras se leen de la base en cada visita, así que no envejecen ni se hinchan.
 */
async function contar(sql: string): Promise<number | null> {
  try {
    const [filas] = await pool.query<{ n: number }[]>(sql);
    return Number(filas[0]?.n ?? 0);
  } catch {
    return null;
  }
}

export default async function Sobre() {
  const [alojamientos, experiencias, servicios] = await Promise.all([
    contar("SELECT COUNT(*) AS n FROM accommodation WHERE status = 'published'"),
    contar("SELECT COUNT(*) AS n FROM experiencia WHERE is_active = 1"),
    contar("SELECT COUNT(*) AS n FROM servicio_turistico WHERE is_active = 1"),
  ]);
  const cifra = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-ES"));

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Sobre Hestiat</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Hestiat es un catálogo para encontrar dónde alojarse, qué hacer y qué servicios hay en toda
        España. Todo lo que se ve sale de datos reales: no hay fichas de relleno.
      </p>

      <section className="seccion-home">
        <h2>Qué hay ahora mismo</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>{cifra(alojamientos)}</b> alojamientos publicados
          </li>
          <li>
            <b>{cifra(experiencias)}</b> experiencias
          </li>
          <li>
            <b>{cifra(servicios)}</b> servicios
          </li>
        </ul>
        <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
          Son cifras leídas de la base en el momento de abrir esta página, no una promesa escrita.
        </p>
      </section>

      <section className="seccion-home">
        <h2>De dónde sale cada cosa</h2>
        <p style={{ lineHeight: 1.7 }}>
          La mayor parte del catálogo procede de <b>fuentes públicas</b> (OpenStreetMap y otras) y
          figura con su autoría. El resto lo publican los propios anfitriones desde su panel.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Las <b>fotografías</b> del catálogo son, en su mayoría, <b>imágenes de referencia del
          entorno</b>: no son fotos propias de cada negocio, y así se dice en cada ficha. Cuando se ha
          encontrado la <b>imagen oficial del propio sitio</b>, se muestra esa y se rotula como tal.
          Nunca se presenta una imagen de otra empresa o de otro lugar como si fuera de esta ficha.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Los <b>precios</b> se enseñan solo cuando están publicados. Si un precio es orientativo, va
          marcado como orientativo. Si no hay ninguno, la ficha dice <b>«Consultar»</b>: preferimos eso
          a inventar una cifra.
        </p>
      </section>

      <section className="seccion-home">
        <h2>Lo que no hacemos</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>No inventamos precios, valoraciones, teléfonos ni ubicaciones.</li>
          <li>No publicamos un filtro que no pueda devolver resultados reales.</li>
          <li>No mostramos una foto de otro sitio como si fuera de este.</li>
          <li>No vendemos posiciones ni destacamos fichas por pago.</li>
        </ul>
      </section>

      <p style={{ marginTop: 26 }}>
        Sigue por <Link href="/como-funciona" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>cómo funciona Hestiat</Link>{" "}
        o <Link href="/contacto" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>escríbenos</Link>.
      </p>
    </main>
  );
}
