/**
 * Vuelta de Google en la ruta que la aplicación antigua ya tenía registrada.
 *
 * No es una segunda implementación: reexporta el mismo manejador de
 * `/api/auth/google/callback`, así que hay una sola lógica de verificación y vinculación y dos
 * direcciones que llevan a ella. La que se envía a Google es esta, porque es la que su cliente de
 * OAuth reconoce; la otra se mantiene por si algo apunta ahí.
 */
export { GET } from "@/app/api/auth/google/callback/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
