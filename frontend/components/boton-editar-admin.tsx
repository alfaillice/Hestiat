import Link from "next/link";
import { getCurrentUser } from "@/lib/auth.server";

/**
 * BOTÓN «EDITAR PUBLICACIÓN» — SOLO PARA ADMINISTRACIÓN.
 *
 * Se muestra EXCLUSIVAMENTE si el rol de la sesión es exactamente `admin`. Ni anfitriones, ni
 * propietarios de la publicación, ni usuarios normales, ni huéspedes: en esta fase el botón es solo
 * para administración, y además la ruta de destino lo comprueba por su cuenta en el servidor, así que
 * esconder el botón no es la única defensa.
 *
 * Es un componente de servidor a propósito: la sesión se lee en el servidor y, cuando no es admin,
 * no se envía ni un solo byte de este botón al navegador.
 */
export default async function BotonEditarAdmin({
  tipo,
  id,
}: {
  tipo: "alojamiento" | "experiencia" | "servicio";
  /** Identificador real de la publicación. Si no es válido, no se pinta nada. */
  id: number;
}) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const sesion = await getCurrentUser();
  if (!sesion || sesion.rol !== "admin") return null;

  const destino =
    tipo === "alojamiento"
      ? `/editar/${id}`
      : `/admin/editar/${tipo === "experiencia" ? "experiencia" : "servicio"}/${id}`;

  return (
    <p style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <Link className="f-aplicar" href={destino}>
        Editar publicación
      </Link>
      <span className="m" style={{ color: "var(--muted-fg)", fontSize: 12.5 }}>
        Visible solo para administración
      </span>
    </p>
  );
}
