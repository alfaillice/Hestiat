import { publicables, enlaceWhatsApp, type ContactoPublicacion } from "@/lib/contacto.server";

/**
 * BOTONES DE CONTACTO DIRECTO — componente ÚNICO para Alojamientos, Experiencias y Servicios.
 *
 * Reglas que aplica (y que no se delegan a quien lo usa):
 *  · Solo se muestra un canal si existe Y es publicable (`publicables()` exige estado verified).
 *  · El contacto va SIEMPRE al establecimiento. Nunca al administrador, nunca a un intermediario.
 *  · WhatsApp abre `wa.me` con el número normalizado y un mensaje predefinido que NO se envía solo.
 *  · Sin canal válido no se dibuja ningún botón: no hay botones vacíos ni ficticios.
 *  · Orden visual: WhatsApp → Teléfono → Correo → Web.
 *
 * Diseño: identidad de Hestiat. Rosa pastel para el marco y los botones neutros, verde
 * característico para WhatsApp. Iconos SVG propios (no emojis), accesibles y escalables.
 * NO se tocan los colores globales de la web: todo se pinta con tokens ya existentes.
 */

/**
 * VALIDACIÓN DEL FORMULARIO DE CONTACTO.
 *
 * Solo se publica una URL de formulario si cumple TODO:
 *   · es http(s) y absoluta;
 *   · NO es la portada del sitio (debe tener ruta: una portada no es un formulario);
 *   · la ruta sugiere contacto (contact, contacto, contactar, contact-us, kontakt, formulario…);
 *   · el host pertenece al establecimiento, o es un proveedor de formularios conocido
 *     (Google Forms, Typeform, Jotform) cuya vinculación es explícita.
 * Si hay cualquier duda, devuelve null y el botón NO se pinta. Nunca se inventa una URL.
 */
const PROVEEDORES_FORMULARIO = ["docs.google.com", "forms.gle", "form.typeform.com", "typeform.com", "form.jotform.com", "jotform.com"];
const RUTA_CONTACTO = /(contact|contacto|contactar|contacte|contactez|kontakt|formulario|form|consulta|mensaje|message)/i;

export function validarUrlFormulario(crudo: string | null | undefined, webOficial?: string | null): string | null {
  const u = String(crudo ?? "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;
  let url: URL;
  try { url = new URL(u); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const ruta = `${url.pathname}${url.search}`.replace(/^\/+$/, "");
  // Una portada no es un formulario.
  if (!ruta || ruta === "" || ruta === "/") return null;
  const proveedor = PROVEEDORES_FORMULARIO.some((p) => url.hostname === p || url.hostname.endsWith(`.${p}`));
  const propio = (() => {
    const w = String(webOficial ?? "").trim();
    if (!w) return false;
    try {
      const hostWeb = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, "");
      return url.hostname.replace(/^www\./, "") === hostWeb;
    } catch { return false; }
  })();
  if (!proveedor && !propio) return null;          // dominio ajeno y no es proveedor acreditado
  if (!RUTA_CONTACTO.test(ruta)) return null;      // la ruta no es de contacto
  return url.toString();
}

export default function BotonesContacto({
  contacto,
  nombre,
  urlPublica,
  telefonoEtiqueta = "Llamar",
  titulo = "Contactar con el establecimiento",
  avisoSinContacto = false,
  formulario = null,
  formularioEtiqueta = "Formulario de contacto",
}: {
  contacto: ContactoPublicacion;
  /** Nombre de la publicación, para el mensaje de WhatsApp y el texto alternativo. */
  nombre: string;
  /** URL pública de la ficha: va dentro del mensaje de WhatsApp. */
  urlPublica?: string;
  telefonoEtiqueta?: string;
  titulo?: string;
  /**
   * Aviso discreto cuando no hay ningún canal publicable.
   *
   * Se activa SOLO donde el visitante espera encontrar contacto (fichas de alojamiento). En
   * Experiencias y Servicios se deja en falso: allí una ficha sin contacto es normal y su
   * instrucción es no mostrar nada vacío. No inventa datos ni presenta contactos sin verificar.
   */
  avisoSinContacto?: boolean;
  /**
   * URL del FORMULARIO OFICIAL de contacto. Cadena suelta a propósito: no obliga a tocar el tipo
   * compartido ContactoPublicacion ni la función publicables(), que siguen intactos.
   * Solo se pinta si supera validarUrlFormulario().
   */
  formulario?: string | null;
  formularioEtiqueta?: string;
}) {
  const p = publicables(contacto);
  const url = urlPublica ?? "https://hestiat.com";
  const ws = p.whatsapp ? enlaceWhatsApp(p.whatsapp, nombre, url) : null;
  // La URL del formulario llega por dos vías, sin duplicar estructuras:
  //   1. la prop explícita `formulario` (para quien quiera pasarla desde su consulta);
  //   2. el campo `enlace` del contacto compartido, que YA existe y usa el formulario de contacto.
  // El validador decide en ambos casos: si no es un formulario legítimo, no se pinta.
  const form = validarUrlFormulario(formulario ?? contacto.enlace, p.web);

  const hayAlguno = Boolean(ws || p.telefono || p.email || p.web || form);
  if (!hayAlguno) {
    if (!avisoSinContacto) return null;
    return (
      <div className="cc-bloque">
        <style>{`
          .cc-aviso{margin:22px 0;padding:14px 18px;border:1px dashed var(--border);
            border-radius:calc(var(--radio) + 4px);background:var(--card)}
          .cc-aviso p{margin:0;font-size:14px;color:var(--muted-fg)}
          .cc-aviso strong{color:var(--ink)}
        `}</style>
        <div className="cc-aviso">
          <p>
            <strong>Sin contacto directo verificado.</strong> Todavía no disponemos de teléfono,
            correo ni web de este alojamiento comprobados por Hestiat. No mostramos datos sin
            verificar para no publicar información que no sea del establecimiento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-bloque">
      <style>{`
        .cc-bloque{margin:22px 0}
        .cc-titulo{font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
          color:var(--hestiat-primary-texto);margin:0 0 12px}
        .cc-rejilla{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
          max-width:640px}
        .cc-btn{display:flex;align-items:center;gap:10px;min-height:48px;padding:12px 16px;
          border-radius:999px;font-weight:600;font-size:15px;line-height:1.2;text-decoration:none;
          border:1px solid var(--border);background:var(--card);color:var(--ink);
          transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
        .cc-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.10)}
        .cc-btn:focus-visible{outline:3px solid var(--hestiat-primary);outline-offset:2px}
        /* ICONOS: tamaño, color y display EXPLÍCITOS.
           Antes los SVG usaban stroke="currentColor" y heredaban el color del contenedor; si ese
           color coincidía con el fondo, el trazo quedaba invisible aunque el icono estuviera ahí
           (el botón se veía, el dibujo no). Ahora el color se fija en la regla y cada botón lo
           sobreescribe donde toca, así que nunca puede heredar un valor transparente. */
        .cc-btn svg{flex:0 0 20px;width:20px;height:20px;display:block;color:var(--ink);
          stroke:currentColor;fill:none;stroke-width:1.9}
        .cc-btn.cc-wa svg{color:#04301A}
        .cc-btn.cc-tel svg,.cc-btn.cc-mail svg,.cc-btn.cc-web svg,.cc-btn.cc-form svg{color:var(--hestiat-primary-texto)}
        /* WhatsApp: verde característico, con contraste suficiente */
        .cc-wa{background:#25D366;border-color:#1EBE5A;color:#04301A;font-weight:700}
        .cc-wa:hover{background:#1EBE5A}
        /* Teléfono, correo y web: rosa pastel de Hestiat, armonizados entre sí */
        .cc-tel{background:var(--fucsia-soft);border-color:var(--hestiat-primary)}
        .cc-mail{background:var(--fucsia-soft);border-color:var(--hestiat-primary)}
        .cc-web{background:var(--card);border-color:var(--hestiat-primary)}
        /* Formulario de contacto: mismo lenguaje visual que el resto, con acento propio. */
        .cc-form{background:var(--fucsia-soft);border-color:var(--hestiat-primary)}
        .cc-form:hover{background:var(--card)}
        .cc-etq{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media (max-width:520px){
          .cc-rejilla{grid-template-columns:1fr}
          .cc-btn{width:100%;min-height:52px}
        }
        @media (prefers-reduced-motion:reduce){ .cc-btn{transition:none} }
      `}</style>

      <p className="cc-titulo">{titulo}</p>

      <div className="cc-rejilla">
        {ws && (
          <a className="cc-btn cc-wa" href={ws} target="_blank" rel="noopener noreferrer"
             aria-label={`Abrir conversación de WhatsApp con ${nombre}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.24-8.24 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>
            </svg>
            <span className="cc-etq">WhatsApp</span>
          </a>
        )}

        {p.telefono && (
          <a className="cc-btn cc-tel" href={`tel:${String(p.telefono).replace(/[^\d+]/g, "")}`}
             aria-label={`${telefonoEtiqueta} al ${p.telefono}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>
            </svg>
            <span className="cc-etq">{telefonoEtiqueta} · {p.telefono}</span>
          </a>
        )}

        {p.email && (
          <a className="cc-btn cc-mail" href={`mailto:${p.email}`}
             aria-label={`Escribir un correo a ${nombre}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/>
              <path d="m3 6 9 6.5L21 6"/>
            </svg>
            <span className="cc-etq">Correo</span>
          </a>
        )}

        {p.web && (
          <a className="cc-btn cc-web" href={/^https?:/i.test(p.web) ? p.web : `https://${p.web}`}
             target="_blank" rel="noopener noreferrer" aria-label={`Abrir la web oficial de ${nombre}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9.2"/>
              <path d="M2.8 12h18.4M12 2.8c2.4 2.6 3.6 5.6 3.6 9.2s-1.2 6.6-3.6 9.2c-2.4-2.6-3.6-5.6-3.6-9.2s1.2-6.6 3.6-9.2z"/>
            </svg>
            <span className="cc-etq">Web oficial</span>
          </a>
        )}

        {form && (
          <a className="cc-btn cc-form" href={form} target="_blank" rel="noopener noreferrer"
             aria-label={`Abrir el formulario de contacto de ${nombre}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.9-.4L4 21l1.4-4.1A8.3 8.3 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>
              <path d="M8.5 10.5h7M8.5 13.8h4.5"/>
            </svg>
            <span className="cc-etq">{formularioEtiqueta}</span>
          </a>
        )}
      </div>
    </div>
  );
}
