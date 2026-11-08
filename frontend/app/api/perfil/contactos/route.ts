/**
 * API DE CONTACTOS DEL PERFIL — lectura y escritura de los canales de contacto propios.
 *
 * SEGURIDAD: el identificador de usuario sale SIEMPRE de la sesión (`getCurrentUser`).
 * No se acepta ningún `usuarioId` del cuerpo de la petición, así que un usuario no puede
 * modificar los contactos de otro aunque cambie identificadores en el formulario.
 *
 * La validación y la autorización reales viven en `lib/perfil-contactos.server.ts`:
 * aquí solo se comprueba la sesión y se delega.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";
import {
  leerContactosPerfil,
  guardarContactosPerfil,
} from "@/lib/perfil-contactos.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, error: "Sin sesión." }, { status: 401 });
  const datos = await leerContactosPerfil(Number(usuario.id));
  if (!datos) return NextResponse.json({ ok: false, error: "Perfil no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, contactos: datos });
}

export async function POST(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, error: "Sin sesión." }, { status: 401 });

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición mal formada." }, { status: 400 });
  }

  // Se leen SOLO los campos permitidos. Cualquier otro se ignora en silencio:
  // así un intento de tocar `email`, `pass_hash` o `rol` no tiene ningún efecto.
  const permitidos = ["whatsapp", "emailPublico", "webPublica"] as const;
  const permisos = ["mostrarTelefono", "mostrarWhatsapp", "mostrarEmail", "mostrarWeb"] as const;
  const datos: Record<string, unknown> = {};
  for (const k of permitidos) if (k in cuerpo) datos[k] = cuerpo[k] === null ? null : String(cuerpo[k] ?? "");
  for (const k of permisos) if (k in cuerpo) datos[k] = Boolean(cuerpo[k]);

  if (Object.keys(datos).length === 0) {
    return NextResponse.json({ ok: false, error: "No hay nada que guardar." }, { status: 400 });
  }

  const res = await guardarContactosPerfil(Number(usuario.id), datos);
  if (!res.ok) return NextResponse.json({ ok: false, errores: res.errores }, { status: 400 });

  const actualizado = await leerContactosPerfil(Number(usuario.id));
  return NextResponse.json({ ok: true, contactos: actualizado });
}
