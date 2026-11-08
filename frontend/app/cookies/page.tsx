import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Política de cookies — Hestiat",
  descripcion:
    "Qué cookies usa Hestiat: una cookie técnica de sesión, imprescindible, y las cookies de publicidad de Google AdSense, que solo se activan con tu consentimiento previo.",
  ruta: "/cookies",
});

/**
 * POLÍTICA DE COOKIES.
 *
 * Actualizada el 12 de octubre de 2026 al instalar Google AdSense en el sitio. Hasta esa fecha esta
 * página decía que no había cookies de publicidad ni de terceros y que por eso no hacía falta aviso
 * de consentimiento. Ya no es verdad: hay publicidad de Google, y necesita consentimiento previo.
 *
 * Lo que aquí se afirma está comprobado, no supuesto:
 *  · La cookie de sesión: se ve en el código de `lib/auth.server.ts` (HttpOnly, Secure, SameSite=Lax).
 *  · El script de AdSense: está en el <head> del documento raíz y sale en el HTML de todas las páginas.
 *  · La auditoría de la web (12-10-2026) midió que el ÚNICO servicio de terceros que se carga es
 *    pagead2.googlesyndication.com, y que no hay analítica, ni píxeles, ni otros rastreadores.
 *
 * No se enumeran aquí nombres concretos de cookies de Google porque las que instala dependen de su
 * propio funcionamiento y todavía no están medidas; se indicará el detalle cuando la auditoría se
 * repita con el mensaje de consentimiento ya publicado.
 */
export default function Cookies() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Política de cookies</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Última actualización: 12 de octubre de 2026.
      </p>

      <section className="seccion-home">
        <h2>1. Qué es una cookie</h2>
        <p style={{ lineHeight: 1.7 }}>
          Un pequeño archivo que el navegador guarda cuando visitas una web y que permite, por ejemplo,
          recordar que ya has iniciado sesión. No es un programa ni puede leer archivos de tu equipo.
        </p>
        <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
          Responsable del sitio: <b>JM TRIVINO</b> · NIF 22009686C · Partida Carrus P1-137, Alicante ·{" "}
          <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>
        </p>
      </section>

      <section className="seccion-home">
        <h2>2. Cookies propias: solo la de sesión</h2>
        <p style={{ lineHeight: 1.7 }}>
          Hestiat instala <b>una sola cookie propia</b>, y solo cuando inicias sesión:
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 10px" }}>Nombre</th>
                <th style={{ padding: "8px 10px" }}>Tipo</th>
                <th style={{ padding: "8px 10px" }}>Para qué</th>
                <th style={{ padding: "8px 10px" }}>Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px" }}>
                  <code>hestiat_sesion</code>
                </td>
                <td style={{ padding: "8px 10px" }}>Técnica propia, necesaria</td>
                <td style={{ padding: "8px 10px" }}>
                  Mantener tu sesión abierta para que puedas gestionar tu cuenta y tus reservas sin
                  volver a identificarte en cada página.
                </td>
                <td style={{ padding: "8px 10px" }}>Hasta 30 días o hasta que cierres sesión</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ lineHeight: 1.7, marginTop: 12 }}>
          Se envía marcada como <code>HttpOnly</code> (no accesible desde el código de la página),{" "}
          <code>Secure</code> (solo por HTTPS) y con política <code>SameSite=Lax</code>. Es
          imprescindible para que la sesión funcione, así que <b>no requiere consentimiento previo</b>:
          es una cookie técnica exenta. Puedes verla y borrarla en cualquier momento desde tu navegador.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Cookies de terceros: publicidad de Google (AdSense)</h2>
        <p style={{ lineHeight: 1.7 }}>
          Hestiat muestra publicidad a través de <b>Google AdSense</b>. Para ello, todas las páginas
          cargan un script de Google (<code>pagead2.googlesyndication.com</code>) que puede instalar
          cookies en <b>dominios de Google</b>, no en el nuestro.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Esas cookies se usan para <b>mostrar anuncios, medirlos y limitar las veces que ves el mismo</b>.
          Esta es publicidad de un tercero, y por eso <b>sí necesita tu consentimiento previo</b>.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 10px" }}>Quién</th>
                <th style={{ padding: "8px 10px" }}>Tipo</th>
                <th style={{ padding: "8px 10px" }}>Para qué</th>
                <th style={{ padding: "8px 10px" }}>Base jurídica</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px" }}>Google (AdSense)</td>
                <td style={{ padding: "8px 10px" }}>Terceros, publicidad</td>
                <td style={{ padding: "8px 10px" }}>
                  Mostrar anuncios, medir su rendimiento, limitar la repetición y, si lo aceptas,
                  personalizarlos según tu navegación.
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <b>Tu consentimiento</b> (art. 6.1.a RGPD)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ lineHeight: 1.7, marginTop: 12 }}>
          Google actúa como responsable independiente de esas cookies. Puedes consultar su tratamiento
          en la política de privacidad de Google y gestionar la personalización de anuncios en sus
          ajustes de anuncios. La transferencia de datos que realiza Google puede implicar países fuera
          del Espacio Económico Europeo, amparada en sus propias garantías.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          <b>El aviso de consentimiento.</b> Al entrar verás un aviso de cookies propio, con dos
          botones del mismo tamaño: <b>aceptar</b> o <b>rechazar</b> la publicidad. Mientras no
          aceptes, no se carga nada de publicidad: ni el bloque de anuncio ni las cookies de Google.
          Si rechazas, el sitio sigue funcionando exactamente igual. Y si cambias de opinión, el
          enlace <b>«Configurar cookies»</b> del pie de página reabre el aviso para retirar o dar el
          permiso cuando quieras.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Además, Google publica su propio mensaje de consentimiento (su sistema CMP) cuando el sitio
          sirve publicidad personalizada en el Espacio Económico Europeo, y es el que recoge el
          consentimiento que Google exige para su publicidad.
        </p>
      </section>

      <section className="seccion-home">
        <h2>4. Lo que Hestiat no usa</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>No</b> hay herramientas de analítica: la navegación no se mide con Google Analytics ni con
            ninguna otra.
          </li>
          <li>
            <b>No</b> hay píxeles de redes sociales.
          </li>
          <li>
            <b>No</b> hay cookies propias de publicidad, de perfilado ni de seguimiento. Fuera del
            script de Google, la web no carga ningún otro servicio de terceros.
          </li>
        </ul>
        <p style={{ lineHeight: 1.7 }}>
          Esto está comprobado: la auditoría de cookies del 12 de octubre de 2026 midió que el único
          servicio externo que se carga es el de Google, y que el sitio no hace peticiones a
          rastreadores publicitarios ni de analítica.
        </p>
      </section>

      <section className="seccion-home">
        <h2>5. Si no quieres que se guarden</h2>
        <p style={{ lineHeight: 1.7 }}>
          Puedes <b>rechazar la publicidad</b> en el propio aviso de cookies cuando entres, sin que eso
          te impida usar el sitio. Además, puedes bloquear o eliminar todas las cookies desde los
          ajustes de tu navegador (privacidad y seguridad). Ten en cuenta que, si bloqueas la cookie de
          sesión, <b>no podrás mantener la sesión iniciada</b> y tendrás que identificarte en cada
          visita. El resto del sitio, la búsqueda y las fichas, seguirá funcionando con normalidad.
        </p>
      </section>

      <p style={{ marginTop: 26 }}>
        Para cualquier duda sobre esta política, escribe a{" "}
        <a href="mailto:hola@hestiat.com" style={{ color: "var(--hestiat-primary-texto)", fontWeight: 600 }}>
          hola@hestiat.com
        </a>{" "}
        o consulta la <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </main>
  );
}
