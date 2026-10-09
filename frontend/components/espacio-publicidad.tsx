import { PUBLICIDAD_ACTIVA, huecoDe } from "@/lib/publicidad";

/**
 * HUECO DE PUBLICIDAD.
 *
 * Con la publicidad apagada —que es como está hoy— este componente no dibuja absolutamente nada:
 * ni caja, ni borde, ni espacio reservado. Así el sitio no reserva huecos vacíos ni pierde velocidad
 * por publicidad que todavía no existe.
 *
 * Se coloca en el HTML en los sitios previstos, con su identificador, para que el día que se active
 * baste con encenderlo y cargar el proveedor. Nada más.
 */
export default function EspacioPublicidad({ hueco }: { hueco: string }) {
  if (!PUBLICIDAD_ACTIVA) return null;

  const sitio = huecoDe(hueco);
  if (!sitio) return null;

  return (
    <aside
      className={`publi publi-${sitio.formato}`}
      data-hueco={sitio.id}
      aria-label="Espacio publicitario"
      style={{ minHeight: `${sitio.alto}px` }}
    />
  );
}
