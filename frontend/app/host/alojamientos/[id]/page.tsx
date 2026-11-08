import { redirect, notFound } from "next/navigation";

/**
 * La gestión de un alojamiento del anfitrión vive ahora en el editor único (`/editar/[id]`), junto
 * con la del administrador. Esta ruta se mantiene para no romper enlaces antiguos ni marcadores:
 * solo redirige.
 */
export default async function GestionAlojamiento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  redirect(`/editar/${Number(id)}`);
}
