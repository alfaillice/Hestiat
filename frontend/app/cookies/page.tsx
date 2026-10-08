import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Política de cookies — Hestiat",
  descripcion:
    "Hestiat no usa cookies de analítica, publicidad ni seguimiento. Solo una cookie técnica de sesión, necesaria para mantener tu cuenta abierta mientras navegas.",
  ruta: "/cookies",
});

/**
 * POLÍTICA DE COOKIES.
 * Comprobado en el código y en el servidor: en Hestiat hay UNA sola cookie, la de sesión, y es
 * técnica. No hay analítica, ni píxeles, ni cookies de terceros. Esta página dice exactamente eso.
 */
export default function Cookies() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Política de cookies</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Última actualización: 8 de octubre de 2026.
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
        <h2>2. Qué usa Hestiat exactamente</h2>
        <p style={{ lineHeight: 1.7 }}>
          <b>Una sola cookie</b>, y solo cuando inicias sesión:
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
          <code>Secure</code> (solo por HTTPS) y con política <code>SameSite=Lax</code>. Puedes verla y
          borrarla en cualquier momento desde tu navegador.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Lo que Hestiat NO usa</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>No</b> hay cookies de analítica: no se mide tu navegación con herramientas de terceros.
          </li>
          <li>
            <b>No</b> hay píxeles de redes sociales ni de publicidad.
          </li>
          <li>
            <b>No</b> hay cookies de terceros, de perfilado ni de publicidad personalizada.
          </li>
        </ul>
        <p style={{ lineHeight: 1.7 }}>
          Por eso no verás un aviso de cookies al entrar: no hay ninguna cookie que necesite tu
          consentimiento previo, y el único uso que hay es imprescindible para que la sesión funcione.
        </p>
      </section>

      <section className="seccion-home">
        <h2>4. Si no quieres que se guarde</h2>
        <p style={{ lineHeight: 1.7 }}>
          Puedes bloquear o eliminar las cookies desde los ajustes de tu navegador (privacidad y
          seguridad). Ten en cuenta que, si bloqueas la cookie de sesión,{" "}
          <b>no podrás mantener la sesión iniciada</b> y tendrás que identificarte en cada visita. El
          resto del sitio, la búsqueda y las fichas, seguirá funcionando con normalidad.
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
