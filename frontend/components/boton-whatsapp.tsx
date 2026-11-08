import { enlaceWhatsapp, mensajeWhatsapp, normalizarWhatsapp } from "@/lib/whatsapp";

/**
 * CONTACTAR CON EL ANFITRIÓN POR WHATSAPP.
 *
 * Solo aparece si el número guardado en la ficha del alojamiento es utilizable. Si no lo es, no se
 * muestra ningún botón: se explica que el contacto no está disponible. Un botón que llevase a un
 * número incorrecto sería peor que no tenerlo.
 *
 * Abre WhatsApp con un mensaje ya escrito que la persona revisa y decide enviar: no se envía nada solo.
 */
export default function BotonWhatsapp({ numero, titulo, enlaceFicha }: { numero: string | null | undefined; titulo: string; enlaceFicha: string }) {
  const n = normalizarWhatsapp(numero);
  if (!n) {
    return (
      <p className="meta" style={{ marginTop: 8 }}>
        Este alojamiento no tiene un contacto por WhatsApp disponible.
      </p>
    );
  }
  return (
    <p className="ficha-hechos" style={{ marginTop: 10 }}>
      <a className="f-aplicar" href={enlaceWhatsapp(n, mensajeWhatsapp(titulo, enlaceFicha))} target="_blank" rel="noopener noreferrer">
        Contactar con el anfitrión por WhatsApp
      </a>
    </p>
  );
}
