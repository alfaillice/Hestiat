import { redirect, notFound } from "next/navigation";

/**
 * La edición desde la administración es la MISMA que la del anfitrión: un solo editor en
 * `/editar/[id]`. Esta ruta se conserva para no romper enlaces y redirige allí; no existe un
 * segundo editor de administración.
 */
export default async function EditarAlojamientoAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  redirect(`/editar/${Number(id)}`);
}
