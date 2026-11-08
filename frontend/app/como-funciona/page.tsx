import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Cómo funciona Hestiat — para quien busca y para quien ofrece",
  descripcion:
    "Buscar dónde alojarse, reservar, guardar favoritos y publicar tu propio espacio: así funciona Hestiat, paso a paso, sin letra pequeña.",
  ruta: "/como-funciona",
});

export default function ComoFunciona() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Cómo funciona Hestiat</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Dos caminos: encontrar sitio, o publicar el tuyo. Sin pasos escondidos.
      </p>

      <section className="seccion-home">
        <h2>Si buscas dónde alojarte</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li>
            <b>Busca</b> en la barra de la cabecera por ciudad, provincia, zona o nombre. También puedes
            entrar por <Link href="/search">Alojamientos</Link>, <Link href="/experiencias">Experiencias</Link> o{" "}
            <Link href="/servicios">Servicios</Link>.
          </li>
          <li>
            <b>Filtra</b> por destino, categoría, fechas y viajeros en Alojamientos. Los filtros solo
            ofrecen lo que existe de verdad en el catálogo.
          </li>
          <li>
            <b>Abre la ficha</b>: verás la ubicación en el mapa, las fotos con su procedencia, los datos
            de contacto publicados y, si hay precio, su precio.
          </li>
          <li>
            <b>Reserva</b> con tus fechas y el número de personas. Recibirás la confirmación por correo,
            y podrás consultar el estado de tu reserva en cualquier momento con su código.
          </li>
          <li>
            <b>Guarda lo que te guste</b> en <Link href="/favoritos">Favoritos</Link> para volver luego.
          </li>
        </ol>
      </section>

      <section className="seccion-home">
        <h2>Si ofreces un alojamiento</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li>
            <b>Publica tu espacio</b> desde «Publica tu espacio» en la cabecera. Publicar no tiene coste
            en Hestiat.
          </li>
          <li>
            <b>Confirma tu correo</b> con el enlace que te enviamos.
          </li>
          <li>
            <b>Gestiona todo desde tu panel</b>: el calendario de disponibilidad, los precios, las fotos
            y las reservas que te lleguen.
          </li>
          <li>
            <b>Conecta tu calendario</b> si ya usas otro: puedes importar y exportar en formato iCal para
            no vender dos veces la misma noche.
          </li>
          <li>
            <b>Recibe aviso por correo</b> de cada reserva, con los datos del huésped para poder
            responderle.
          </li>
        </ol>
      </section>

      <section className="seccion-home">
        <h2>Si una ficha ya existe y quieres corregirla</h2>
        <p style={{ lineHeight: 1.7 }}>
          Buena parte del catálogo viene de fuentes públicas, así que puede haber fichas antiguas o
          incompletas. Si es tu negocio y quieres completarla, corregirla o pedir que se retire, usa{" "}
          <Link href="/reclamar">reclamar una ficha</Link>: se revisa y se te da acceso para editarla.
        </p>
      </section>

      <p style={{ marginTop: 26 }}>
        ¿Alguna duda que no esté aquí? Está en{" "}
        <Link href="/preguntas-frecuentes" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>preguntas frecuentes</Link>{" "}
        o escríbenos desde <Link href="/contacto" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>contacto</Link>.
      </p>
    </main>
  );
}
