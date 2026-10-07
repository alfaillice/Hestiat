import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHost } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

/**
 * Guardián del panel de anfitrión.
 *
 * Control en SERVIDOR: sin sesión con rol `anfitrion` o `admin`, al login. El aislamiento entre
 * propietarios no depende de esta capa: cada consulta o escritura comprueba además la propiedad
 * del alojamiento con `ownsListing()`, igual que en la aplicación antigua.
 */
export default async function HostLayout({ children }: { children: ReactNode }) {
  const host = await requireHost();
  if (!host) redirect("/login?redirect=/host");

  return (
    <div className="admin">
      <aside className="admin-nav">
        <p className="admin-marca">Panel del anfitrión</p>
        <nav>
          <Link href="/host">Mis alojamientos</Link>
          <Link href="/host/reservas">Reservas</Link>
          <Link href="/host/calendario">Calendario</Link>
          <Link href="/host/precios">Precios</Link>
          <Link href="/host/integraciones">Integraciones</Link>
          <Link href="/host/experiencias">Experiencias</Link>
        </nav>
        <p className="admin-sesion">
          {host.email}
          <br />
          <span style={{ color: "var(--muted-fg)" }}>rol: {host.rol}</span>
        </p>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
