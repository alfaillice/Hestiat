import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar el acceso — Hestiat",
  description: "Pide un enlace para poner una contraseña nueva en tu cuenta de Hestiat.",
  robots: { index: false, follow: false },
};

/**
 * Página para pedir el enlace de recuperación.
 *
 * Nunca dice si el correo existe o no: informa de que se ha enviado un mensaje si la cuenta existe.
 */
export default async function Recuperar({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="wrap ficha">
      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link> <span>/</span> <Link href="/login">Entrar</Link> <span>/</span> Recuperar el acceso
      </nav>
      <h1>Recuperar el acceso</h1>
      <p className="ficha-texto">
        Escribe el correo con el que te registraste y te enviaremos un enlace para poner una contraseña nueva.
        El enlace caduca en una hora y solo se puede usar una vez.
      </p>

      {sp.enviado && (
        <p className="aviso aviso-ok" role="status">
          Si ese correo tiene una cuenta en Hestiat, ya va de camino el mensaje con el enlace. Revisa también la carpeta de correo no deseado.
        </p>
      )}
      {sp.error === "correo" && (
        <p className="aviso aviso-error" role="alert">Escribe un correo electrónico válido.</p>
      )}

      <form action="/api/recuperar" method="post" className="login">
        <label>
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="btn-principal" type="submit">Enviar el enlace</button>
      </form>

      <p className="ficha-texto" style={{ marginTop: 16 }}>
        ¿Te acuerdas de la contraseña? <Link href="/login">Entrar</Link> · ¿No tienes cuenta? <Link href="/registro">Crear una</Link>
      </p>
    </main>
  );
}
