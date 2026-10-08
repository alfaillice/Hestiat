import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preguntas frecuentes — Hestiat",
  description:
    "Por qué algunos precios dicen Consultar, de dónde salen los datos y las fotos, cómo reservar y cómo corregir una ficha: las dudas más habituales, respondidas sin rodeos.",
  alternates: { canonical: "/preguntas-frecuentes" },
};

interface Pregunta {
  q: string;
  a: React.ReactNode;
}

export default function PreguntasFrecuentes() {
  const preguntas: Pregunta[] = [
    {
      q: "¿Por qué algunas fichas dicen «Consultar» en el precio?",
      a: (
        <>
          Porque esa ficha no tiene ningún precio publicado y no nos lo inventamos. Puedes preguntar
          directamente usando el teléfono o la web que sí aparezcan en la ficha.
        </>
      ),
    },
    {
      q: "¿Qué significa que un precio sea «orientativo»?",
      a: (
        <>
          Que procede de una tarifa publicada por el propio sitio (por ejemplo «desde 12 €») y todavía
          no es un precio confirmado. Se enseña marcado como orientativo, nunca como precio cerrado.
        </>
      ),
    },
    {
      q: "¿Las fotos son del alojamiento o del negocio?",
      a: (
        <>
          En su mayoría son <b>imágenes de referencia del entorno</b>, y la ficha lo dice. Cuando se ha
          encontrado la imagen oficial del propio sitio, se muestra esa y se rotula como oficial. Nunca
          ponemos la foto de otro sitio en una ficha.
        </>
      ),
    },
    {
      q: "¿De dónde salen los datos del catálogo?",
      a: (
        <>
          De fuentes públicas como OpenStreetMap, con su autoría, y de lo que publican los propios
          anfitriones. Por eso puede haber fichas antiguas: si ves una que está mal, escríbenos o usa{" "}
          <Link href="/reclamar">reclamar una ficha</Link>.
        </>
      ),
    },
    {
      q: "¿Las valoraciones las generáis vosotros?",
      a: (
        <>
          No. Si una ficha muestra una valoración, es la que trae la fuente de la que procede el dato;
          no la calculamos ni la rellenamos nosotros.
        </>
      ),
    },
    {
      q: "¿Cómo reservo?",
      a: (
        <>
          Abre la ficha, elige fechas y número de personas y reserva. Recibirás la confirmación por
          correo y podrás consultar el estado de la reserva con su código.
        </>
      ),
    },
    {
      q: "¿Puedo publicar mi alojamiento? ¿Tiene coste?",
      a: (
        <>
          Sí puedes publicarlo desde «Publica tu espacio» en la cabecera, y publicar no tiene coste en
          Hestiat. Después lo gestionas todo desde tu panel: calendario, precios, fotos y reservas.
        </>
      ),
    },
    {
      q: "Veo un alojamiento de mi ciudad que no conozco.",
      a: (
        <>
          Es lo normal en un catálogo que arranca de fuentes públicas: recoge lo que ya estaba
          registrado. Si es tu negocio, reclama la ficha para completarla o corregirla; si es un error,
          cuéntanoslo y lo revisamos.
        </>
      ),
    },
    {
      q: "¿Puedo pedir que se retire una ficha?",
      a: (
        <>
          Sí. Escríbenos desde <Link href="/contacto">contacto</Link> o desde la reclamación de la ficha
          indicando cuál es, y se revisa.
        </>
      ),
    },
  ];

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Preguntas frecuentes</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Las dudas que más nos llegan, con la respuesta tal cual.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {preguntas.map((p, i) => (
          <details key={i} className="aviso" style={{ padding: "14px 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{p.q}</summary>
            <p style={{ margin: "10px 0 0", lineHeight: 1.7 }}>{p.a}</p>
          </details>
        ))}
      </div>

      <p style={{ marginTop: 26 }}>
        ¿No está tu duda? Escríbenos desde{" "}
        <Link href="/contacto" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>contacto</Link>.
      </p>
    </main>
  );
}
