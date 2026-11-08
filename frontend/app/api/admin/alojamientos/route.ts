import { requireAdmin } from "@/lib/auth.server";
import { crearAlojamiento } from "@/lib/admin-catalog.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta de alojamiento — POST de formulario normal.
 *
 * La comprobación de duplicados que hace `crearAlojamiento` puede devolver candidatos: en ese caso
 * no se crea nada y se vuelve al formulario con ellos en la URL, para que administración decida.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return redirigir("/login?redirect=/admin/alojamientos/nuevo");

  const formulario = await request.formData();
  const titulo = String(formulario.get("titulo") ?? "");
  const ciudad = String(formulario.get("ciudad") ?? "");
  const parametros = new URLSearchParams({ t: titulo, c: ciudad });

  try {
    const r = await crearAlojamiento(formulario);

    if (!r.ok && "duplicados" in r) {
      parametros.set("dup", r.duplicados.map((d) => d.id).join(","));
      return redirigir(`/admin/alojamientos/nuevo?${parametros}`);
    }
    if (!r.ok) {
      parametros.set("error", r.error);
      return redirigir(`/admin/alojamientos/nuevo?${parametros}`);
    }
    return redirigir(`/admin/alojamientos/${r.id}?guardado=1`);
  } catch (error) {
    console.error("[hestiat] /api/admin/alojamientos", error);
    parametros.set("error", "No se ha podido crear el alojamiento.");
    return redirigir(`/admin/alojamientos/nuevo?${parametros}`);
  }
}
