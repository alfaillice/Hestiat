import type { Metadata } from "next";
import Resultados from "@/components/resultados";
import HeroHome from "@/components/hero-home";
import SeccionHome from "@/components/seccion-home";
import TarjetaDestino from "@/components/tarjeta-destino";
import TarjetaCategoria from "@/components/tarjeta-categoria";
import TarjetaAlojamiento from "@/components/tarjeta-alojamiento";
import CercaDeTi from "@/components/cerca-de-ti";
import BloquePublicaGratis from "@/components/bloque-publica-gratis";
import EspacioPublicidad from "@/components/espacio-publicidad";
import { aTarjeta } from "@/lib/tarjetas";
import { destacados } from "@/lib/db";
import { destinosParaTi, categoriasServicio, categoriasExperiencia } from "@/lib/home.server";
import { getCurrentUser } from "@/lib/auth.server";
import { guardadosEntre } from "@/lib/favoritos.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hestiat — Alojamientos, experiencias y servicios en toda España",
  description:
    "Descubre y reserva alojamientos con carácter, experiencias únicas y servicios locales en toda España. Los precios, tal cual: sin comisiones y sin sorpresas.",
  alternates: { canonical: "/" },
};

/**
 * Portada de Hestiat.
 *
 * Es una página para DESCUBRIR: un fondo visual con el contenido encima desde el primer momento,
 * tres accesos claros (Alojamientos, Experiencias, Servicios) y cuatro filas que se recorren a
 * gusto —destinos, servicios, experiencias y alojamientos reales—, cada una con «Ver todos».
 *
 * Dos reglas que se respetan en toda la página:
 *
 *  · NADA INVENTADO. Los destinos, las categorías y sus recuentos salen de la base real; los
 *    alojamientos usan la misma consulta y la misma tarjeta que Explorar, así que el precio es
 *    exactamente el mismo. Las fotos de destino son fotografías reales de cada monumento.
 *  · NADA BLOQUEA. El vídeo es un fondo: no detiene la carga, ni el scroll, ni los clics.
 *
 * La búsqueda ya no vive aquí: está en la cabecera, disponible en todas las páginas. Esta ruta
 * sigue atendiendo `/?q=...`, que es donde apuntan los enlaces antiguos.
 */
export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);

  // Enlace antiguo de resultados en la raíz: se sigue sirviendo igual.
  if (q !== "" || pagina > 1) {
    return (
      <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: "Hestiat",
                url: "https://hestiat.com",
                description:
                  "Alojamientos, experiencias y servicios de toda España. Publicar es gratis: sin cuotas de publicación ni comisiones de Hestiat.",
                inLanguage: "es",
              },
              { "@type": "Organization", name: "Hestiat", url: "https://hestiat.com", email: "hola@hestiat.com" },
            ],
          }),
        }}
      />
      <main className="inicio">
        <div className="wrap">
          <SeccionHome titulo={`Resultados para «${q}»`} verTodos="/search" verTodosTexto="Buscar otra cosa">
            <p className="seccion-home-sub" style={{ padding: "4px 0" }}>
              Puedes afinar la búsqueda desde la barra de arriba.
            </p>
          </SeccionHome>
          <section className="seccion-home">
            <Resultados q={q} pagina={pagina} basePath="/" />
          </section>
        </div>
      </main>
      </>
    );
  }

  const sesion = await getCurrentUser();
  const [destinos, servicios, experiencias, alojamientos] = await Promise.all([
    destinosParaTi(),
    categoriasServicio(8),
    categoriasExperiencia(8),
    destacados(8),
  ]);
  const tarjetas = alojamientos.map((a) => aTarjeta(a as unknown as Record<string, unknown>));
  const guardados = sesion
    ? await guardadosEntre(Number(sesion.id), "alojamiento", tarjetas.map((t) => t.id))
    : new Set<number>();

  return (
    <main className="inicio">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "Hestiat",
                  url: "https://hestiat.com",
                  description:
                    "Alojamientos, experiencias y servicios de toda España. Publicar es gratis: sin cuotas de publicación ni comisiones de Hestiat.",
                  inLanguage: "es",
                },
                { "@type": "Organization", name: "Hestiat", url: "https://hestiat.com", email: "hola@hestiat.com" },
              ],
            }),
          }}
        />

      <HeroHome
        poster="/hero/hero-poster-1600.webp"
        posterMovil="/hero/hero-poster-900.webp"
        video="/hero/hero.mp4"
        videoMovil="/hero/hero-movil.mp4"
        credito="Escena de ambientación, no es un alojamiento concreto"
      />

      <div className="wrap">
        {/* Segundo anuncio de la portada: justo después del vídeo, al arrancar el contenido, dentro
            del ancho de la página. Etiquetado y sin ocupar nada mientras no haya anuncio. */}
        <EspacioPublicidad hueco="portada-tras-video" />
        <SeccionHome
          titulo="Destinos para ti"
          sub="Ciudades del catálogo con alojamientos publicados, con su recuento real"
          verTodos="/search"
        >
          {destinos.map((d) => (
            <TarjetaDestino key={d.nombre} destino={d} />
          ))}
        </SeccionHome>

        {/* Hueco de publicidad previsto: hoy no dibuja nada (ver lib/publicidad.ts). */}
        <EspacioPublicidad hueco="portada-tras-destinos" />

        <SeccionHome
          titulo="Servicios populares"
          sub="Las categorías de Hestiat con más servicios reales"
          verTodos="/servicios"
        >
          {servicios.map((c) => (
            <TarjetaCategoria key={c.valor} categoria={c} pie="servicios" />
          ))}
        </SeccionHome>

        <SeccionHome
          titulo="Experiencias destacadas"
          sub="Las categorías de Hestiat con más experiencias reales"
          verTodos="/experiencias"
        >
          {experiencias.map((c) => (
            <TarjetaCategoria key={c.valor} categoria={c} pie="experiencias" />
          ))}
        </SeccionHome>

        <SeccionHome
          titulo="Alojamientos destacados"
          sub="Del catálogo real, con el mismo precio que verás en su ficha"
          verTodos="/search"
        >
          {tarjetas.map((t) => (
            <TarjetaAlojamiento
              key={t.id}
              a={t}
              guardado={guardados.has(t.id)}
              haySesion={Boolean(sesion)}
              volverA="/"
            />
          ))}
        </SeccionHome>

        {/* Sin ubicación, esta sección usa el destino de la búsqueda (o el último buscado) y lo dice
            en su título; si no hay ninguno, pasa a ser «Descubre alojamientos». Nunca finge
            proximidad. */}
        <CercaDeTi destino={q || undefined} />

        {/* El modelo de negocio, dicho claro y en su sitio: publicar en Hestiat no cuesta nada. */}
        <BloquePublicaGratis />

        <p className="aviso pie-inicio">
          Los alojamientos, sus precios y sus fotografías salen del catálogo real de Hestiat. Las
          fotografías del catálogo proceden de fuentes públicas y se muestran como referencia del
          entorno, no siempre como imágenes propias de cada propiedad. Las imágenes de las secciones
          de servicios y experiencias son de ambientación, y así se indica en cada tarjeta.
        </p>
      </div>
    </main>
  );
}
