import Link from "next/link";

/**
 * BLOQUE «PUBLICA GRATIS EN HESTIAT» de la portada.
 *
 * Es la comunicación del modelo de negocio: en Hestiat publicar no cuesta nada. No es un banner
 * agresivo ni un anuncio: es una tarjeta serena, en la línea visual del resto de la portada (fondo
 * suave, esquinas redondeadas, el rosa de acción de Hestiat).
 *
 * Los enlaces van al flujo REAL que ya existe:
 *   · «Publicar gratis» → /hazte-anfitrion, que explica el proceso y lleva al alta y al registro.
 *   · experiencias y servicios → sus formularios de alta, que ya funcionan y pasan por revisión.
 * Ningún enlace es ficticio y ninguno promete nada que no exista hoy.
 */
export default function BloquePublicaGratis() {
  return (
    <section className="publica" aria-labelledby="publica-titulo">
      <div className="publica-txt">
        <p className="publica-etq">Publica gratis en Hestiat</p>
        <h2 id="publica-titulo">¿Tienes un alojamiento, experiencia o servicio?</h2>
        <p className="publica-sub">
          Publícalo gratis en Hestiat y aumenta tu visibilidad. Sin comisión por reserva, sin cuota de
          publicación y sin cuota mensual.
        </p>
      </div>
      <div className="publica-acciones">
        <Link className="publica-cta" href="/hazte-anfitrion">
          Publicar gratis
        </Link>
        <span className="publica-otros">
          <Link href="/publicar-experiencia">Publicar una experiencia</Link>
          <Link href="/publicar-servicio">Publicar un servicio</Link>
        </span>
      </div>
    </section>
  );
}
