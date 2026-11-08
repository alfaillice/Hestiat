import { logout } from "@/lib/auth.server";
import { redirigir } from "@/lib/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salir — borra la sesión de la base y la cookie. */
export async function POST() {
  await logout();
  return redirigir("/");
}
