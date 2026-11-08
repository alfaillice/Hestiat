import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Centro de ayuda — Hestiat",
  descripcion:
    "Ayuda de Hestiat para huéspedes y anfitriones: cómo reservar, cómo publicar, qué hacer con una reserva, cancelaciones, seguridad y contacto directo.",
  ruta: "/ayuda",
});

/** Centro de ayuda: índice real, con enlaces a páginas que existen. */
export default function Ayuda() {
  const bloques: { titulo: string; enlaces: [string, string][] }[] = [
    {
      titulo: "Para quien busca alojamiento",
      enlaces: [
        ["Cómo reservar", "/como-reservar"],
        ["Preguntas frecuentes", "/preguntas-frecuentes"],
        ["Favoritos", "/favoritos"],
        ["Seguridad", "/seguridad"],
      ],
    },
    {
      titulo: "Para anfitriones y proveedores",
      enlaces: [
        ["Hazte anfitrión", "/hazte-anfitrion"],
        ["Publicar alojamiento", "/nuevo"],
        ["Condiciones para anfitriones", "/condiciones-anfitrion"],
        ["Reclamar una ficha que ya existe", "/reclamar"],
      ],
    },
    {
      titulo: "Reservas y después",
      enlaces: [
        ["Consultar una reserva por su código", "/reserva"],
        ["Cancelaciones", "/cancelaciones"],
        ["Contacto", "/contacto"],
      ],
    },
    {
      titulo: "Sobre el catálogo",
      enlaces: [
        ["Sobre Hestiat", "/sobre"],
        ["Cómo funciona", "/como-funciona"],
        ["Destinos", "/destinos"],
      ],
    },
  ];

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Centro de ayuda</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Todo lo que hay escrito hoy, ordenado por para qué lo necesitas.
      </p>

      {bloques.map((b) => (
        <section className="seccion-home" key={b.titulo}>
          <h2>{b.titulo}</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {b.enlaces.map(([texto, ruta]) => (
              <li key={ruta}>
                <Link href={ruta}>{texto}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p style={{ marginTop: 20 }}>
        ¿No encuentras lo que buscas? Escríbenos a{" "}
        <a href="mailto:hola@hestiat.com" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>
          hola@hestiat.com
        </a>
        .
      </p>
    </main>
  );
}
