import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Política de privacidad — Hestiat",
  descripcion:
    "Qué datos personales trata Hestiat, con qué finalidad y base jurídica, cuánto tiempo se conservan, a quién se comunican y cómo ejercer tus derechos de acceso, rectificación o supresión.",
  ruta: "/privacidad",
});

/**
 * POLÍTICA DE PRIVACIDAD.
 * Los datos que se enumeran aquí son EXACTAMENTE los que el sistema recoge: cuenta (correo, nombre,
 * teléfono, contraseña cifrada), perfil opcional y datos de la reserva. No se añade nada más, y lo
 * que falta por concretar va marcado.
 */
export default function Privacidad() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Política de privacidad</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Última actualización: 8 de octubre de 2026.
      </p>

      <section className="seccion-home">
        <h2>1. Responsable del tratamiento</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Responsable:</b> JM TRIVINO
          </li>
          <li>
            <b>NIF/CIF:</b> 22009686C
          </li>
          <li>
            <b>Domicilio:</b> Partida Carrus P1-137, Alicante (España)
          </li>
          <li>
            <b>Contacto para privacidad:</b> <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>2. Qué datos se tratan y para qué</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Cuenta.</b> Correo electrónico, nombre, teléfono y contraseña. La contraseña{" "}
            <b>no se guarda en claro</b>: se almacena cifrada con el algoritmo scrypt. Para qué: crear y
            mantener tu cuenta, identificarte y avisarte por correo de lo que ocurre en ella
            (verificación, cambios en una reserva).
          </li>
          <li>
            <b>Perfil (opcional).</b> Apellidos, nombre público, ciudad, país, dirección, código postal,
            idioma, biografía y foto. Solo si decides rellenarlos, para mostrar tu perfil y, si publicas
            alojamientos, para tus fichas.
          </li>
          <li>
            <b>Reservas.</b> Nombre, correo y teléfono de contacto de quien reserva, fechas de llegada y
            salida, número de huéspedes, noches, importe calculado y las notas que quieras añadir. Para
            qué: tramitar la reserva, avisarte a ti y avisar al anfitrión.
          </li>
          <li>
            <b>Datos técnicos de la sesión.</b> Un identificador de sesión y el navegador que usas, para
            mantenerte identificado y proteger la cuenta frente a usos indebidos.
          </li>
          <li>
            <b>Anuncios de anfitriones.</b> Si publicas un alojamiento, los datos y fotos que subes, para
            poder mostrarlo en el catálogo.
          </li>
        </ul>
        <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
          <b>No se usan cookies de analítica, publicidad ni seguimiento</b>, ni se elabora ningún perfil
          publicitario con tus datos.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Base jurídica</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Ejecución del servicio</b> (art. 6.1.b RGPD): cuenta, reservas y publicación de anuncios.
          </li>
          <li>
            <b>Consentimiento</b> (art. 6.1.a): los datos opcionales del perfil, que puedes dejar vacíos o
            borrar cuando quieras.
          </li>
          <li>
            <b>Interés legítimo y obligaciones legales</b> (art. 6.1.f y 6.1.c): seguridad del sitio,
            prevención de abusos y conservación de lo que la ley exija.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>4. Quién más ve estos datos</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>El anfitrión</b> recibe los datos necesarios de la reserva (nombre, correo, teléfono,
            fechas, huéspedes y notas) para atenderte. Es imprescindible para que la reserva exista.
          </li>
          <li>
            <b>Proveedores técnicos</b> que alojan la web y gestionan el envío de correo: actúan como
            encargados del tratamiento y solo acceden a lo necesario para prestar el servicio.
          </li>
          <li>
            <b>Nadie más.</b> No se venden ni se ceden datos a terceros con fines publicitarios ni se
            elaboran perfiles comerciales.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>5. Cuánto tiempo se conservan</h2>
        <p style={{ lineHeight: 1.7 }}>
          Los datos de la cuenta, mientras la cuenta esté activa. Los de las reservas, el tiempo
          necesario para su gestión y el que exijan las obligaciones legales aplicables (por ejemplo,
          contables o fiscales). Los datos opcionales del perfil, hasta que los borres.
        </p>
      </section>

      <section className="seccion-home">
        <h2>6. Tus derechos</h2>
        <p style={{ lineHeight: 1.7 }}>
          Puedes ejercer los derechos de <b>acceso, rectificación, supresión, oposición, limitación del
          tratamiento y portabilidad</b> escribiendo a{" "}
          <a href="mailto:hola@hestiat.com">hola@hestiat.com</a> desde la dirección con la que te
          registraste, indicando qué derecho quieres ejercer. Responderemos en los plazos que marca la
          ley. Si crees que no se ha atendido bien, puedes reclamar ante la Agencia Española de
          Protección de Datos (<a href="https://www.aepd.es" rel="noopener noreferrer" target="_blank">www.aepd.es</a>).
        </p>
      </section>

      <section className="seccion-home">
        <h2>7. Seguridad</h2>
        <p style={{ lineHeight: 1.7 }}>
          La web funciona íntegramente sobre <b>HTTPS</b>. Las contraseñas se guardan <b>cifradas con
          scrypt</b>, nunca en claro, y la sesión viaja en una cookie marcada como <code>HttpOnly</code>{" "}
          y <code>Secure</code>, de modo que no es accesible desde el código de la página.
        </p>
      </section>

      <section className="seccion-home">
        <h2>8. Menores de edad</h2>
        <p style={{ lineHeight: 1.7 }}>
          El servicio no está dirigido a menores de edad. Si se detecta una cuenta de un menor sin
          autorización de sus padres o tutores, se procede a su cancelación.
        </p>
      </section>

      <NotaLegal>
        Faltan dos datos que no constan y que no se inventan: (1) la <b>identificación de los proveedores
        de alojamiento web y de correo</b> que actúan como encargados del tratamiento; y (2) los{" "}
        <b>plazos de conservación concretos</b> (por ejemplo, cuántos años se mantienen las reservas), si
        quieres fijarlos expresamente en la política. Dime los valores y los escribo.
      </NotaLegal>
    </main>
  );
}
