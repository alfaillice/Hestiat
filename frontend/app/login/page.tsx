import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth.server";
import { googleConfigurado, retornoValido } from "@/lib/auth-google.server";
import BotonGoogle from "@/components/boton-google";
import MarcaLogo from "@/components/marca-logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar — Hestiat", robots: { index: false } };

/** Mensajes del acceso con Google, dichos con claridad y sin tecnicismos. */
const AVISOS: Record<string, { texto: string; tipo: "error" | "aviso" }> = {
  "sin-configurar": {
    texto: "El acceso con Google todavía no está configurado en el servidor. Puedes entrar con tu correo y contraseña.",
    tipo: "aviso",
  },
  cancelado: { texto: "Has cancelado el acceso con Google. No ha pasado nada.", tipo: "aviso" },
  state: { texto: "El intento de acceso no se ha podido verificar. Vuelve a intentarlo.", tipo: "error" },
  "state-caducado": { texto: "El intento de acceso ha caducado. Vuelve a intentarlo.", tipo: "error" },
  error: { texto: "No se ha podido completar el acceso con Google.", tipo: "error" },
  recuperado: { texto: "Tu contraseña se ha cambiado. Entra con la nueva.", tipo: "aviso" },
};

/**
 * Acceso. Se mantiene la autenticación propia (cookie `hestiat_sesion` y scrypt de la aplicación
 * antigua) y se añade Google como una forma más de entrar, no como un sistema aparte.
 *
 * Google autentica; el rol lo sigue decidiendo la cuenta de Hestiat.
 */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string; volver?: string; google?: string; motivo?: string; recuperado?: string }>;
}) {
  const sp = await searchParams;
  const ya = await getCurrentUser();
  if (ya) redirect(ya.rol === "admin" ? "/admin" : "/");

  const destino = retornoValido(sp.volver ?? sp.redirect ?? "/perfil");
  const aviso = sp.google ? AVISOS[sp.google] : null;

  return (
    <main className="acceso">
      <div className="acceso-tarjeta">
        <p className="acceso-marca"><MarcaLogo /></p>
        <h1>Bienvenido a Hestiat</h1>
        <p className="acceso-sub">Entra para gestionar tus reservas, tus favoritos y tus alojamientos.</p>

        {aviso && (
          <p
            className="aviso"
            style={
              aviso.tipo === "error"
                ? { borderColor: "var(--destructive)", color: "var(--destructive)" }
                : { borderColor: "var(--primary)" }
            }
          >
            {aviso.texto}
            {sp.motivo ? ` (${sp.motivo})` : ""}
          </p>
        )}

        <BotonGoogle disponible={googleConfigurado()} volver={destino} />

        <p className="o-separador"><span>o</span></p>

        <form action="/api/auth/login" method="post" className="login">
          <input type="hidden" name="redirect" value={destino} />
          <label className="f-campo">
            <span className="etq">Correo</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="f-campo">
            <span className="etq">Contraseña</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {sp.recuperado && (
            <p className="aviso aviso-ok" role="status">
              Tu contraseña se ha cambiado. Entra con la nueva.
            </p>
          )}

          {sp.error && (
            <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
              {sp.error}
            </p>
          )}
          <button className="f-aplicar" type="submit">Iniciar sesión</button>
        </form>

          <p className="ficha-texto" style={{ marginTop: 10 }}>
            <Link href="/recuperar">He olvidado mi contraseña</Link>
          </p>


        <p className="acceso-pie">
          ¿Has olvidado la contraseña? Todavía no hay recuperación automática por correo: pide ayuda a
          la administración de Hestiat y te la restablecen.
        </p>
        <p className="acceso-pie">
          ¿No tienes una cuenta? <Link href="/registro">Crear cuenta</Link>
        </p>
        <p className="acceso-pie">
          <Link href="/">Volver a la web</Link>
        </p>
      </div>
    </main>
  );
}
