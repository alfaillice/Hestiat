import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth.server";
import { alojamientoReservable, calcularResumen, nochesEntre } from "@/lib/reservas.server";

export const dynamic = "force-dynamic";

/** Título propio: antes heredaba el de la portada. No se indexa, es un formulario. */
export const metadata: Metadata = {
  title: "Solicitar reserva — Hestiat",
  robots: { index: false, follow: true },
};

/**
 * Solicitar reserva.
 *
 * Se hace en dos pasos, a propósito:
 *   1. fechas y huéspedes  →  se muestra el DESGLOSE del precio calculado en servidor
 *   2. datos de contacto    →  se envía la solicitud
 *
 * Así el huésped ve siempre el desglose antes de confirmar, y los cálculos salen del servidor, no
 * del navegador. Hestiat no cobra nada: el total es exactamente noches × precio por noche.
 *
 * Cuando el alojamiento solo tiene precio orientativo se dice con claridad y la solicitud queda
 * como pendiente de que el anfitrión confirme el importe.
 */
export default async function Reservar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; huespedes?: string; error?: string; codigo?: string; noches?: string; total?: string; moneda?: string; orientativo?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const [base] = await pool.query<any[]>(`SELECT id FROM accommodation WHERE slug = ? LIMIT 1`, [slug]);
  if (!base[0]) notFound();
  const aloj = await alojamientoReservable(Number(base[0].id));
  if (!aloj || !aloj.publicado) notFound();

  // --- solicitud ya enviada ---
  if (sp.codigo) {
    return (
      <main className="wrap" style={{ maxWidth: 620, paddingTop: 44 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Solicitud enviada</h1>
        <p className="aviso" style={{ marginBottom: 16 }}>
          Tu reserva queda <strong>pendiente de confirmación</strong> por parte del anfitrión. No se ha
          cobrado nada: Hestiat no gestiona pagos.
        </p>
        <table className="tabla">
          <tbody>
            <tr><th>Código</th><td className="num">{sp.codigo}</td></tr>
            <tr><th>Alojamiento</th><td>{aloj.titulo}</td></tr>
            <tr><th>Noches</th><td className="num">{sp.noches}</td></tr>
            <tr>
              <th>Total</th>
              <td className="num">
                {Number(sp.total).toLocaleString("es-ES")} {sp.moneda}
                {sp.orientativo === "1" && (
                  <span style={{ display: "block", color: "var(--muted-fg)", fontSize: 12.5 }}>
                    precio orientativo: el anfitrión confirmará el importe final
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <Link className="f-limpiar" href={`/alojamiento/${slug}`}>Volver a la ficha</Link>
        </p>
      </main>
    );
  }

  const desde = sp.desde ?? "";
  const hasta = sp.hasta ?? "";
  const huespedes = Number(sp.huespedes ?? 2) || 2;
  const noches = desde && hasta ? nochesEntre(desde, hasta) : 0;
  const resumen = noches > 0 ? calcularResumen(aloj.precio, aloj.moneda, desde, hasta, aloj.precioEsOrientativo) : null;

  return (
    <main className="wrap" style={{ paddingTop: 36 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Solicitar reserva</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 18 }}>
        <Link href={`/alojamiento/${slug}`} style={{ textDecoration: "underline" }}>{aloj.titulo}</Link>
        {" · "}{[aloj.ciudad, aloj.provincia].filter(Boolean).join(", ")}
        {aloj.capacidad > 0 ? ` · hasta ${aloj.capacidad} huéspedes` : ""}
      </p>

      {/* Dos columnas dentro del contenedor global: a la izquierda las fechas, a la derecha el
          desglose y los datos de contacto. Antes era una columna de 720 px flotando en el centro. */}
      <div className="pagina-cols">
        <div>

      {sp.error && (
        <p className="aviso" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 }}>{sp.error}</p>
      )}

      {/* Paso 1: fechas y huéspedes, para ver el desglose */}
      <form method="get" className="form-edicion" style={{ marginBottom: 18 }}>
        <div className="fila-2">
          <label className="f-campo">
            <span className="etq">Entrada</span>
            <input type="date" name="desde" defaultValue={desde} required />
          </label>
          <label className="f-campo">
            <span className="etq">Salida</span>
            <input type="date" name="hasta" defaultValue={hasta} required />
          </label>
        </div>
        <label className="f-campo">
          <span className="etq">Huéspedes</span>
          <input type="number" name="huespedes" min="1" max={aloj.capacidad > 0 ? aloj.capacidad : 30} defaultValue={huespedes} />
        </label>
        <div className="f-acciones">
          <button className="f-aplicar" type="submit">Ver precio</button>
        </div>
      </form>

        </div>
        <div>
      {resumen && resumen.noches > 0 && (
        <section className="aud-bloque" style={{ marginBottom: 18 }}>
          <div className="aud-cab"><h2>Desglose</h2><span className="aud-num">{resumen.total.toLocaleString("es-ES")} {resumen.moneda}</span></div>
          <table className="tabla">
            <tbody>
              <tr><th>{resumen.noches} {resumen.noches === 1 ? "noche" : "noches"}</th><td className="num">{resumen.precioNoche.toLocaleString("es-ES")} {resumen.moneda} / noche</td></tr>
              <tr><th>Comisiones y gastos de gestión</th><td className="num">0 {resumen.moneda}</td></tr>
              <tr><th><strong>Total</strong></th><td className="num"><strong>{resumen.total.toLocaleString("es-ES")} {resumen.moneda}</strong></td></tr>
            </tbody>
          </table>
          {resumen.orientativo && (
            <p className="m" style={{ color: "var(--accent-foreground)", marginTop: 8 }}>
              Este alojamiento tiene <strong>precio orientativo</strong>: el anfitrión confirmará el importe
              final al aceptar la solicitud.
            </p>
          )}
        </section>
      )}

      {/* Paso 2: datos de contacto y envío */}
      {resumen && resumen.noches > 0 && (
        <form action="/api/reservas" method="post" className="form-edicion">
          <input type="hidden" name="accommodationId" value={aloj.accommodationId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="desde" value={desde} />
          <input type="hidden" name="hasta" value={hasta} />
          <input type="hidden" name="huespedes" value={huespedes} />
          <label className="f-campo"><span className="etq">Tu nombre</span><input name="nombre" required maxLength={160} /></label>
          <label className="f-campo"><span className="etq">Tu correo</span><input name="email" type="email" required /></label>
          <label className="f-campo"><span className="etq">Teléfono (opcional)</span><input name="telefono" maxLength={32} /></label>
          <label className="f-campo"><span className="etq">¿Algo que deba saber el anfitrión?</span><textarea name="notas" rows={3} maxLength={4000} /></label>
          <p className="m" style={{ color: "var(--muted-fg)" }}>
            Es una <strong>solicitud</strong>: el anfitrión la confirma o la rechaza. No se cobra nada por
            adelantado y no se pide ningún dato de pago.
          </p>
          <div className="f-acciones">
            <button className="f-aplicar" type="submit">Enviar solicitud</button>
            <Link className="f-limpiar" href={`/alojamiento/${slug}`}>Cancelar</Link>
          </div>
        </form>
      )}
        </div>
      </div>
    </main>
  );
}
