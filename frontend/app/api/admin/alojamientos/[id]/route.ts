import { requireAdmin } from "@/lib/auth.server";
import { actualizarAlojamiento } from "@/lib/admin-catalog.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edición de un alojamiento desde administración — POST de formulario normal. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return redirigir(`/login?redirect=/admin/alojamientos/${id}`);

  const formulario = await request.formData();
  try {
    const r = await actualizarAlojamiento(Number(id), formulario);
    return redirigir(r.ok ? `/admin/alojamientos/${id}?guardado=1` : `/admin/alojamientos/${id}?error=1`);
  } catch (error) {
    console.error("[hestiat] /api/admin/alojamientos/[id]", error);
    return redirigir(`/admin/alojamientos/${id}?error=1`);
  }
}
