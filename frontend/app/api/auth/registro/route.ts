import { registrar } from "@/lib/cuenta.server";
import { redirigir } from "@/lib/http.server";

import { limitar } from "@/lib/limite.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crear cuenta — POST de formulario normal.
 *
 * El rol se fija en servidor (`huesped`). Al terminar, la sesión queda iniciada y se lleva al
 * usuario a su perfil, sin obligarle a entrar otra vez.
 */
export async function POST(request: Request) {
  // Límite de frecuencia: esta ruta crea datos y es pública.
  const excedido = limitar(request, "/api/auth/registro", 5, 60);
  if (excedido) return excedido;

  const formulario = await request.formData();
  const nombre = String(formulario.get("nombre") ?? "");
  const email = String(formulario.get("email") ?? "");

  try {
    const r = await registrar({
      nombre,
      email,
      password: String(formulario.get("password") ?? ""),
      password2: String(formulario.get("password2") ?? ""),
      telefono: String(formulario.get("telefono") ?? ""),
      userAgent: request.headers.get("user-agent"),
    });
    if (!r.ok) {
      const p = new URLSearchParams({ error: r.error, nombre, email });
      return redirigir(`/registro?${p}`);
    }
    return redirigir("/perfil?bienvenida=1");
  } catch (error) {
    console.error("[hestiat] /api/auth/registro", error);
    const p = new URLSearchParams({ error: "No se ha podido crear la cuenta. Inténtalo de nuevo.", nombre, email });
    return redirigir(`/registro?${p}`);
  }
}
