import Link from "next/link";
import type { Metadata } from "next";
import { comprobarToken, LARGO_MINIMO_PASSWORD } from "@/lib/recuperacion.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Poner una contraseña nueva — Hestiat",
  robots: { index: false, follow: false },
};

const MOTIVOS: Record<string, string> = {
  "no-valido": "Este enlace no es válido. Pide uno nuevo.",
  caducado: "Este enlace ha caducado. Pide uno nuevo.",
  usado: "Este enlace ya se ha usado. Si necesitas entrar, pide otro.",
  corta: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
  distintas: "Las dos contraseñas no coinciden.",
  error: "No se ha podido cambiar la contraseña. Inténtalo de nuevo.",
};

/** Página para poner la contraseña nueva. El testigo se comprueba en el servidor antes de pintar nada. */
export default async function Restablecer({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const estado = await comprobarToken(token);
  const aviso = sp.error ? MOTIVOS[sp.error] ?? MOTIVOS.error : null;

  return (
    <main className="wrap ficha">
      <nav className="migas" aria-label="Migas de pan">
        <Link href="/">Hestiat</Link> <span>/</span> <Link href="/login">Entrar</Link> <span>/</span> Contraseña nueva
      </nav>
      <h1>Poner una contraseña nueva</h1>

      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}

      {estado.ok ? (
        <>
          <p className="ficha-texto">
            Elige una contraseña de al menos {LARGO_MINIMO_PASSWORD} caracteres. Al guardarla se cerrarán
            las sesiones abiertas de tu cuenta.
          </p>
          <form action="/api/restablecer" method="post" className="login">
            <input type="hidden" name="token" value={token} />
            <label>
              Contraseña nueva
              <input name="password" type="password" autoComplete="new-password" minLength={LARGO_MINIMO_PASSWORD} required />
            </label>
            <label>
              Repite la contraseña
              <input name="password2" type="password" autoComplete="new-password" minLength={LARGO_MINIMO_PASSWORD} required />
            </label>
            <button className="btn-principal" type="submit">Guardar la contraseña</button>
          </form>
        </>
      ) : (
        <>
          <p className="aviso aviso-error" role="alert">
            {estado.motivo === "caducado" ? MOTIVOS.caducado : estado.motivo === "usado" ? MOTIVOS.usado : MOTIVOS["no-valido"]}
          </p>
          <p className="ficha-texto"><Link href="/recuperar">Pedir un enlace nuevo</Link></p>
        </>
      )}
    </main>
  );
}
