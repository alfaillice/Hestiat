import Link from "next/link";
import type { Metadata } from "next";
import { verificar } from "@/lib/anfitrion.server";
import { getCurrentUser } from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar cuenta — Hestiat", robots: { index: false } };

/**
 * Confirmación del correo para activar la cuenta de anfitrión.
 *
 * El enlace del correo apunta aquí con el token. La activación ocurre al abrir el enlace, que es
 * justo el comportamiento que se espera de una verificación: si no se ha abierto, la cuenta sigue
 * sin activar.
 */
export default async function Verificar({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = (sp.token ?? "").trim();
  const resultado = token ? await verificar(token) : { ok: false as const, error: "Falta el código de confirmación." };
  const sesion = await getCurrentUser();

  return (
    <main className="wrap" style={{ maxWidth: 560, paddingTop: 48 }}>
      {resultado.ok ? (
        <>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Cuenta confirmada</h1>
          <p className="aviso" style={{ marginBottom: 18 }}>
            Tu cuenta de anfitrión ya está activa. Puedes publicar y gestionar tus alojamientos.
          </p>
          <p>
            <Link className="f-aplicar" href={sesion ? "/host" : "/login?redirect=/host"}>
              {sesion ? "Ir a mi panel" : "Entrar y publicar"}
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>No se ha podido confirmar</h1>
          <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 18 }}>
            {resultado.error}
          </p>
          <p>
            <Link className="f-limpiar" href="/anfitrion">Volver a solicitar la cuenta de anfitrión</Link>
          </p>
        </>
      )}
    </main>
  );
}
