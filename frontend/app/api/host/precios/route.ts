import { requireHost } from "@/lib/auth.server";
import { cambiarPrecio } from "@/lib/precios.server";
import { redirigir } from "@/lib/http.server";
import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guardar el precio de un alojamiento — POST de formulario normal.
 *
 * La propiedad y el aviso de reservas futuras se resuelven dentro de `cambiarPrecio`, en servidor.
 * Si hay reservas futuras y no se ha confirmado, no se cambia nada y se devuelve el aviso.
 */
export async function POST(request: Request) {
  const excedido = limitar(request, "/api/host/precios", 30, 60);
  if (excedido) return excedido;

  const host = await requireHost();
  if (!host) return redirigir("/login?redirect=/host/precios");

  const formulario = await request.formData();
  const alojamientoId = Number(formulario.get("a"));
  const volver = `/host/precios?a=${alojamientoId}`;

  if (!Number.isFinite(alojamientoId)) return redirigir(`${volver}&aviso=${encodeURIComponent("Petición no válida.")}&ok=0`);

  try {
    const r = await cambiarPrecio(host.id, alojamientoId, formulario);

    if (!r.ok && "aviso" in r) return redirigir(`${volver}&aviso=${encodeURIComponent(r.aviso)}&ok=0`);
    if (!r.ok) return redirigir(`${volver}&aviso=${encodeURIComponent(r.error)}&ok=0`);

    const texto = r.precioNoche !== null
      ? `Precio guardado: ${r.precioNoche.toLocaleString("es-ES")} € por noche. Ya se ve en la ficha pública.`
      : "Precio orientativo guardado.";
    return redirigir(`${volver}&aviso=${encodeURIComponent(texto)}&ok=1`);
  } catch (error) {
    console.error("[hestiat] /api/host/precios", error);
    return redirigir(`${volver}&aviso=${encodeURIComponent("No se ha podido guardar el precio.")}&ok=0`);
  }
}
