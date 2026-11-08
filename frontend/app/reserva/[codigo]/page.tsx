import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { datosDeReserva, estadoLegible } from "@/lib/correo-reservas.server";

export const dynamic = "force-dynamic";

/**
 * Consulta pública de una reserva por su código.
 *
 * Existe porque el correo del huésped promete un enlace para consultar la reserva, y muchos huéspedes
 * reservan sin crear cuenta: mandarles al panel de perfil sería mandarles a un muro. El código de 12
 * caracteres (32 posibles por carácter) hace de llave: quien lo tiene, ve la reserva; quien no, no.
 *
 * Privacidad: se muestran el alojamiento, las fechas y el importe, pero NO el correo ni el teléfono
 * del huésped, y el nombre va acortado. Para cualquier gestión, el buzón de Hestiat.
 */
const cargar = cache(async (codigo: string) => datosDeReserva(await idDeCodigo(codigo)));

/** El código es la llave, pero las consultas van por identificador: así un código raro no hace ruido. */
async function idDeCodigo(codigo: string): Promise<number> {
  const limpio = (codigo ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(limpio)) return 0;
  const { poolLegacy } = await import("@/lib/db");
  const [filas] = await poolLegacy.query<any[]>(`SELECT id FROM reserva WHERE codigo = ? LIMIT 1`, [limpio]);
  return Number(filas[0]?.id ?? 0);
}

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const d = await cargar(codigo);
  // El 404 se decide aquí, no en el cuerpo: dentro de la página el estado ya se habría enviado.
  if (!d) notFound();
  return {
    title: `Reserva ${d.codigo} — Hestiat`,
    robots: { index: false, follow: false },
  };
}

/** Nombre acortado: nombre y la inicial del primer apellido. Nunca el nombre completo en una URL pública. */
function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "Huésped";
  return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
}

function fechaLarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  const t = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function euros(total: number, moneda: string): string {
  const n = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(total);
  return moneda === "EUR" ? `${n} €` : `${n} ${moneda}`;
}

export default async function VerReserva({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const d = await cargar(codigo);
  if (!d) notFound();

  const ubicacion = [d.alojamientoCiudad, d.alojamientoProvincia].filter(Boolean).join(", ") || "España";
  const confirmada = d.estado === "confirmada" || d.estado === "completada";

  return (
    <div className="wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 18px 64px" }}>
      <p style={{ marginBottom: 10 }}>
        <Link href="/" className="m" style={{ color: "var(--muted-fg)" }}>← Volver a Hestiat</Link>
      </p>

      <h1 style={{ marginBottom: 4 }}>Reserva {d.codigo}</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 18 }}>
        {estadoLegible(d.estado)}
      </p>

      <p className="aviso" style={confirmada ? { marginBottom: 18 } : { marginBottom: 18, borderColor: "var(--amber, #c9a227)", color: "#8a6d1f" }}>
        {d.estado === "pendiente"
          ? "El anfitrión todavía tiene que confirmar esta reserva. Te avisaremos por correo en cuanto lo haga."
          : confirmada
            ? "El anfitrión ha confirmado la reserva. La dirección exacta te la facilitará él mismo."
            : "Esta reserva ya no está activa."}
      </p>

      <ul className="editor-datos">
        <li>
          <span>Alojamiento</span>
          <span>
            {d.alojamientoSlug ? (
              <Link href={`/alojamiento/${d.alojamientoSlug}`}>{d.alojamientoTitulo}</Link>
            ) : (
              d.alojamientoTitulo
            )}
          </span>
        </li>
        <li><span>Ubicación</span><span>{ubicacion}</span></li>
        <li><span>Llegada</span><span>{fechaLarga(d.llegada)}</span></li>
        <li><span>Salida</span><span>{fechaLarga(d.salida)}</span></li>
        <li><span>Noches</span><span>{d.noches}</span></li>
        <li><span>Viajeros</span><span>{d.huespedes}</span></li>
        <li><span>A nombre de</span><span>{nombreCorto(d.huespedNombre)}</span></li>
        <li>
          <span>Precio total</span>
          <span>
            {euros(d.total, d.moneda)}
            {d.precioOrientativo ? <span className="m" style={{ color: "var(--muted-fg)" }}> · orientativo, lo cierra el anfitrión</span> : null}
          </span>
        </li>
      </ul>

      <p className="m" style={{ color: "var(--muted-fg)", marginTop: 18, fontSize: 13 }}>
        Por privacidad no mostramos aquí tu correo ni tu teléfono. Guarda el código <strong>{d.codigo}</strong>:
        para cualquier cambio o duda, escribe a <a href="mailto:hola@hestiat.com">hola@hestiat.com</a> indicándolo.
        En Hestiat no se cobra nada: no hay comisión ni pasarela de pago, y el pago se acuerda con el anfitrión.
      </p>
    </div>
  );
}
