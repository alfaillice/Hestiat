import { redirect } from "next/navigation";

/**
 * El alta de alojamiento es UNA sola, en `/nuevo`, y la usan anfitriones y administradores.
 *
 * Aquí había un segundo formulario de alta, exclusivo de la administración, con su propia lógica.
 * Se conserva la ruta para no romper enlaces y redirige al alta compartida; la diferencia por rol
 * (el administrador puede asignar anfitrión) se resuelve allí, no duplicando la página.
 */
export default function AltaAlojamientoAdmin() {
  redirect("/nuevo");
}
