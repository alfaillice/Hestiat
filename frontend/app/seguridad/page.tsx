import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Seguridad en Hestiat — cómo protegemos tu cuenta",
  descripcion:
    "Medidas reales de seguridad de Hestiat: HTTPS en todo el sitio, contraseñas cifradas, sesión con cookie protegida, y consejos para reservar y publicar con tranquilidad.",
  ruta: "/seguridad",
});

export default function Seguridad() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Seguridad</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Lo que hacemos nosotros y lo que te toca a ti.
      </p>

      <section className="seccion-home">
        <h2>Qué hace Hestiat</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Todo el sitio va por HTTPS</b>: tu sesión y tus datos viajan cifrados.
          </li>
          <li>
            <b>Las contraseñas se guardan cifradas</b> con el algoritmo scrypt. Ni nosotros podemos
            leerlas.
          </li>
          <li>
            <b>La sesión va en una cookie protegida</b> (<code>HttpOnly</code> y <code>Secure</code>), no
            accesible desde el código de la página.
          </li>
          <li>
            <b>Sin rastreadores ni publicidad de terceros</b>: no se cede tu navegación a nadie.
          </li>
          <li>
            <b>Límites de peticiones</b> en las rutas sensibles, para frenar abusos automatizados.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Cómo reservar con tranquilidad</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            Comprueba en la ficha los datos de contacto publicados (web oficial y teléfono) antes de
            pagar nada.
          </li>
          <li>
            Recuerda que <b>el pago se acuerda con el anfitrión</b>: desconfía de quien te pida pagos por
            vías raras o con prisa.
          </li>
          <li>Guarda el código de la reserva: es tu referencia para cualquier consulta.</li>
          <li>
            Si algo no cuadra, escríbenos desde <Link href="/contacto">contacto</Link> antes de pagar.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Tu cuenta</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Usa una contraseña única y no la compartas.</li>
          <li>Cierra la sesión en dispositivos que no sean tuyos.</li>
          <li>
            Si crees que alguien ha entrado en tu cuenta, escríbenos y revisamos el acceso.
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 24 }}>
        Detalles técnicos en la <Link href="/privacidad">política de privacidad</Link> y en{" "}
        <Link href="/cookies">cookies</Link>.
      </p>
    </main>
  );
}
