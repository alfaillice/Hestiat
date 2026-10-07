import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth.server";
import { favoritosDe, guardadosEntre } from "@/lib/favoritos.server";
import { porIds } from "@/lib/db";
import { aTarjeta } from "@/lib/tarjetas";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import { Vacio } from "@/components/estados";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis favoritos — Hestiat",
  robots: { index: false, follow: false },
};

/**
 * Alojamientos guardados por el usuario.
 *
 * Existe porque un favorito que no se puede volver a ver no sirve de nada: si el corazón guarda de
 * verdad, tiene que haber un sitio donde aparezcan. La misma cuadrícula y la misma tarjeta que en
 * Explorar, para no inventar dos lenguajes visuales.
 */
export default async function MisFavoritos() {
  const sesion = await getCurrentUser();
  if (!sesion) redirect("/login?volver=%2Ffavoritos");

  const ids = await favoritosDe(Number(sesion.id));
  const filas = await porIds(ids);
  const tarjetas = filas.map((f) => aTarjeta(f as unknown as Record<string, unknown>));
  const guardados = await guardadosEntre(Number(sesion.id), tarjetas.map((t) => t.id));

  return (
    <main className="explorar">
      <div className="explorar-cab">
        <h1>Mis favoritos</h1>
        <nav className="vista">
          <Link href="/search">Explorar más alojamientos</Link>
        </nav>
      </div>

      {tarjetas.length === 0 ? (
        <Vacio
          titulo="Todavía no has guardado ningún alojamiento"
          explicacion="Pulsa el corazón de cualquier tarjeta al explorar y aparecerá aquí."
          accion={{ texto: "Explorar alojamientos", href: "/search" }}
        />
      ) : (
        <>
          <p className="galeria-cuenta">
            {tarjetas.length.toLocaleString("es-ES")} {tarjetas.length === 1 ? "alojamiento guardado" : "alojamientos guardados"}
          </p>
          <div className="galeria">
            {tarjetas.map((t) => (
              <TarjetaAlojamiento key={t.id} a={t} guardado={guardados.has(t.id)} haySesion volverA="/favoritos" />
            ))}
          </div>
        </>
      )}

      <p className="aviso" style={{ marginTop: 18 }}>
        Las fotografías del catálogo proceden de fuentes públicas y se muestran como
        <strong> referencia del entorno</strong>, no siempre como imágenes propias de cada propiedad.
      </p>
    </main>
  );
}
