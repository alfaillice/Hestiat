import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crear cuenta — Hestiat", robots: { index: false } };

/**
 * Crear cuenta.
 *
 * Formulario normal que envía por POST a `/api/auth/registro`. Sin Server Actions: el alta de un
 * usuario no puede depender de que el navegador haya cargado JavaScript.
 *
 * El rol se decide en servidor (siempre `huesped`); aquí no se ofrece ninguna opción de rol.
 */
export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; nombre?: string; email?: string }>;
}) {
  const ya = await getCurrentUser();
  if (ya) redirect("/perfil");
  const sp = await searchParams;

  return (
    <main className="wrap" style={{ maxWidth: 520, paddingTop: 40 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Crear cuenta</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 20 }}>
        Guarda tus favoritos, solicita reservas y gestiona tus alojamientos. Es gratis.
      </p>

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

      <form action="/api/auth/registro" method="post" className="login">
        <label className="f-campo">
          <span className="etq">Nombre</span>
          <input name="nombre" maxLength={191} required defaultValue={sp.nombre ?? ""} autoComplete="name" />
        </label>
        <label className="f-campo">
          <span className="etq">Correo</span>
          <input name="email" type="email" required defaultValue={sp.email ?? ""} autoComplete="email" />
        </label>
        <label className="f-campo">
          <span className="etq">Teléfono (opcional)</span>
          <input name="telefono" maxLength={32} autoComplete="tel" />
        </label>
        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Contraseña</span>
            <input name="password" type="password" minLength={8} required autoComplete="new-password" />
          </label>
          <label className="f-campo">
            <span className="etq">Repite la contraseña</span>
            <input name="password2" type="password" minLength={8} required autoComplete="new-password" />
          </label>
        </div>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Mínimo 8 caracteres. Guardamos la contraseña cifrada con scrypt: nunca en texto plano.
        </p>
        <button className="f-aplicar" type="submit">Crear cuenta</button>
      </form>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        ¿Ya tienes cuenta? <Link href="/login" style={{ textDecoration: "underline" }}>Entrar</Link>
      </p>
    </main>
  );
}
