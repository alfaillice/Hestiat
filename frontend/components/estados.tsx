import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Estados compartidos: aviso, vacío y error.
 *
 * Por qué existe este fichero: cada página del panel iba escribiendo su propio `<p className="aviso">`
 * con estilos a mano, y los mensajes de error acababan con colores distintos según la página. Aquí
 * quedan **una sola vez**, y todas las páginas hablan igual.
 *
 * Tres reglas que siguen estos componentes:
 *  · Un error se ve distinto de una confirmación (color, no solo texto).
 *  · Un estado vacío dice **qué pasa, por qué y qué hacer después** — nunca una pantalla en blanco.
 *  · El aviso de error lleva `role="alert"` para que un lector de pantalla lo anuncie.
 */

export function Aviso({ texto, ok }: { texto?: string | null; ok?: string | null }) {
  if (!texto) return null;
  const esError = ok === "0";
  return (
    <p
      className="aviso"
      role={esError ? "alert" : "status"}
      style={esError ? { borderColor: "var(--destructive)", color: "var(--destructive)", marginBottom: 14 } : { marginBottom: 14 }}
    >
      {texto}
    </p>
  );
}

export function Vacio({
  titulo,
  explicacion,
  accion,
  enlaces,
}: {
  titulo: string;
  explicacion: ReactNode;
  accion?: { texto: string; href: string };
  /** Salidas concretas para seguir buscando. Se muestran como enlaces, no como texto decorativo. */
  enlaces?: { texto: string; href: string }[];
}) {
  return (
    <div className="vacio">
      <p className="vacio-titulo">{titulo}</p>
      <p className="vacio-texto">{explicacion}</p>
      {accion && (
        <p style={{ marginTop: 10 }}>
          <Link className="f-limpiar" href={accion.href}>
            {accion.texto}
          </Link>
        </p>
      )}
      {enlaces && enlaces.length > 0 && (
        <ul className="vacio-enlaces">
          {enlaces.map((e) => (
            <li key={e.href}>
              <Link href={e.href}>{e.texto}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bloque de carga con la misma forma que el contenido que va a aparecer. */
export function Cargando({ lineas = 4 }: { lineas?: number }) {
  return (
    <div className="cargando" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="esqueleto esq-titulo" />
      {Array.from({ length: lineas }).map((_, i) => (
        <div key={i} className="esqueleto esq-linea" />
      ))}
    </div>
  );
}

/** Panel de error reutilizable (lo usan los límites de error de cada sección). */
export function PanelError({
  titulo = "No se ha podido cargar esta sección",
  detalle,
  onReintentar,
}: {
  titulo?: string;
  detalle?: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="vacio" role="alert">
      <p className="vacio-titulo">{titulo}</p>
      <p className="vacio-texto">
        {detalle ??
          "Ha ocurrido un problema al pedir los datos. Puede ser algo temporal: vuelve a intentarlo."}
      </p>
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {onReintentar && (
          <button className="f-aplicar" type="button" onClick={onReintentar}>
            Reintentar
          </button>
        )}
        <Link className="f-limpiar" href="/host">
          Volver a mi panel
        </Link>
      </div>
    </div>
  );
}
