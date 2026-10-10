import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth.server";
import { favoritosPorTipo } from "@/lib/favoritos.server";
import { pool, porIds } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import Corazon from "@/components/corazon";
import { Vacio } from "@/components/estados";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis favoritos — Hestiat",
  robots: { index: false, follow: false },
};

/**
 * FAVORITOS DEL USUARIO, EN LAS TRES CATEGORÍAS.
 *
 * Un solo sistema: alojamientos, experiencias y servicios, cada uno identificado por su tipo y su
 * identificador. Existe porque un favorito que no se puede volver a ver no sirve de nada. La cuadrícula
 * y las tarjetas son las mismas que en Explorar, para no inventar dos lenguajes visuales.
 */
async function filasCatalogo(tabla: "experiencia" | "servicio_turistico", ids: number[]) {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (limpios.length === 0) return [] as Record<string, unknown>[];
  const huecos = limpios.map(() => "?").join(",");
  const [filas] = await pool.query<any[]>(
    `SELECT id, name AS nombre, slug, category AS categoria FROM ${tabla} WHERE id IN (${huecos}) ORDER BY name LIMIT 500`,
    limpios,
  );
  return filas as unknown as Record<string, unknown>[];
}

function grupo(
  titulo: string,
  cuantos: number,
  plural: string,
  singular: string,
  children: React.ReactNode,
  verTodos: string,
) {
  if (cuantos === 0) return null;
  return (
    <section className="seccion-home" style={{ marginTop: 26 }}>
      <div className="seccion-cab">
        <h2>{titulo}</h2>
        <Link className="mas" href={verTodos}>
          Ver todas
        </Link>
      </div>
      <p className="galeria-cuenta">
        {cuantos.toLocaleString("es-ES")} {cuantos === 1 ? singular : plural}
      </p>
      {children}
    </section>
  );
}

export default async function MisFavoritos() {
  const sesion = await getCurrentUser();
  if (!sesion) redirect("/login?volver=%2Ffavoritos");

  const porTipo = await favoritosPorTipo(Number(sesion.id));
  const [alojFilas, expFilas, servFilas] = await Promise.all([
    porIds(porTipo.alojamiento),
    filasCatalogo("experiencia", porTipo.experiencia),
    filasCatalogo("servicio_turistico", porTipo.servicio),
  ]);
  const tarjetas = alojFilas.map((f) => aTarjeta(f as unknown as Record<string, unknown>));
  const total = tarjetas.length + expFilas.length + servFilas.length;

  return (
    <main className="explorar">
      <div className="explorar-cab">
        <h1>Mis favoritos</h1>
        <nav className="vista">
          <Link href="/search">Explorar más alojamientos</Link>
        </nav>
      </div>

      {total === 0 ? (
        <Vacio
          titulo="Todavía no has guardado nada"
          explicacion="Pulsa el corazón de cualquier alojamiento, experiencia o servicio y aparecerá aquí."
          accion={{ texto: "Explorar alojamientos", href: "/search" }}
        />
      ) : null}

      {grupo(
        "Alojamientos guardados",
        tarjetas.length,
        "alojamientos guardados",
        "alojamiento guardado",
        <div className="galeria">
          {tarjetas.map((t) => (
            <TarjetaAlojamiento key={t.id} a={t} guardado haySesion volverA="/favoritos" />
          ))}
        </div>,
        "/search",
      )}

      {grupo(
        "Experiencias guardadas",
        expFilas.length,
        "experiencias guardadas",
        "experiencia guardada",
        <ul className="ia-lista">
          {expFilas.map((f) => (
            <li key={String(f.id)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href={`/experiencias/${String(f.slug ?? "")}`}>{String(f.nombre ?? "")}</Link>
              {f.categoria ? <span className="m">{String(f.categoria)}</span> : null}
              <span style={{ position: "relative", width: 40, height: 32, display: "inline-block" }}>
                <Corazon tipo="experiencia" itemId={Number(f.id)} guardadoInicial haySesion volverA="/favoritos" />
              </span>
            </li>
          ))}
        </ul>,
        "/experiencias",
      )}

      {grupo(
        "Servicios guardados",
        servFilas.length,
        "servicios guardados",
        "servicio guardado",
        <ul className="ia-lista">
          {servFilas.map((f) => (
            <li key={String(f.id)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href={`/servicios/${String(f.slug ?? "")}`}>{String(f.nombre ?? "")}</Link>
              {f.categoria ? <span className="m">{String(f.categoria)}</span> : null}
              <span style={{ position: "relative", width: 40, height: 32, display: "inline-block" }}>
                <Corazon tipo="servicio" itemId={Number(f.id)} guardadoInicial haySesion volverA="/favoritos" />
              </span>
            </li>
          ))}
        </ul>,
        "/servicios",
      )}

      <p className="aviso" style={{ marginTop: 18 }}>
        Las fotografías del catálogo proceden de fuentes públicas y se muestran como
        <strong> referencia del entorno</strong>, no siempre como imágenes propias de cada propiedad.
      </p>
    </main>
  );
}
