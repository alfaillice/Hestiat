import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar — Hestiat", robots: { index: false } };

/**
 * Login. Conserva la cookie `hestiat_sesion` y el scrypt de la aplicación antigua: las
 * sesiones abiertas siguen valiendo y las contraseñas existentes se validan tal cual.
 */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const sp = await searchParams;
  const ya = await getCurrentUser();
  if (ya) redirect(ya.rol === "admin" ? "/admin" : "/");
  const destino = sp.redirect ?? "/";

  return (
    <main className="wrap" style={{ maxWidth: 460, paddingTop: 50 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Entrar</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 20 }}>
        Acceso para anfitriones y administración.
      </p>

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

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
        <button className="f-aplicar" type="submit">
          Entrar
        </button>
      </form>

      <p style={{ marginTop: 14, fontSize: 14 }}>
        ¿No tienes cuenta? <Link href="/registro" style={{ textDecoration: "underline" }}>Crear una cuenta</Link>
      </p>

      <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--muted-fg)" }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Volver a la web
        </Link>
      </p>
    </main>
  );
}
