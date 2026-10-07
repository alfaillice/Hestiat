import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth.server";
import { googleConfigurado } from "@/lib/auth-google.server";
import BotonGoogle from "@/components/boton-google";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crear cuenta — Hestiat", robots: { index: false } };

/**
 * Crear cuenta.
 *
 * Dos caminos, un solo sistema de usuarios: con Google (no hace falta contraseña) o con el
 * formulario de siempre. En los dos casos el rol lo decide el servidor —siempre `huesped`— y el
 * correo queda como identificador de la cuenta, así que entrar luego con Google no crea otra.
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
    <main className="acceso">
      <div className="acceso-tarjeta">
        <p className="acceso-marca">hestiat</p>
        <h1>Crear tu cuenta</h1>
        <p className="acceso-sub">
          Guarda tus favoritos, solicita reservas y gestiona tus alojamientos. Es gratis.
        </p>

        <BotonGoogle disponible={googleConfigurado()} volver="/perfil" />

        <p className="o-separador"><span>o</span></p>

        {sp.error && (
          <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
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
          <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12.5 }}>
            Mínimo 8 caracteres. Se guarda cifrada con scrypt: nunca en texto plano.
          </p>
          <button className="f-aplicar" type="submit">Crear cuenta</button>
        </form>

        <p className="acceso-pie">
          ¿Ya tienes cuenta? <Link href="/login">Entrar</Link>
        </p>
        <p className="acceso-pie">
          <Link href="/">Volver a la web</Link>
        </p>
      </div>
    </main>
  );
}
