import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth.server";
import MarcaLogo from "@/components/marca-logo";

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
    /* LAS TRES ENTRADAS QUE FALTABAN.
       Las páginas YA existían y respondían 307 desde fuera, pero no había ningún enlace en el
       menú que llevara a ellas: por eso el panel parecía haber perdido estas funciones.
       Se reutilizan las rutas existentes, sin crear ninguna nueva:
         · /admin/publicaciones → listado unificado con pestañas por ?tipo= (alojamiento,
           experiencia, servicio). Es la vía para buscar y abrir el editor de cada fila.
         · el editor se alcanza desde cada fila: /admin/editar/<tipo>/<id>, que ya existía. */
    ["/admin/publicaciones?tipo=servicio", "Servicios"],
    ["/admin/publicaciones?tipo=experiencia", "Experiencias"],
    ["/admin/publicaciones", "Publicaciones"],
    ["/admin/reservas", "Reservas"],
    ["/admin/reclamaciones", "Reclamaciones"],
    ["/admin/revision", "Propuestas de enriquecimiento"],
    ["/admin/solicitudes", "Solicitudes de alta"],
    ["/admin/crm", "CRM de captación"],
    ["/admin/captacion", "Captación y conversión"],
    ["/admin/tickets", "Atención al cliente"],
    ["/admin/ia", "AI Manager"],
    ["/admin/auditoria", "Auditoría"],
  ];

  return (
    <div className="admin">
      <aside className="admin-nav">
        <p className="admin-marca"><MarcaLogo /> <span>Administración</span></p>
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
