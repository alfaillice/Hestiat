import { redirect } from "next/navigation";

/**
 * El precio se gestiona en la pestaña «Precio» del editor único de alojamiento.
 *
 * Esta página existía como un formulario aparte y duplicaba lo que ya hace el editor: dos sitios
 * donde tocar el mismo dato es exactamente lo que el diseño pide evitar. Se mantiene la ruta para
 * no romper enlaces ni marcadores, y solo redirige.
 */
export default async function HostPrecios({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const sp = await searchParams;
  const id = Number(sp.a);
  if (Number.isInteger(id) && id > 0) redirect(`/editar/${id}?pestana=precios`);
  redirect("/host");
}
