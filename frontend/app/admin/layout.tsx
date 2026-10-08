import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

/**
 * Guardián del panel de administración.
 *
 * El control es EN SERVIDOR: si no hay sesión con rol `admin`, se redirige al login. Ninguna
 * comprobación depende del navegador. Mismo criterio que `requireAdmin()` en la aplicación
 * antigua, leyendo la misma cookie y la misma tabla de sesiones.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?redirect=/admin");

  const secciones: [string, string][] = [
    ["/admin", "Resumen"],
    ["/admin/alojamientos", "Alojamientos"],
    ["/admin/usuarios", "Usuarios"],
    ["/admin/reservas", "Reservas"],
    ["/admin/reclamaciones", "Reclamaciones"],
    ["/admin/revision", "Propuestas de enriquecimiento"],
    ["/admin/solicitudes", "Solicitudes de alta"],
    ["/admin/auditoria", "Auditoría"],
  ];

  return (
    <div className="admin">
      <aside className="admin-nav">
        <p className="admin-marca">Administración</p>
        <nav>
          {secciones.map(([href, etiqueta]) => (
            <Link key={href} href={href}>
              {etiqueta}
            </Link>
          ))}
        </nav>
        <p className="admin-sesion">
          {admin.email}
          <br />
          <span style={{ color: "var(--muted-fg)" }}>rol: {admin.rol}</span>
        </p>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
