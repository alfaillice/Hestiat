import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Experiencias — Hestiat",
  description:
    "Experiencias y planes con carácter en toda España. Fase de datos en preparación.",
  alternates: { canonical: "/experiencias" },
};

/**
 * `/experiencias` — fase en preparación.
 *
 * HONESTIDAD DE DATOS: la base original contiene 248.460 registros de experiencias, pero
 * el esquema NUEVO todavía no tiene su tabla: la migración de experiencias es la siguiente
 * fase de datos. Esta página NO inventa cifras ni muestra datos sin respaldo; si el esquema
 * aún no la tiene, lo dice con claridad en lugar de simular un catálogo vacío.
 *
 * Cuando exista `experience` en el esquema nuevo, esta consulta empezará a devolver filas
 * sin cambiar nada más.
 */
async function contarExperiencias(): Promise<{ disponible: boolean; total: number }> {
  try {
    const { pool } = await import("@/lib/db");
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM `experience` WHERE status = 'published'");
    const n = Number((rows as Array<{ n: number }>)[0]?.n ?? 0);
    return { disponible: true, total: n };
  } catch {
    return { disponible: false, total: 0 };
  }
}

export default async function Experiencias() {
  const { disponible, total } = await contarExperiencias();

  return (
    <main className="wrap">
      <h1 style={{ fontSize: 40, lineHeight: 1.12, margin: "30px 0 8px", maxWidth: "22ch" }}>
        Planes con carácter
      </h1>
      <p className="meta" style={{ maxWidth: "60ch" }}>
        Rutas, talleres, gastronomía y naturaleza, contados como parte del viaje y no como
        un añadido. Es la siguiente fase de datos del proyecto.
      </p>

      {disponible ? (
        <p className="count" style={{ marginTop: 18 }}>
          {total.toLocaleString("es-ES")} experiencias publicadas
        </p>
      ) : (
        <p className="warn" style={{ marginTop: 22 }}>
          <strong>Fase en preparación.</strong> Los registros de experiencias ya están en la base
          original (248.460) y el esquema nuevo para ellas es el siguiente paso de la migración.
          Mientras tanto, esta página lo dice en lugar de mostrar un catálogo vacío o cifras sin
          respaldo. <Link href="/" style={{ color: "var(--olive)", textDecoration: "underline" }}>Ver alojamientos</Link>
        </p>
      )}

      <p className="warn">
        Misma consulta servirá cuando exista la tabla <code>experience</code> en el esquema nuevo:
        esta página no habrá que reescribirla.
      </p>
    </main>
  );
}
