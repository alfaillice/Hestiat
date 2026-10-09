import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth.server";
import { listarObjetos, reemplazarMetadatos } from "@/lib/r2.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PONE LA CABECERA DE CACHÉ A LAS IMÁGENES QUE YA ESTABAN EN EL ALMACÉN.
 *
 * Contexto: las fotos subidas a partir del arreglo de caché ya salen con un año de caché e
 * `immutable`. Las que se subieron antes no llevan ninguna cabecera, así que el navegador pregunta
 * por cada una en cada visita. Esta herramienta les pone la misma cabecera a las antiguas.
 *
 * GARANTÍAS:
 *   · NO borra nada y NO cambia ninguna dirección: la URL de cada foto es la misma de antes.
 *   · NO vuelve a subir las imágenes: la operación es una copia dentro del propio almacén y el tipo
 *     de contenido se conserva.
 *   · Comprueba cada objeto: compara el ETag (la huella del contenido) antes y después. Si alguno
 *     cambiara, se cuenta como incidencia en lugar de darse por bueno.
 *   · Es de administración: sin sesión de admin devuelve 403. No está expuesta al público.
 *   · Trabaja por páginas y siempre termina la página que empieza, para no dejar huecos: devuelve
 *     dónde se quedó y se vuelve a llamar.
 *
 * Uso (desde el servidor, con una sesión de administración):
 *   POST /api/admin/cache-medios  {"accion":"estado"}                     → solo cuenta
 *   POST /api/admin/cache-medios  {"continuacion":null,"presupuestoMs":30000}
 */
const TIPO_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const TAMANO_PAGINA = 200;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Solo administración." }, { status: 403 });
  }

  let cuerpo: { accion?: string; continuacion?: string | null; presupuestoMs?: number; concurrencia?: number } = {};
  try {
    cuerpo = await request.json();
  } catch {
    /* sin cuerpo: se usan los valores por defecto */
  }

  const presupuesto = Math.min(Math.max(Number(cuerpo.presupuestoMs ?? 30_000), 5_000), 90_000);
  const concurrencia = Math.min(Math.max(Number(cuerpo.concurrencia ?? 8), 1), 16);
  const t0 = Date.now();

  let continuacion: string | null = cuerpo.continuacion ?? null;
  let terminado = false;
  let procesados = 0;
  let actualizados = 0;
  let saltados = 0;
  let etagsDistintos = 0;
  let soloContar = cuerpo.accion === "estado";
  const fallos: string[] = [];

  while (!terminado) {
    const pagina = await listarObjetos({ continuacion: continuacion ?? undefined, max: TAMANO_PAGINA });
    if (pagina.objetos.length === 0) {
      terminado = true;
      break;
    }

    // La página se termina siempre: cortar a mitad dejaría objetos sin tratar y el cursor
    // apuntaría más adelante, saltándoselos.
    for (let i = 0; i < pagina.objetos.length; i += concurrencia) {
      const lote = pagina.objetos.slice(i, i + concurrencia);
      const resultados = await Promise.all(
        lote.map(async (objeto) => {
          const extension = objeto.clave.split(".").pop()?.toLowerCase() ?? "";
          const tipo = TIPO_POR_EXTENSION[extension];
          if (!tipo) return "saltado";
          if (soloContar) return "contado";
          try {
            const r = await reemplazarMetadatos(objeto.clave, tipo);
            if (r.etag && objeto.etag && r.etag !== objeto.etag) return "etag-distinto";
            return "actualizado";
          } catch (error) {
            return `fallo:${(error instanceof Error ? error.message : "desconocido").slice(0, 120)}`;
          }
        }),
      );
      for (const r of resultados) {
        procesados += 1;
        if (r === "actualizado") actualizados += 1;
        else if (r === "etag-distinto") {
          etagsDistintos += 1;
          fallos.push(`${lote[0]?.clave ?? "?"}: el ETag cambió (el contenido no debería haber cambiado)`);
        } else if (r === "saltado" || r === "contado") saltados += 1;
        else fallos.push(r);
      }
    }

    continuacion = pagina.continuacion;
    if (!continuacion) terminado = true;
    if (Date.now() - t0 >= presupuesto) break;
  }

  return NextResponse.json({
    ok: fallos.length === 0,
    soloContar,
    procesados,
    actualizados,
    saltados,
    etagsDistintos,
    terminado,
    continuacion,
    segundos: Math.round((Date.now() - t0) / 1000),
    fallos: fallos.slice(0, 20),
    fallosTotal: fallos.length,
  });
}
