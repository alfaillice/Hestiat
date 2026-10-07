import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, requireHost } from "@/lib/auth.server";
import { datosSolicitud } from "@/lib/anfitrion.server";
import { smtpConfigurado } from "@/lib/correo.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publica tu alojamiento — Hestiat", robots: { index: false } };

/**
 * Autoalta de anfitrión.
 *
 * Antes esto exigía que un administrador te vinculara a mano, y eso hacía imposible que Hestiat
 * creciera solo. Aquí un usuario registrado solicita y activa su cuenta de anfitrión.
 *
 * Se piden solo los datos que de verdad hacen falta para contactar con un anfitrión real. La
 * solicitud queda registrada para que administración pueda revisarla después, sin haber bloqueado
 * la activación.
 */
export default async function Anfitrion({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const sesion = await getCurrentUser();
  if (!sesion) redirect("/login?redirect=/anfitrion");

  const yaEs = await requireHost();
  if (yaEs) redirect("/host");

  const sp = await searchParams;
  const previa = await datosSolicitud(sesion.id);

  return (
    <main className="wrap" style={{ maxWidth: 660, paddingTop: 40 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Publica tu alojamiento</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 20 }}>
        Publicar en Hestiat es gratis y <strong>no cobramos comisiones</strong>: el precio que pongas es
        el que ve el huésped.
      </p>

      {!smtpConfigurado() && (
        <p className="aviso" style={{ marginBottom: 16 }}>
          Este servidor todavía no tiene correo saliente configurado, así que no podemos enviarte un enlace
          de confirmación: <strong>tu cuenta de anfitrión se activará directamente</strong> al enviar el
          formulario.
        </p>
      )}

      {sp.enviado && (
        <p className="aviso" style={{ marginBottom: 16 }}>
          Te hemos enviado un correo a <strong>{sesion.email}</strong> con un enlace de confirmación.
          Tu cuenta de anfitrión se activará <strong>cuando abras ese enlace</strong>. Revisa también la
          carpeta de spam.
        </p>
      )}

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

      {previa && (
        <p className="aviso" style={{ marginBottom: 16 }}>
          Ya solicitaste publicar el {String(previa.creado_en).slice(0, 10)}. Estado: {previa.estado}.
        </p>
      )}

      <ul className="m" style={{ color: "var(--muted-fg)", margin: "0 0 20px 18px" }}>
        <li>Publicas y gestionas tu calendario y tus precios.</li>
        <li>Puedes conectar Airbnb, Booking u otros por iCalendar para no duplicar reservas.</li>
        <li>Sin comisiones y sin cobros: tú y el huésped os entendéis directamente.</li>
      </ul>

      <form action="/api/anfitrion" method="post" className="form-edicion">
        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Teléfono de contacto</span>
            <input name="telefono" required maxLength={32} autoComplete="tel" />
          </label>
          <label className="f-campo">
            <span className="etq">Localidad del alojamiento</span>
            <input name="localidad" required maxLength={128} placeholder="Granada" />
          </label>
        </div>
        <label className="f-campo">
          <span className="etq">¿Algo que debamos saber? (opcional)</span>
          <textarea name="motivacion" rows={3} maxLength={4000} />
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
          <input type="checkbox" name="condiciones" value="1" required />
          <span>
            Confirmo que los datos son correctos y que puedo publicar el alojamiento que voy a anunciar.
          </span>
        </label>
        <div className="f-acciones">
          <button className="f-aplicar" type="submit">Activar mi cuenta de anfitrión</button>
          <Link className="f-limpiar" href="/perfil">Ahora no</Link>
        </div>
      </form>

      <p className="aviso" style={{ marginTop: 18 }}>
        La activación es inmediata. Registramos tu solicitud para que administración pueda revisarla,
        pero no tienes que esperar a nadie para empezar.
      </p>
    </main>
  );
}
