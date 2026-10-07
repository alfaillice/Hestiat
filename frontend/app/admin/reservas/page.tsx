import Link from "next/link";
import { poolLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Reservas.
 *
 * Faltaba: el menú del panel enlazaba a `/admin/reservas` y devolvía 404.
 *
 * Detalle importante: en vez de dar por supuestos los nombres de las columnas de `reserva`, se
 * consultan primero en `information_schema` y se hace el SELECT solo con las que existen de
 * verdad. Si el esquema cambia, esta pantalla sigue funcionando en vez de caerse con un error
 * de SQL — y nunca se muestra información inventada: lo que no existe se marca como «—».
 */
const CANDIDATAS = [
  "id",
  "alojamiento_id",
  "usuario_id",
  "fecha_entrada",
  "fecha_salida",
  "huespedes",
  "precio_total",
  "precio",
  "estado",
  "creado_en",
];

function etiqueta(columna: string): string {
  const nombres: Record<string, string> = {
    id: "ID",
    alojamiento_id: "Alojamiento",
    usuario_id: "Usuario",
    fecha_entrada: "Entrada",
    fecha_salida: "Salida",
    huespedes: "Huéspedes",
    precio_total: "Importe",
    precio: "Importe",
    estado: "Estado",
    creado_en: "Creada",
  };
  return nombres[columna] ?? columna;
}

export default async function AdminReservas() {
  const [columnas] = await poolLegacy.query<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reserva'`,
  );
  const reales = new Set(columnas.map((c) => String(c.COLUMN_NAME).toLowerCase()));
  const usar = CANDIDATAS.filter((c) => reales.has(c));

  if (usar.length === 0) {
    return (
      <>
        <header className="admin-cab">
          <h1>Reservas</h1>
        </header>
        <p className="aviso">
          La tabla <code>reserva</code> no existe o no tiene las columnas esperadas en esta base. No se
          muestra nada en lugar de mostrar datos inventados.
        </p>
      </>
    );
  }

  const [filas] = await poolLegacy.query<any[]>(
    `SELECT ${usar.map((c) => `r.\`${c}\``).join(", ")}
       FROM reserva r ORDER BY ${reales.has("id") ? "r.id" : usar[0]} DESC LIMIT 100`,
  );
  const [totFilas] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM reserva`);
  const total = Number(totFilas[0]?.n ?? 0);

  return (
    <>
      <header className="admin-cab">
        <h1>Reservas</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {total.toLocaleString("es-ES")} {total === 1 ? "reserva registrada" : "reservas registradas"}
          {total > filas.length ? ` · mostrando las ${filas.length} más recientes` : ""}
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="aviso">
          No hay ninguna reserva registrada todavía. El sistema de reservas está listo y comprueba la
          disponibilidad en el servidor antes de confirmar, para que no puedan solaparse dos.
        </p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                {usar.map((c) => (
                  <th key={c}>{etiqueta(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.id ?? i}>
                  {usar.map((c) => {
                    const v = f[c];
                    const esNum = typeof v === "number" || /^\d+$/.test(String(v ?? ""));
                    const fecha = /fecha|creado/.test(c) && v;
                    return (
                      <td key={c} className={esNum ? "num" : undefined}>
                        {v === null || v === undefined || v === ""
                          ? "—"
                          : fecha
                            ? String(v).slice(0, 10)
                            : String(v).slice(0, 60)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        <Link className="f-limpiar" href="/admin">
          ← Volver al resumen
        </Link>
      </p>
    </>
  );
}
