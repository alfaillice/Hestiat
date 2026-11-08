/**
 * El icono de los marcadores del mapa, en un único sitio.
 *
 * POR QUÉ EXISTE ESTE FICHERO
 *
 * Leaflet, cuando no le das un icono, usa el suyo por defecto: unas imágenes PNG que su propia hoja
 * de estilos y su código referencian por ruta relativa (`images/marker-icon.png`, y en el código
 * `iconUrl: 'marker-icon.png'`). En una aplicación empaquetada esas rutas no existen, así que el
 * navegador pedía un fichero que no está y el marcador aparecía como imagen rota.
 *
 * La corrección no es tapar el hueco con un estilo: es no depender nunca de esas imágenes. Aquí el
 * icono se dibuja con un SVG en línea, incrustado en el propio marcador. No hay petición de red, no
 * hay ruta que pueda faltar y no hay campo de imagen que pueda venir vacío o con una URL antigua.
 * Es el mismo icono para el mapa de la ficha y para el del editor: una sola implementación.
 *
 * Los marcadores del mapa general del buscador no usan esto: dibujan el precio con su propio
 * `divIcon` y tampoco dependen de ninguna imagen.
 */

/** El pin: la gota clásica de mapa, con el color de Hestiat y el punto interior en blanco. */
const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true" focusable="false">
<path d="M15 .9C7.2.9.9 7.2.9 15c0 10.6 14.1 25.6 14.1 25.6S29.1 25.6 29.1 15C29.1 7.2 22.8.9 15 .9z" fill="#0f6f7a" stroke="#ffffff" stroke-width="1.8"/>
<circle cx="15" cy="15" r="5.4" fill="#ffffff"/>
</svg>`;

/**
 * Devuelve el icono listo para Leaflet. Se le pasa la instancia de Leaflet porque llega por
 * importación dinámica (Leaflet necesita el DOM y este componente es de cliente).
 *
 * El ancla se pone en la punta del pin, que es lo que hace que señale el punto exacto; y el
 * bocadillo (popup) se abre justo encima.
 */
export function iconoPin(L: any) {
  return L.divIcon({
    className: "hx-pin-ficha",
    html: PIN,
    // Medidas del pin; el ancla, en la punta inferior centrada.
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -40],
  });
}
