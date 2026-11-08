import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Contacto — Hestiat",
  descripcion:
    "Escríbenos para corregir una ficha, resolver dudas sobre una reserva o publicar tu alojamiento. Contacto directo con el equipo de Hestiat.",
  ruta: "/contacto",
});

export default function Contacto() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Contacto</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Un solo correo para todo. Cuéntanos el caso con el enlace de la ficha si lo tienes a mano: se
        resuelve mucho antes.
      </p>

      <p style={{ fontSize: 20, marginBottom: 22 }}>
        <a href="mailto:hola@hestiat.com" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 700 }}>
          hola@hestiat.com
        </a>
      </p>

      <section className="seccion-home">
        <h2>Para qué escribirnos</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Corregir una ficha</b> que está mal o se ha quedado antigua (nombre, dirección, teléfono,
            web, horario).
          </li>
          <li>
            <b>Reclamar tu negocio</b>: si la ficha ya existe, te damos acceso para editarla. También
            puedes hacerlo desde <Link href="/reclamar">reclamar una ficha</Link>.
          </li>
          <li>
            <b>Dudas de una reserva</b>: indícanos el código de la reserva y las fechas.
          </li>
          <li>
            <b>Publicar tu alojamiento</b>: si prefieres que te acompañemos en el alta.
          </li>
          <li>
            <b>Incidencias del catálogo</b>: una foto que no corresponde, un precio mal marcado, algo que
            no debería estar publicado.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Qué hacemos con tu mensaje</h2>
        <p style={{ lineHeight: 1.7 }}>
          Se lee y se contesta al correo desde el que escribes. Si el asunto toca una ficha del
          catálogo, se revisa el dato en su fuente antes de cambiarlo: no modificamos información sin
          comprobarla.
        </p>
      </section>
    </main>
  );
}
