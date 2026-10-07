import Link from "next/link";
import { requireHost } from "@/lib/auth.server";
import { misAlojamientos } from "@/lib/calendario.server";
import { alojamientoConPrecio } from "@/lib/precios.server";

export const dynamic = "force-dynamic";

/**
 * Precios del alojamiento.
 *
 * Dos cosas que la interfaz deja claras porque son las que generan dudas de verdad:
 *  · El precio se escribe en las DOS bases (la del panel y la del catálogo público), así que al
 *    guardarlo cambia de inmediato lo que ven los visitantes.
 *  · Cambiar la tarifa **no toca ninguna reserva existente**: cada reserva guarda el importe
 *    acordado al crearse. Si hay reservas futuras, se avisa y hay que confirmarlo, porque el
 *    anfitrión debe saber que la tarifa nueva es para las reservas NUEVAS.
 */
export default async function HostPrecios({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; aviso?: string; ok?: string }>;
}) {
  const host = await requireHost();
  if (!host) return null;

  const sp = await searchParams;
  const lista = await misAlojamientos(host.id);
  const seleccionado = Number(sp.a) || lista[0]?.id || 0;
  const alojamiento = lista.find((l) => l.id === seleccionado) ?? lista[0];
  const datos = alojamiento ? await alojamientoConPrecio(host.id, alojamiento.id) : null;

  return (
    <>
      <header className="admin-cab">
        <h1>Precios</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Sin comisiones: el precio que pongas es el que ve el huésped.
        </p>
      </header>

      {sp.aviso && (
        <p className="aviso" style={sp.ok === "0" ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 14 } : { marginBottom: 14 }}>
          {sp.aviso}
        </p>
      )}

      {lista.length === 0 || !datos ? (
        <p className="aviso">
          Todavía no tienes alojamientos a tu nombre.{" "}
          <Link href="/host" style={{ textDecoration: "underline" }}>Vuelve a tu panel</Link>.
        </p>
      ) : (
        <>
          {lista.length > 1 && (
            <form method="get" className="admin-buscar">
              <select name="a" defaultValue={String(alojamiento?.id ?? "")}>
                {lista.map((l) => (
                  <option key={l.id} value={l.id}>{l.titulo} {l.ciudad ? `· ${l.ciudad}` : ""}</option>
                ))}
              </select>
              <button type="submit" className="f-aplicar">Ver</button>
            </form>
          )}

          <section className="aud-bloque" style={{ marginBottom: 18 }}>
            <div className="aud-cab">
              <h2>{datos.titulo}</h2>
              <span className="aud-num">
                {datos.precioNoche !== null
                  ? `${datos.precioNoche.toLocaleString("es-ES")} €`
                  : datos.precioOrientativo !== null
                    ? `desde ${datos.precioOrientativo.toLocaleString("es-ES")} €`
                    : "sin precio"}
              </span>
            </div>
            <p className="m" style={{ color: "var(--muted-fg)" }}>
              {datos.precioNoche !== null
                ? "Precio publicado por ti: la ficha lo muestra como precio cerrado."
                : "Ahora mismo la ficha muestra un precio orientativo. Si pones precio por noche, pasa a ser el precio publicado."}
            </p>
          </section>

          {datos.reservasFuturas > 0 && (
            <p className="aviso" style={{ borderColor: "var(--accent)", marginBottom: 16 }}>
              Tienes <strong>{datos.reservasFuturas}</strong>{" "}
              {datos.reservasFuturas === 1 ? "reserva futura" : "reservas futuras"}. Las reservas ya hechas
              mantienen el importe que se acordó: la tarifa nueva solo se aplica a las reservas nuevas.
            </p>
          )}

          <form action="/api/host/precios" method="post" className="form-edicion">
            <input type="hidden" name="a" value={datos.alojamientoId} />
            <div className="fila-2">
              <label className="f-campo">
                <span className="etq">Precio por noche (€)</span>
                <input name="precio_noche" inputMode="decimal" defaultValue={datos.precioNoche ?? ""} placeholder="95" />
              </label>
              <label className="f-campo">
                <span className="etq">Precio orientativo (€)</span>
                <input name="precio_orientativo" inputMode="decimal" defaultValue={datos.precioOrientativo ?? ""} placeholder="80" />
              </label>
            </div>
            <p className="m" style={{ color: "var(--muted-fg)" }}>
              El precio por noche es el que se usa para calcular las reservas. El orientativo es solo una
              referencia para el buscador cuando todavía no has fijado tarifa.
            </p>
            {datos.reservasFuturas > 0 && (
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                <input type="checkbox" name="confirmado" value="1" required />
                <span>
                  Entiendo que las {datos.reservasFuturas} reservas ya hechas mantienen su precio y que la
                  tarifa nueva se aplicará a las reservas nuevas.
                </span>
              </label>
            )}
            <div className="f-acciones">
              <button className="f-aplicar" type="submit">Guardar precio</button>
              <Link className="f-limpiar" href="/host">Volver</Link>
            </div>
          </form>

          <p className="aviso" style={{ marginTop: 18 }}>
            Las <strong>fotografías</strong> se gestionan en la ficha del alojamiento, junto al calendario:{" "}
            <Link href={`/host/alojamientos/${datos.alojamientoId}`} style={{ textDecoration: "underline" }}>
              gestionar fotos y calendarios
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}
