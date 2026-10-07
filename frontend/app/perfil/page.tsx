import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth.server";
import { datosPerfil } from "@/lib/cuenta.server";
import { reservasDeHuesped } from "@/lib/reservas.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi perfil — Hestiat", robots: { index: false } };

/**
 * Mi perfil.
 *
 * Todo sale de la sesión: el identificador del usuario no viaja nunca por la URL ni por campos
 * ocultos, así que nadie puede abrir el perfil de otra persona cambiando un parámetro.
 */
const ESTADO: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada",
  rechazada: "Rechazada", completada: "Completada", no_show: "No presentado",
};

export default async function Perfil({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; ok?: string; bienvenida?: string }>;
}) {
  const sesion = await getCurrentUser();
  if (!sesion) redirect("/login?redirect=/perfil");

  const sp = await searchParams;
  const perfil = await datosPerfil(sesion.id);
  if (!perfil) redirect("/login?redirect=/perfil");

  const reservas = await reservasDeHuesped(perfil.email);
  const esAnfitrion = perfil.rol === "anfitrion" || perfil.rol === "admin";

  return (
    <main className="wrap" style={{ maxWidth: 820, paddingTop: 32 }}>
      <header className="admin-cab">
        <h1>Mi perfil</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {perfil.email} · rol: {perfil.rol}
          {esAnfitrion ? " · tienes panel de anfitrión" : ""}
        </p>
      </header>

      {sp.bienvenida && (
        <p className="aviso" style={{ marginBottom: 16 }}>
          ¡Cuenta creada! Ya puedes solicitar reservas y guardar alojamientos.
        </p>
      )}
      {sp.aviso && (
        <p className="aviso" style={sp.ok === "0" ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 16 } : { marginBottom: 16 }}>
          {sp.aviso}
        </p>
      )}

      <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {esAnfitrion && <Link className="f-aplicar" href="/host">Ir a mi panel de anfitrión</Link>}
        <form action="/api/auth/logout" method="post">
          <button className="f-limpiar" type="submit">Cerrar sesión</button>
        </form>
      </nav>

      <h2 style={{ fontSize: 19, margin: "8px 0 10px" }}>Mis datos</h2>
      <form action="/api/perfil" method="post" className="form-edicion">
        <input type="hidden" name="accion" value="perfil" />
        <div className="fila-2">
          <label className="f-campo"><span className="etq">Nombre</span><input name="nombre" defaultValue={perfil.nombre ?? ""} maxLength={191} /></label>
          <label className="f-campo"><span className="etq">Apellidos</span><input name="apellidos" defaultValue={perfil.apellidos ?? ""} maxLength={191} /></label>
        </div>
        <div className="fila-2">
          <label className="f-campo"><span className="etq">Teléfono</span><input name="telefono" defaultValue={perfil.telefono ?? ""} maxLength={32} /></label>
          <label className="f-campo"><span className="etq">Nombre que se muestra</span><input name="nombre_mostrado" defaultValue={perfil.nombre_mostrado ?? ""} maxLength={191} /></label>
        </div>
        <div className="fila-2">
          <label className="f-campo"><span className="etq">Ciudad</span><input name="ciudad" defaultValue={perfil.ciudad ?? ""} maxLength={128} /></label>
          <label className="f-campo"><span className="etq">País</span><input name="pais" defaultValue={perfil.pais ?? ""} maxLength={64} /></label>
        </div>
        <label className="f-campo"><span className="etq">Sobre mí</span><textarea name="bio" rows={3} defaultValue={perfil.bio ?? ""} maxLength={400} /></label>
        <div className="f-acciones"><button className="f-aplicar" type="submit">Guardar cambios</button></div>
      </form>

      <h2 style={{ fontSize: 19, margin: "26px 0 10px" }}>Mis reservas</h2>
      {reservas.length === 0 ? (
        <p className="aviso">
          Todavía no has solicitado ninguna reserva. Cuando lo hagas, aparecerá aquí con su código y su estado.
        </p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Alojamiento</th><th>Fechas</th><th>Noches</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.codigo ?? `#${r.id}`}</td>
                  <td>{r.alojamientoTitulo.slice(0, 34)}</td>
                  <td>{r.llegada} → {r.salida}</td>
                  <td className="num">{r.noches}</td>
                  <td className="num">{r.total.toLocaleString("es-ES")} {r.moneda}</td>
                  <td>{ESTADO[r.estado] ?? r.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: 19, margin: "26px 0 10px" }}>Contraseña</h2>
      <form action="/api/perfil" method="post" className="form-edicion">
        <input type="hidden" name="accion" value="password" />
        <label className="f-campo"><span className="etq">Contraseña actual</span><input name="actual" type="password" required autoComplete="current-password" /></label>
        <div className="fila-2">
          <label className="f-campo"><span className="etq">Nueva</span><input name="nueva" type="password" minLength={8} required autoComplete="new-password" /></label>
          <label className="f-campo"><span className="etq">Repite la nueva</span><input name="nueva2" type="password" minLength={8} required autoComplete="new-password" /></label>
        </div>
        <div className="f-acciones"><button className="f-limpiar" type="submit">Cambiar contraseña</button></div>
      </form>
    </main>
  );
}
