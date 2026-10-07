import { redirect } from "next/navigation";

/**
 * La disponibilidad se gestiona en la pestaña «Disponibilidad» del editor único.
 *
 * Aquí había un calendario propio con su propio formulario: otra vez el mismo dato en dos sitios.
 * La ruta se conserva y redirige.
 */
export default async function HostCalendario({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const sp = await searchParams;
  const id = Number(sp.a);
  if (Number.isInteger(id) && id > 0) redirect(`/editar/${id}?pestana=disponibilidad`);
  redirect("/host");
}
