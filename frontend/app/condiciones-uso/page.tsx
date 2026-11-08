import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Condiciones de uso — Hestiat",
  descripcion:
    "Reglas de uso de Hestiat: qué puedes hacer, qué se espera de anfitriones y huéspedes, cómo funciona una reserva sin comisión ni pasarela de pago y qué usos están prohibidos.",
  ruta: "/condiciones-uso",
});

/**
 * CONDICIONES DE USO.
 * Reflejan cómo funciona el producto de verdad: Hestiat pone en contacto a las partes, no cobra
 * comisión, no hay pasarela de pago y el pago se acuerda con el anfitrión (así lo dice ya la propia
 * web al confirmar una reserva).
 */
export default function CondicionesUso() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Condiciones de uso</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Última actualización: 8 de octubre de 2026.
      </p>

      <section className="seccion-home">
        <h2>1. Qué es Hestiat</h2>
        <p style={{ lineHeight: 1.7 }}>
          Hestiat es una plataforma que <b>pone en contacto</b> a personas que buscan alojamiento,
          experiencias o servicios con quienes los ofrecen, y que publica un catálogo de fichas de toda
          España. El titular del sitio está identificado en el <Link href="/aviso-legal">aviso legal</Link>.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Usar el sitio te convierte en usuario e implica aceptar estas condiciones, el aviso legal, la{" "}
          <Link href="/privacidad">política de privacidad</Link> y la{" "}
          <Link href="/cookies">política de cookies</Link>.
        </p>
        <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
          Titular: <b>JM TRIVINO</b> · NIF 22009686C · Partida Carrus P1-137, Alicante ·{" "}
          <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>
        </p>
      </section>

      <section className="seccion-home">
        <h2>2. Reservas: sin comisión y sin pasarela de pago</h2>
        <p style={{ lineHeight: 1.7 }}>
          <b>En Hestiat no se cobra nada.</b> No hay comisión por reservar ni por publicar, y no hay
          pasarela de pago: la reserva queda registrada y <b>el pago se acuerda directamente con el
          anfitrión</b>. El importe que se muestra en la reserva es el cálculo de noches por precio más
          la limpieza, si está publicada.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          El acuerdo de alojamiento se establece entre el huésped y el anfitrión. Hestiat no forma parte
          de ese acuerdo y no interviene en el cobro, en los cambios ni en las cancelaciones, aunque sí
          facilita el contacto y deja constancia de la reserva con un código.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Tu cuenta</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Debes ser mayor de edad para registrarte y contratar.</li>
          <li>Los datos que facilitas deben ser ciertos y estar actualizados.</li>
          <li>La contraseña es personal: cuídala y no la compartas. Eres responsable del uso que se haga con ella.</li>
          <li>Puedes cerrar la sesión cuando quieras, y solicitar la supresión de la cuenta escribiendo al correo de contacto.</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>4. Si publicas un alojamiento (anfitrión)</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            Eres responsable de que la información que publicas (descripción, fotos, dirección, precio,
            servicios y disponibilidad) sea <b>veraz y esté actualizada</b>.
          </li>
          <li>
            Debes mantener el calendario al día para no aceptar noches que no puedas ofrecer. Puedes
            conectar tu calendario externo en formato iCal para evitarlo.
          </li>
          <li>
            Si publicas fotos, debes tener derecho a usarlas. No se admiten fotos de otros
            establecimientos ni imágenes que induzcan a error.
          </li>
          <li>
            Los precios publicados son tuyos y debes respetarlos cuando aceptes una reserva.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>5. Si reservas (huésped)</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Facilita datos de contacto ciertos: el anfitrión los necesita para atenderte.</li>
          <li>Usa el alojamiento para lo reservado y respeta las normas que el anfitrión indique.</li>
          <li>
            Si algo no coincide con lo publicado, cuéntanoslo en el correo de contacto: nos interesa
            corregirlo.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>6. Sobre los datos del catálogo</h2>
        <p style={{ lineHeight: 1.7 }}>
          Muchas fichas proceden de fuentes públicas (OpenStreetMap y otras) y pueden estar
          incompletas o antiguas. Las fotografías son, en su mayoría, <b>imágenes de referencia del
          entorno</b> y así se indica; cuando se muestra la imagen oficial del sitio, se rotula. Los
          precios solo aparecen si están publicados, y si no hay ninguno la ficha dice «Consultar».
          Si eres el titular de una ficha y quieres corregirla o retirarla, usa{" "}
          <Link href="/reclamar">reclamar una ficha</Link>.
        </p>
      </section>

      <section className="seccion-home">
        <h2>7. Usos prohibidos</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Publicar información falsa, suplantar a otra persona o a otro negocio.</li>
          <li>Extraer el catálogo de forma automatizada sin autorización.</li>
          <li>Enviar publicidad no solicitada a otros usuarios.</li>
          <li>Intentar dañar, sobrecargar o acceder sin permiso a los sistemas del sitio.</li>
          <li>Usar la plataforma para actividades ilícitas.</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>8. Propiedad intelectual</h2>
        <p style={{ lineHeight: 1.7 }}>
          La marca, el diseño y los textos propios de Hestiat pertenecen a su titular. Los datos e
          imágenes procedentes de fuentes públicas pertenecen a sus autores y se muestran con su
          atribución. Lo que publicas sigue siendo tuyo: solo autorizas que se muestre en el catálogo
          mientras tu anuncio esté activo.
        </p>
      </section>

      <section className="seccion-home">
        <h2>9. Cambios y ley aplicable</h2>
        <p style={{ lineHeight: 1.7 }}>
          Estas condiciones pueden actualizarse: la versión vigente es siempre la publicada en esta
          página, con su fecha. Si alguna cláusula resultara nula, el resto seguirá siendo válida. Se
          rigen por la legislación española y, para consumidores, se respetan los derechos que la ley
          les reconoce.
        </p>
      </section>

      <NotaLegal>
        Faltan dos datos que no constan: si el titular es una sociedad, los <b>datos registrales</b>; y,
        si quieres fijarla expresamente, la <b>jurisdicción concreta</b> para conflictos. Con los valores,
        los dejo escritos.
      </NotaLegal>
    </main>
  );
}
