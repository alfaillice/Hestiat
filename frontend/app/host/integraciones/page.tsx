import { redirect } from "next/navigation";

/**
 * Los calendarios externos se gestionan en la pestaña «Calendarios» del editor único.
 *
 * Esta página duplicaba esa gestión y además era el único sitio donde se veía la dirección del
 * calendario para exportar. Esa dirección se ha movido al editor antes de redirigir, así que aquí
 * no se pierde ninguna función: solo deja de haber dos sitios donde tocar lo mismo.
 */
export default async function HostIntegraciones({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const sp = await searchParams;
  const id = Number(sp.a);
  if (Number.isInteger(id) && id > 0) redirect(`/editar/${id}?pestana=calendarios`);
  redirect("/host");
}
