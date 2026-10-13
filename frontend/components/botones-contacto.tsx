import { publicables, enlaceWhatsApp, type ContactoPublicacion } from "@/lib/contacto.server";

/**
 * BOTONES DE CONTACTO DE UNA FICHA PÚBLICA.
 *
 * ── REGLA ÚNICA: SIN DESTINO VÁLIDO, NO HAY BOTÓN ───────────────────────────────────────────────
 * Cada botón se pinta solo si su dato es publicable Y válido. No hay botones que no lleven a
 * ninguna parte, ni huecos vacíos: si no hay nada que enseñar, el bloque entero no aparece.
 *
 * ── QUÉ NO HACE ─────────────────────────────────────────────────────────────────────────────────
 * · No enseña datos sin verificar: eso lo decide `publicables()` en el servidor, no este componente.
 * · No envía nada automáticamente. El botón de WhatsApp abre la conversación con el mensaje
 *   predefinido (nombre de la publicación y su URL); lo manda la persona que escribe.
 * · No inventa datos de contacto que no existan.
 */
export default function BotonesContacto({
  contacto,
  nombre,
  urlPublica,
  telefonoEtiqueta = "Llamar",
}: {
  contacto: ContactoPublicacion;
  /** Nombre de la publicación, para el mensaje de WhatsApp y para el texto alternativo. */
  nombre: string;
  /** URL pública de la ficha: va dentro del mensaje de WhatsApp. */
  urlPublica: string;
  telefonoEtiqueta?: string;
}) {
  const p = publicables(contacto);
  const ws = p.whatsapp ? enlaceWhatsApp(p.whatsapp, nombre, urlPublica) : null;

  const hay =
    p.telefono || ws || p.email || p.web || p.enlace || p.direccion;
  if (!hay) return null;

  const estilo = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radio-pill)",
    padding: "11px 18px",
    fontWeight: 600,
    textDecoration: "none",
  } as const;

  return (
    <section aria-label="Contacto" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: "clamp(18px,2.2vw,22px)", marginBottom: 6 }}>
        Contacto{p.nombre ? `: ${p.nombre}` : ""}
      </h2>
      {p.direccion ? (
        <p className="m" style={{ marginBottom: 10 }}>
          {p.direccion}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {ws ? (
          <a style={estilo} href={ws} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">💬</span> WhatsApp
          </a>
        ) : null}
        {p.telefono ? (
          <a style={estilo} href={`tel:${p.telefono.replace(/\s/g, "")}`}>
            <span aria-hidden="true">📞</span> {telefonoEtiqueta}
          </a>
        ) : null}
        {p.email ? (
          <a style={estilo} href={`mailto:${p.email}`}>
            <span aria-hidden="true">✉️</span> Enviar correo
          </a>
        ) : null}
        {p.web ? (
          <a style={estilo} href={p.web} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">🌐</span> Página web
          </a>
        ) : null}
        {p.enlace ? (
          <a style={estilo} href={p.enlace} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">📅</span> Reservar o consultar
          </a>
        ) : null}
      </div>
    </section>
  );
}
