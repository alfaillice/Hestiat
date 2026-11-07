import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth.server";
import BuscadorCabecera from "@/components/buscador-cabecera";
import Vitales from "@/components/vitales";
import MarcaLogo from "@/components/marca-logo";
import AvisoCookies, { BotonConfigurarCookies } from "@/components/aviso-cookies";
import { DM_Sans, Manrope } from "next/font/google";

/**
 * Sistema de diseño de Hestiat 2.0, tomado de los tokens REALES en producción
 * (extraídos del CSS servido, en OKLCH). Decisión del cliente: replicar el aspecto
 * que ya funciona, no inventar uno nuevo.
 *
 *  · Fondo cálido: oklch(98.8% .005 92)      · Superficie: oklch(97.2% .008 92)
 *  · Primario (petróleo): oklch(41.5% .072 197) · Primario suave: oklch(94.5% .022 195)
 *  · Acento (ámbar): oklch(79.5% .135 74)     · Texto sobre acento: oklch(29% .06 62)
 *  · Tinta: oklch(18.5% .024 230) · Secundario: oklch(51.5% .019 232)
 *  · Borde: oklch(90% .008 232) · Éxito: oklch(58% .115 158) · Error: oklch(55.2% .191 25)
 *  · Tipografía: DM Sans (negrita, tracking negativo) en titulares; Manrope en interfaz.
 *  · Controles en píldora (radio completo).
 */
const manrope = Manrope({ subsets: ["latin"], variable: "--fuente-texto", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["500", "700"], variable: "--fuente-titulo", display: "swap" });

export const metadata: Metadata = {
  title: "Hestiat — Alojamientos con carácter en toda España",
  description:
    "Encuentra donde quedarte, sin sorpresas y sin comisiones. Busca por ciudad, provincia, código postal o punto de interés.",
  metadataBase: new URL("https://hestiat.com"),
  /* OPEN GRAPH Y TWITTER CARDS: imagen de marca por defecto para todas las páginas.
     1200x630 es el formato que piden las dos redes para la tarjeta grande. Las páginas que ya
     aportan su propia imagen (la ficha de un alojamiento con su foto, un destino con su imagen de
     referencia) siguen usando la suya: esto es el respaldo, no una sustitución. */
  openGraph: {
    type: "website",
    siteName: "Hestiat",
    locale: "es_ES",
    images: [{ url: "/og/og-1200x630.png", width: 1200, height: 630, alt: "Hestiat" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{ url: "/og/og-1200x630.png", alt: "Hestiat" }],
  },
};

const estilos = `
:root{
  --background:oklch(98.8% .005 92); --foreground:oklch(23.5% .021 225); --ink:oklch(18.5% .024 230);
  --card:oklch(100% 0 0); --primary:#0A1435; --primary-fg:oklch(98.5% .008 190);
  --primary-soft:oklch(94.5% .022 195); --accent:#F2A9BE; --accent-fg:#5A1F30;
  --secondary:oklch(96.2% .008 92); --muted:oklch(95.5% .007 92); --muted-fg:oklch(51.5% .019 232);
  --success:oklch(58% .115 158); --destructive:oklch(55.2% .191 25);
  --border:oklch(90% .008 232); --surface:oklch(97.2% .008 92); --surface-strong:oklch(93.5% .014 92);
  --radio:14px; --radio-pill:9999px;
  /* Ancho del contenedor global. Un único valor para toda la web. */
  --contenedor:1760px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--background);color:var(--foreground)}
body{font-family:var(--fuente-texto),ui-sans-serif,system-ui,sans-serif;font-size:15.2px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--fuente-titulo),ui-sans-serif,system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;line-height:1.12}
a{color:inherit;text-decoration:none} img{display:block;max-width:100%}
/* UN SOLO contenedor para toda la web: cabecera, secciones, galería, ficha y paneles comparten
   los mismos raíles izquierdo y derecho. Antes había tres anchos distintos (1360 la cabecera,
   1720 la galería, 1180 la portada), así que en la misma pantalla el logo empezaba en x=98 y la
   galería en x=18: ochenta píxeles de desalineación que se ven como contenido «tirado a la
   izquierda». El ancho se ajusta en un solo sitio: --contenedor. */
.wrap{max-width:var(--contenedor);margin:0 auto;padding:0 18px}
/* cabecera */
.cab{border-bottom:1px solid var(--border);background:var(--background);position:sticky;top:0;z-index:40}
.cab-in{display:flex;align-items:center;gap:14px;height:60px}
.marca{font-weight:700;letter-spacing:-.01em;font-size:20px;color:var(--primary);font-family:var(--fuente-titulo)}
.cab-btn{margin-left:auto;border:1px solid var(--border);background:var(--card);border-radius:var(--radio-pill);padding:11px 16px;font:inherit;cursor:pointer}
/* (el buscador flotante de la portada se ha eliminado: la búsqueda vive en la cabecera) */
/* hero */
.hero{position:relative;min-height:420px;display:flex;align-items:flex-end;margin-bottom:26px;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero .velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,30,36,.15) 0%,rgba(12,30,36,.72) 100%)}
.hero .cont{position:relative;width:100%;padding:28px 18px 30px;max-width:1180px;margin:0 auto}
.hero .eyebrow{color:var(--accent);font-weight:700;letter-spacing:.14em;font-size:11.5px;text-transform:uppercase;margin-bottom:8px}
.hero h1{color:#fff;font-size:38px;max-width:22ch;margin-bottom:10px}
.hero p.sub{color:rgba(255,255,255,.9);max-width:54ch;margin-bottom:18px;font-size:14.5px}
.hero .credito{position:absolute;right:14px;bottom:8px;color:rgba(255,255,255,.55);font-size:10.5px}
/* secciones */
.seccion{margin:64px 0}
.seccion-cab{display:flex;align-items:baseline;gap:12px;margin-bottom:4px}
.seccion-cab h2{font-size:24px}
.seccion-cab .mas{margin-left:auto;color:var(--primary);font-weight:600;font-size:13.5px}
.seccion-sub{color:var(--muted-fg);font-size:13.5px;margin-bottom:14px}
/* carrusel */
.carrusel{display:flex;gap:14px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}
.carrusel::-webkit-scrollbar{height:6px}.carrusel::-webkit-scrollbar-thumb{background:var(--border);border-radius:9px}
/* tarjetas de estilo */
.estilo{position:relative;display:block;flex:1 1 0;min-width:240px;height:200px;border-radius:var(--radio);overflow:hidden;background:var(--surface-strong)}
.estilo img{width:100%;height:100%;object-fit:cover}
.estilo .velo{position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(12,30,36,.75) 100%)}
.estilo .txt{position:absolute;left:14px;bottom:12px;color:#fff}
.estilo .txt b{font-family:var(--fuente-titulo);font-size:16.5px;display:block}
/* Sin opacidad parcial, por el mismo motivo que .serv-fuente: al 85 % el texto pequeño
   no llega al mínimo de contraste AA. */
.estilo .txt span{font-size:12.5px}
/* destinos */
/* 200px: con 1360 de contenedor, 6 columnas de 210 se quedaban a 6px de entrar. */
.destinos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.destino{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);overflow:hidden}
.destino img{height:110px;width:100%;object-fit:cover;background:var(--surface-strong)}
.destino .d{padding:10px 12px 12px}
.destino b{font-family:var(--fuente-titulo);font-size:15px;display:block}
.destino span{color:var(--foreground);font-size:12.5px;font-variant-numeric:tabular-nums}
/* tarjetas de alojamiento */
.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
.aloj{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);overflow:hidden;transition:box-shadow .18s ease,transform .18s ease}
.aloj:hover{box-shadow:0 12px 28px rgba(20,40,50,.12);transform:translateY(-2px)}
/* display:block imprescindible: un <span> ignora la altura y la foto se desborda
   (medido en producción: 333px en lugar de 190px, con la rejilla irregular). */
.aloj .foto{display:block;position:relative;height:190px;background:var(--surface-strong)}
.aloj .foto img{width:100%;height:100%;object-fit:cover}
.aloj .fav{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:var(--radio-pill);border:0;background:rgba(255,255,255,.9);cursor:pointer}
.aloj .d{padding:11px 13px 14px}
/* Los textos de la tarjeta son <span> y nunca se les puso display: nombre, lugar y precio se
   pintaban en la misma línea y se pisaban entre sí. Se pintan en bloque. */
.aloj .d,.aloj .d .t,.aloj .d .m,.aloj .d .p{display:block}
.aloj .t{font-family:var(--fuente-titulo);font-weight:700;font-size:15.5px;line-height:1.25;margin-bottom:2px}
.aloj .m{color:var(--muted-fg);font-size:12.5px}
.aloj .p{margin-top:8px;font-weight:700;font-variant-numeric:tabular-nums}
.aloj .p .ref{color:var(--muted-fg);font-weight:400;font-size:12px}
.precio{font-variant-numeric:tabular-nums}
footer{border-top:1px solid var(--border);margin-top:44px;padding:24px 0;color:var(--muted-fg);font-size:13px}
.pie{display:flex;flex-direction:column;gap:18px}
.pie-cols{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:22px}
.pie-marca{font-family:var(--fuente-titulo);font-size:17px;font-weight:700;color:var(--ink);margin-bottom:6px}
.pie-nota{font-size:13px;line-height:1.6;max-width:36ch}
.pie-tit{font-weight:700;color:var(--ink);font-size:13px;margin-bottom:8px}
footer nav{display:flex;flex-direction:column;gap:6px}
footer a{color:var(--muted-fg)}
footer a:hover{color:var(--hestiat-primary-texto)}
.pie-legal{font-size:12.5px;line-height:1.65;border-top:1px solid var(--border);padding-top:14px}
.pie-legal-enlaces{flex-direction:row;gap:18px;flex-wrap:wrap;font-weight:600}
/* Bloque «Publica gratis en Hestiat» de la portada: tarjeta serena, no un anuncio. */
.publica{display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:linear-gradient(135deg,var(--fucsia-soft),var(--card));border:1px solid var(--border);border-radius:calc(var(--radio) + 6px);padding:26px 28px;margin:28px 0 8px}
.publica-txt{max-width:62ch}
.publica-etq{font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--hestiat-primary-texto);margin-bottom:6px}
.publica h2{font-size:clamp(20px,2.4vw,26px);margin-bottom:8px}
.publica-sub{color:var(--muted-fg);line-height:1.6}
.publica-acciones{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.publica-cta{background:var(--hestiat-primary);color:var(--ink);border-radius:var(--radio-pill);padding:13px 26px;font-weight:700;white-space:nowrap;transition:background .16s ease}
.publica-cta:hover{background:var(--hestiat-primary-hover)}
.publica-otros{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px}
.publica-otros a{color:var(--hestiat-primary-texto);font-weight:600}
/* HUECO DE PUBLICIDAD. Va etiquetado y separado del contenido por una línea, para que nadie lo
   confunda con contenido propio de Hestiat: es lo que exige la política de Google y lo que evita
   que el anuncio parezca parte de la página. Sin bordes ni cajas: no rompe el diseño. */
.publi{display:block;margin:26px 0;padding-top:12px;border-top:1px solid var(--border);min-width:0}
.publi-etq{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-fg);margin-bottom:8px}
/* BOTÓN DE CÓMO LLEGAR, debajo del mapa de las fichas. Mismo lenguaje que el resto de botones
   (píldora y color de acción) para que no parezca un añadido. */
.mapa-caja{display:block}
.mapa-como-llegar{display:inline-block;margin-top:10px;background:var(--hestiat-primary);color:var(--ink);border-radius:var(--radio-pill);padding:11px 22px;font-weight:700;text-decoration:none;transition:background .16s ease}
.mapa-como-llegar:hover{background:var(--hestiat-primary-hover)}
.mapa-nota{color:var(--muted-fg)}
/* DEFINITIVO: LA TARJETA ES LA REFERENCIA DEL ENLACE.
   La tarjeta de experiencias y servicios lleva un enlace invisible que la hace clicable entera
   (la regla .serv-enlace, con position:absolute e inset:0). Un elemento absoluto se pega a su
   contenedor POSICIONADO más cercano; como la tarjeta no lo estaba, el enlace se estiraba hasta
   mucho más arriba y se tragaba el buscador, los selectores, Quitar filtros, Ver todo, el carrusel
   de categorías, la lista de destinos y los huecos vacíos: toda esa zona actuaba como un solo
   botón. Con position:relative aquí, el enlace ocupa EXACTAMENTE su tarjeta. No cambia ningún
   tamaño, color, imagen, tipografía ni distribución: el enlace es invisible, solo deja de salirse. */
article.serv-card{position:relative}
@media(max-width:760px){
  .publica{padding:20px 18px;gap:16px;margin:22px 0 6px}
  .publica-acciones{width:100%}
  .publica-cta{width:100%;text-align:center;padding:14px 20px}
  .publica-otros{justify-content:center;width:100%}
}
.aviso{background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio);padding:12px 15px;font-size:13px;color:var(--muted-fg)}
/* busqueda con mapa y filtros */
/* Hueco de publicidad. Con la publicidad apagada no se pinta nada; estos estilos solo se aplicarán
   el día que se encienda, para que el anuncio no rompa la retícula ni empuje el contenido. */
.publi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radio);margin:22px 0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.publi-horizontal{width:100%}
.publi-cuadrado{width:100%;max-width:300px;margin:0 auto}
/* Etiqueta de las imágenes de referencia: la tarjeta nunca hace pasar por foto propia una que no lo es. */
.tjg-ref{position:absolute;left:8px;bottom:8px;background:rgba(12,30,36,.72);color:#fff;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;letter-spacing:.02em}
/* AI Manager (panel de administración): consola, listas y avisos. */
.ia-fila{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.ia-lista{display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.55}
.ia-lista li{list-style:none}
.ia-aviso{background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio);padding:10px 12px}
.ia-chat{margin-top:12px;display:flex;flex-direction:column;gap:10px;max-height:480px;overflow-y:auto;padding:4px}
.ia-msg{border:1px solid var(--border);border-radius:var(--radio);padding:10px 12px;font-size:14px;background:var(--card)}
.ia-usuario{background:var(--secondary)}
.ia-error{border-color:var(--hestiat-primary);background:var(--fucsia-soft)}
.ia-pasos{margin-top:6px;font-size:12px;color:var(--muted-fg);display:flex;flex-direction:column;gap:2px}
.ia-pasos li{list-style:none}
.busqueda{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,42%);gap:26px;align-items:start}
.mapa-lado{position:sticky;top:76px}
.filtros{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:14px;margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.f-campo{display:flex;flex-direction:column;gap:5px}
.f-campo select,.f-campo input{border:1px solid var(--border);border-radius:10px;padding:11px 12px;font:inherit;background:var(--background);color:var(--ink);width:100%}
.f-servicios{grid-column:1/-1;border:0}
.f-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.f-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:var(--radio-pill);padding:6px 12px;font-size:13.5px;cursor:pointer;background:var(--background)}
.f-chip input{accent-color:var(--hestiat-primary)}
.f-chip:has(input:checked){border-color:var(--hestiat-primary);background:var(--fucsia-soft);color:var(--fucsia-tinta)}
.f-chip em{color:var(--muted-fg);font-style:normal;font-size:12px}
.f-acciones{grid-column:1/-1;display:flex;align-items:center;gap:14px}
.f-aplicar{background:var(--hestiat-primary);color:var(--ink);border:0;border-radius:var(--radio-pill);padding:12px 22px;font:inherit;font-weight:700;cursor:pointer;transition:background .16s ease}
.f-aplicar:hover{background:var(--hestiat-primary-hover)}
/* EL COLOR PRIMARIO OFICIAL DE HESTIAT es --hestiat-primary, y sale de la ficha de alojamiento:
   es exactamente el tono que se ve en su botón «Reservar». Ese botón está deshabilitado hasta que
   se eligen fechas y el navegador lo pinta con opacidad 0,5, así que el color que se ve es el
   fucsia de la ficha al 50 % sobre blanco (#eb7fc9). El mismo fucsia a plena intensidad (#d80094)
   NO se usa como color de acción: resultaba demasiado fuerte. Para TEXTO (enlaces y estados
   activos) se usa su versión oscura de la misma familia (#7b0052), porque el pastel sobre blanco
   no tiene contraste suficiente para leerse. No se toca ninguna otra parte de la paleta. */
.f-limpiar{color:var(--muted-fg);font-size:13.5px;text-decoration:underline}
/* marcadores de precio del mapa */
.hx-pin-wrapper{background:none;border:0}
.hx-pin{display:inline-block;transform:translate(-50%,-50%);background:var(--card);border:1.5px solid var(--border);border-radius:var(--radio-pill);padding:5px 11px;font-weight:700;font-size:12.5px;color:var(--ink);font-variant-numeric:tabular-nums;box-shadow:0 3px 10px rgba(20,40,50,.18);white-space:nowrap;transition:transform .12s ease, background .12s ease, color .12s ease}
.hx-pin:hover{transform:translate(-50%,-50%) scale(1.06);z-index:2}
/* Marcador activo: relleno rosa de la identidad nueva (antes ámbar). */
.hx-pin--activo{background:var(--hestiat-primary);border-color:var(--hestiat-primary);color:var(--ink);box-shadow:0 5px 16px rgba(142,46,73,.32)}
/* paneles: administracion y anfitrion */
.admin{display:grid;grid-template-columns:230px minmax(0,1fr);gap:26px;max-width:var(--contenedor);margin:0 auto;padding:22px 18px}
.admin-nav{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:16px;position:sticky;top:76px;align-self:start}
.admin-marca{font-family:var(--fuente-titulo);font-weight:700;font-size:15px;color:var(--primary);margin-bottom:12px}
.admin-nav nav{display:flex;flex-direction:column;gap:2px}
.admin-nav nav a{padding:8px 10px;border-radius:10px;font-size:14.5px}
.admin-nav nav a:hover{background:var(--secondary)}
.admin-sesion{margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:12.5px;word-break:break-all}
.admin-main{min-width:0}
.admin-cab{margin-bottom:16px}
.admin-cab h1{font-size:26px;margin-bottom:4px}
.admin-buscar{display:flex;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:10px;margin-bottom:16px}
.admin-buscar input,.admin-buscar select{border:1px solid var(--border);border-radius:10px;padding:9px 11px;font:inherit;background:var(--background);color:var(--ink)}
.admin-buscar input{flex:1}
.tabla-scroll{overflow-x:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--radio)}
.tabla{width:100%;border-collapse:collapse;font-size:13.5px}
.tabla th{text-align:left;padding:11px 12px;border-bottom:1px solid var(--border);color:var(--muted-fg);font-weight:600;white-space:nowrap;background:var(--surface)}
.tabla td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.tabla tr:last-child td{border-bottom:0}
.tabla .num{font-variant-numeric:tabular-nums;text-align:right}
.punto{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
.punto-ok{background:var(--success)}
.punto-off{background:var(--muted-fg)}
.enlace-accion{color:var(--primary);font-weight:600;white-space:nowrap}
.form-edicion{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:18px;display:grid;gap:14px;max-width:620px}
.fila-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.login{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:20px;display:grid;gap:14px}
/* ---------- pantalla de acceso (entrar y crear cuenta) ---------- */
/* Marco de página con dos columnas, dentro del contenedor global. Se usa en el panel de usuario y
   en el proceso de reserva: antes eran columnas estrechas flotando en el centro, con los raíles
   desalineados respecto a la cabecera. */
.pagina-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,440px);gap:30px;align-items:start}
.pagina-cols-inv{grid-template-columns:minmax(340px,520px) minmax(0,1fr)}
@media(max-width:900px){.pagina-cols{grid-template-columns:1fr}}
/* medio acceso */
.acceso{display:flex;justify-content:center;padding:56px 18px 70px}
.acceso-tarjeta{width:100%;max-width:440px;background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:30px 28px;box-shadow:0 10px 34px rgba(20,40,50,.07);display:grid;gap:14px}
.acceso-marca{font-family:var(--fuente-titulo);font-weight:700;color:var(--primary);font-size:16.5px;text-align:center;letter-spacing:-.01em}
.acceso-tarjeta h1{font-size:25px;text-align:center}
.acceso-sub{color:var(--muted-fg);font-size:14px;text-align:center}
.boton-google{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid var(--border);border-radius:var(--radio-pill);background:var(--card);padding:13px 18px;font-weight:600;font-size:15px;color:var(--ink);transition:box-shadow .15s ease}
.boton-google:hover{box-shadow:0 4px 14px rgba(20,40,50,.12)}
.google-pendiente{border:1px dashed var(--border);border-radius:var(--radio);padding:12px 14px;font-size:13px;color:var(--muted-fg);display:grid;gap:3px;background:var(--secondary)}
.google-pendiente strong{font-family:var(--fuente-titulo);color:var(--foreground);font-size:13.5px}
.o-separador{display:flex;align-items:center;gap:12px;color:var(--muted-fg);font-size:12.5px;text-transform:lowercase}
.o-separador::before,.o-separador::after{content:"";height:1px;background:var(--border);flex:1}
.acceso-pie{font-size:13.5px;color:var(--muted-fg);text-align:center;line-height:1.5}
.acceso-pie a{text-decoration:underline;color:var(--foreground)}
.acceso .login{background:transparent;border:0;padding:0;gap:12px}
/* medios y canales (portado del gestor antiguo) */
.medios,.canales{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:18px}
.medios-cab{margin-bottom:12px}
.medios-cab h2{font-size:19px;margin-bottom:3px}
.medios-subir{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px;border:1px dashed var(--border);border-radius:var(--radio);margin-bottom:16px}
.medios-subir input[type=file]{font:inherit;font-size:13.5px}
.medios-rejilla{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}
.medio{position:relative;border:1px solid var(--border);border-radius:var(--radio);overflow:hidden;background:var(--surface)}
.medio img{display:block;width:100%;height:128px;object-fit:cover}
.medio-orden{position:absolute;top:7px;left:7px;background:rgba(15,25,30,.78);color:#fff;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:var(--radio-pill)}
.medio-acciones{position:absolute;top:6px;right:6px;display:flex;gap:4px}
.medio-acciones button{width:26px;height:26px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font-size:14px;line-height:1;cursor:pointer}
.medio-acciones button:disabled{opacity:.4;cursor:default}
.medio-acciones .medio-borrar:hover{border-color:var(--destructive);color:var(--destructive)}
.canales-lista{list-style:none;display:grid;gap:12px}
.canal{border:1px solid var(--border);border-radius:var(--radio);padding:13px}
.canal-cab{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.canal-estado{font-size:13px;color:var(--muted-fg)}
.canal-acciones{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.canal-acciones input{flex:1;min-width:210px;border:1px solid var(--border);border-radius:10px;padding:8px 11px;font:inherit;font-size:13.5px;background:var(--background);color:var(--ink)}
/* auditoria automatica */
.auditoria{display:grid;gap:16px}
.aud-bloque{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:16px}
.aud-cab{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:4px}
.aud-cab h2{font-size:17px}
.aud-num{font-variant-numeric:tabular-nums;font-weight:700;font-size:19px;color:var(--success)}
.aud-num-aviso{color:var(--accent-foreground)}
.dup{border-color:var(--accent);background:var(--primary-soft)}
.grid3{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.tarjeta{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:16px}
/* estados compartidos: vacio, carga y error */
.vacio{background:var(--card);border:1px dashed var(--border);border-radius:var(--radio);padding:22px;text-align:center;max-width:620px}
.vacio-titulo{font-family:var(--fuente-titulo);font-weight:700;font-size:16.5px;margin-bottom:6px}
.vacio-texto{color:var(--muted-fg);font-size:14px}
.cargando{display:grid;gap:10px;max-width:760px}
.esqueleto{background:linear-gradient(90deg,var(--secondary) 25%,var(--surface) 50%,var(--secondary) 75%);background-size:400% 100%;animation:brillo 1.4s ease-in-out infinite;border-radius:10px}
.esq-titulo{height:26px;width:42%}
.esq-linea{height:44px}
@keyframes brillo{0%{background-position:100% 0}100%{background-position:0 0}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion: reduce){.esqueleto{animation:none}}
/* ---------- editor de alojamiento (uno solo, para anfitrión y administrador) ---------- */
.editor-cab{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap}
.editor-cab h1{font-size:26px;margin-bottom:3px}
.rol-badge{display:inline-block;border:1px solid var(--border);border-radius:var(--radio-pill);padding:2px 10px;font-size:11.5px;font-weight:700;letter-spacing:.04em;background:var(--secondary);color:var(--muted-fg)}
.rol-badge-admin{background:var(--primary-soft);color:var(--primary);border-color:var(--primary)}
.editor-pestanas{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border);margin-bottom:20px}
.editor-pestana{border:0;background:transparent;font:inherit;font-size:14px;font-weight:600;color:var(--muted-fg);padding:11px 14px;border-radius:10px 10px 0 0;cursor:pointer;border-bottom:2.5px solid transparent}
.editor-pestana:hover{background:var(--secondary);color:var(--ink)}
.editor-pestana-activa{color:var(--primary);border-bottom-color:var(--primary);background:var(--primary-soft)}
.editor-seccion{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:22px;display:grid;gap:14px;max-width:820px}
.editor-seccion h2{font-size:20px;margin-bottom:2px}
.editor-seccion h3{font-size:15.5px;margin-top:8px;font-family:var(--fuente-titulo)}
.editor-nota{background:var(--secondary);border:1px solid var(--border);border-radius:10px;padding:11px 13px;font-size:13px;color:var(--muted-fg)}
.fila-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.editor-servicios{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:8px}
.editor-servicio{width:100%;justify-content:flex-start}
.editor-preview{border:1px dashed var(--border);border-radius:var(--radio);padding:14px;background:var(--surface)}
.editor-preview-titulo{font-family:var(--fuente-titulo);font-weight:700;font-size:15px;margin-bottom:10px}
.editor-preview-lista{list-style:none;font-size:13.6px;font-variant-numeric:tabular-nums;margin-top:10px}
.editor-preview-lista li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;color:var(--muted-fg)}
.editor-preview-lista li span:last-child{color:var(--ink)}
.editor-preview-total{border-top:1px solid var(--border);margin-top:6px;padding-top:9px;font-weight:700;font-size:15px;color:var(--ink)!important}
.editor-preview-total span{color:var(--ink)!important}
.editor-datos{list-style:none;font-size:13.5px;border-top:1px solid var(--border);padding-top:12px}
.editor-datos li{display:flex;justify-content:space-between;gap:14px;padding:6px 0;border-bottom:1px solid var(--border)}
.editor-datos li span:first-child{color:var(--muted-fg)}
.mapa-editor{display:grid;gap:10px;border-top:1px solid var(--border);padding-top:14px}
.mapa-editor-mapa{height:280px;border-radius:var(--radio);border:1px solid var(--border);z-index:0}
.medio-principal{font-size:13px!important}
.medio-arrastrando{outline:2px solid var(--primary);outline-offset:2px}
.medio-progreso{position:relative;flex:1 0 100%;height:20px;background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio-pill);overflow:hidden}
.medio-progreso span{display:block;height:100%;background:var(--primary);transition:width .15s ease}
.medio-progreso em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-style:normal;color:var(--ink);font-weight:600}
@media(max-width:860px){.fila-4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.editor-seccion{padding:16px}.fila-4{grid-template-columns:1fr 1fr}}
.fila-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.editor-peligro{border-color:var(--destructive)}
.editor-peligro h2{color:var(--destructive)}
.editor-export{margin-top:18px;border-top:1px solid var(--border);padding-top:14px;display:grid;gap:6px}
.editor-export h3{font-size:15px;font-family:var(--fuente-titulo)}
.editor-export input{border:1px solid var(--border);border-radius:10px;padding:11px 12px;font:inherit;font-size:13.5px;background:var(--background);color:var(--ink);width:100%}
/* calendario de disponibilidad del editor */
.caldsp,.caldisp{border:1px solid var(--border);border-radius:var(--radio);padding:14px;background:var(--surface)}
.caldisp-cab{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.caldisp-rejilla{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:460px}
.caldisp-dia{border:1px solid transparent;border-radius:8px;padding:8px 0;font:inherit;font-size:13px;cursor:pointer;color:var(--ink);font-variant-numeric:tabular-nums}
.caldisp-libre{background:var(--card);border-color:var(--border)}
.caldisp-bloqueada{background:var(--surface-strong);border-color:var(--muted-fg);color:var(--muted-fg)}
.caldisp-reservada{background:var(--primary);border-color:var(--primary);color:var(--primary-fg);cursor:not-allowed}
.caldisp-ical{background:var(--accent);border-color:var(--accent);color:var(--accent-fg);cursor:not-allowed}
.caldisp-mantenimiento{background:var(--surface-strong);border-color:var(--border);cursor:not-allowed}
.caldisp-sel{outline:2.5px solid var(--primary);outline-offset:1px;font-weight:700}
.caldisp-dia:disabled{opacity:.9}
.caldisp-leyenda{flex-wrap:wrap;gap:14px!important}
.caldisp-muestra{width:14px;height:14px;border-radius:4px;display:inline-block;border:1px solid transparent}
.caldisp-acciones{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}
.reglas-lista{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.reglas-lista li{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:13.6px;background:var(--card)}
.reglas-lista li span{color:var(--muted-fg)}
@media(max-width:860px){.fila-3{grid-template-columns:1fr}}
/* ---------- explorar: gran galería de alojamientos ---------- */
.explorar{max-width:var(--contenedor);margin:0 auto;padding:22px 18px 30px}
.explorar-cab{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.explorar-cab h1{font-size:30px}
.vista{display:flex;gap:6px;margin-left:auto;background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio-pill);padding:4px}
.vista a{padding:7px 15px;border-radius:var(--radio-pill);font-size:13.5px;font-weight:600;color:var(--muted-fg)}
.vista a.vista-activa{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(20,40,50,.10)}
/* --- Barra de búsqueda de Explorar -------------------------------------------------------------
   Primero lo que la persona viene a hacer: buscar. Va en una sola fila en pantalla grande y se
   apila en móvil sin comerse la pantalla. Reutiliza los tokens y el botón que ya existen. */
.buscador{display:grid;grid-template-columns:minmax(230px,1.7fr) minmax(158px,.8fr) minmax(104px,.5fr) auto;gap:10px;align-items:end;background:var(--card);border:1px solid var(--border);border-radius:calc(var(--radio) + 6px);padding:12px;margin-bottom:16px;box-shadow:0 6px 22px rgba(20,40,50,.07)}
.buscador-destino{position:relative;display:flex;flex-direction:column;gap:4px;min-width:0}
.buscador-campo{display:flex;flex-direction:column;gap:4px;min-width:0}
.buscador-etq{font-size:12px;font-weight:600;color:var(--muted-fg);letter-spacing:.02em;white-space:nowrap}
.buscador input[type=text],.buscador input[type=date],.buscador select{width:100%;min-width:0;padding:11px 12px;border:1px solid var(--border);border-radius:var(--radio);background:var(--bg);color:var(--ink);font:inherit;font-size:14.5px}
.buscador input[type=text]{font-weight:600}
.buscador-boton{padding:12px 22px;white-space:nowrap}
/* --- Selector de fechas: UN solo disparador y un solo calendario (el mismo de la ficha) --- */
.buscador-fechas{position:relative;display:flex;flex-direction:column;gap:4px;min-width:0}
.fechas-disparador{width:100%;text-align:left;padding:11px 12px;border:1px solid var(--border);border-radius:var(--radio);background:var(--bg);color:var(--ink);font:inherit;font-size:14.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fechas-disparador:hover{border-color:var(--hestiat-primary)}
.fechas-lleno{font-weight:600;border-color:var(--hestiat-primary);color:var(--hestiat-primary-texto)}
.fechas-noches{position:absolute;right:10px;top:-20px;font-size:11.5px;color:var(--muted-fg)}
.fechas-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:1300;background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:10px;box-shadow:0 18px 44px rgba(20,40,50,.18);max-width:min(680px,calc(100vw - 28px));max-height:min(76vh,640px);overflow:auto}
.fechas-pop .rc-calendario{margin:0;padding:0;border:0;background:none}
.sugerencias{position:absolute;top:100%;left:0;right:0;z-index:1200;margin:6px 0 0;padding:6px;list-style:none;background:var(--card);border:1px solid var(--border);border-radius:var(--radio);box-shadow:0 14px 34px rgba(20,40,50,.16);max-height:330px;overflow:auto}
.sugerencias button{display:flex;align-items:baseline;gap:8px;width:100%;padding:9px 10px;border:0;background:none;border-radius:calc(var(--radio) - 4px);cursor:pointer;text-align:left;font:inherit}
.sugerencias button:hover,.sugerencias li[aria-selected=true] button{background:var(--secondary)}
.sug-tipo{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-fg);min-width:78px}
.sug-texto{font-size:14.5px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sug-total{margin-left:auto;font-size:12.5px;color:var(--muted-fg)}
.vacio-enlaces{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:14px}
.vacio-enlaces a{font-size:13.5px;font-weight:600;color:var(--ink);text-decoration:underline}
/* === CABECERA CON BÚSQUEDA =====================================================================
   La búsqueda pasa a la cabecera, disponible en todas las páginas. Fondo blanco limpio, texto
   antracita y el magenta de Hestiat solo en lo activo y en lo accionable. */
.solo-lectores{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cab{background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:40}
.cab-in{display:flex;align-items:center;gap:16px;min-height:72px;padding:8px 18px;flex-wrap:nowrap}
.marca{font-weight:700;letter-spacing:-.02em;font-size:21px;color:var(--ink);font-family:var(--fuente-titulo);display:flex;align-items:center;gap:7px;white-space:nowrap}
/* El alto se ajusta al logotipo nuevo: la palabra dibujada es mucho más ancha que la anterior
   (relación 5,3:1 frente a 2,6:1), así que a 32 px se saldría de su sitio en la cabecera. Con este
   alto el logotipo se ve entero, grande y legible, sin empujar el buscador ni la navegación. */
.marca-logo{height:clamp(19px,3.6vw,22px);width:auto;display:block}
.marca-logo-mini{height:24px;width:auto;max-width:100%;display:inline-block;vertical-align:middle}
.marca-casa{font-size:18px}
.cab-busca{flex:1 1 auto;max-width:620px;min-width:0}
.cab-nav{display:flex;gap:8px;align-items:center;flex:0 0 auto}
.cab-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);background:var(--surface);border-radius:var(--radio-pill);padding:9px 15px;font-size:13.5px;font-weight:600;color:var(--ink);white-space:nowrap;transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease}
.cab-pill:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(20,40,50,.10);border-color:var(--hestiat-primary)}
.cab-pill:active{transform:translateY(0) scale(.985)}
.cab-pill-on{border-color:var(--hestiat-primary);color:var(--hestiat-primary-texto);background:color-mix(in srgb, var(--hestiat-primary) 24%, white)}
.cab-cuenta{display:flex;align-items:center;gap:14px;flex:0 0 auto}
.cab-menu{display:none;margin-left:auto;position:relative}
.cab-menu summary{list-style:none;cursor:pointer;border:1px solid var(--border);border-radius:var(--radio-pill);padding:9px 14px;font-size:13.5px;font-weight:600}
.cab-menu summary::-webkit-details-marker{display:none}
.cab-menu-lista{position:absolute;right:0;top:calc(100% + 8px);background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:8px;min-width:220px;box-shadow:0 16px 40px rgba(20,40,50,.16);display:flex;flex-direction:column;gap:2px;z-index:50}
.cab-menu-lista a,.cab-menu-lista button{padding:10px 12px;border-radius:calc(var(--radio) - 4px);font-size:14px;text-align:left}
.cab-menu-lista a:hover{background:var(--secondary)}
/* Iconos de la cabecera: trazo que sigue el color del texto, tamaño fijo. */
.cab-ico{width:16px;height:16px;flex:0 0 auto}
/* BOTÓN TIENDA: destacado en rosa pastel, el único elemento de la cabecera con relleno de color,
   para que se encuentre sin buscarlo. Sigue visible en móvil (está fuera de .cab-nav/.cab-cuenta). */
.cab-tienda{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;border-radius:var(--radio-pill);padding:10px 17px;font-size:13.5px;font-weight:700;color:var(--fucsia-tinta);background:var(--fucsia-soft);border:1px solid color-mix(in srgb, var(--hestiat-primary) 55%, white);box-shadow:0 6px 16px rgba(142,46,73,.16);white-space:nowrap;transition:transform .16s ease, background .16s ease, box-shadow .16s ease}
.cab-tienda:hover{transform:translateY(-1px);background:color-mix(in srgb, var(--hestiat-primary) 30%, white);box-shadow:0 10px 24px rgba(142,46,73,.24)}
.cab-tienda:active{transform:translateY(0) scale(.985)}
.cab-tienda .cab-ico{width:17px;height:17px}
.cab-menu-tienda{color:var(--fucsia-tinta)!important;font-weight:700;background:var(--fucsia-soft)}
/* En pantallas estrechas la TIENDA se reduce al icono para no competir con el buscador. */
@media(max-width:560px){.cab-tienda-txt{display:none}.cab-tienda{padding:9px 11px}}
/* BUSCADOR DE LA CABECERA: una sola píldora con el destino y la lupa DENTRO del mismo bloque.
   No hay fechas ni viajeros aquí: es una búsqueda de descubrimiento, no un formulario de reserva.
   El rosa pastel de Hestiat es el color de la acción, el mismo de los botones de la ficha. */
.bcab{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:var(--radio-pill);padding:4px 4px 4px 16px;margin:0;box-shadow:none}
.bcab-caja{position:relative;flex:1 1 auto;min-width:0}
.bcab input{width:100%;min-width:0;border:0;background:transparent;padding:10px 2px;font:inherit;font-size:14.5px;font-weight:600;color:var(--ink)}
.bcab input:focus{outline:none}
.bcab input::placeholder{color:var(--muted-fg);font-weight:500}
.bcab input::-webkit-search-cancel-button{display:none}
.bcab-btn{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:50%;background:var(--hestiat-primary);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;transition:background .16s ease}
.bcab-btn:hover{background:var(--hestiat-primary-hover)}
/* === PORTADA ===================================================================================
   Contenido encima del fondo visual desde el primer momento. El vídeo es un fondo de una pantalla,
   no una intro: no bloquea el scroll ni los clics. */
.hero2{position:relative;min-height:min(72vh,640px);display:flex;align-items:flex-end;overflow:hidden;margin-bottom:10px}
.hero2-fondo{position:absolute;inset:0;background-size:cover;background-position:center;background-color:#20343c}
.hero2-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.hero2-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s ease}
.hero2-video-visible{opacity:1}
.hero2-velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,26,32,.10) 0%,rgba(12,26,32,.28) 45%,rgba(12,26,32,.74) 100%)}
.hero2-cont{position:relative;width:100%;max-width:var(--contenedor);margin:0 auto;padding:0 18px 26px}
.hero2-eyebrow{color:#fff;opacity:.92;font-weight:700;letter-spacing:.16em;font-size:11px;text-transform:uppercase;margin-bottom:10px}
.hero2 h1{color:#fff;font-size:clamp(30px,4.6vw,58px);line-height:1.05;max-width:18ch}
.hero2-sub{display:block;font-size:clamp(15px,1.5vw,21px);font-weight:500;color:rgba(255,255,255,.92);margin-top:10px;letter-spacing:-.01em}
.hero2-accesos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:22px;max-width:900px}
.acceso{display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.94);border-radius:var(--radio);padding:13px 15px;backdrop-filter:blur(6px);transition:transform .18s ease, box-shadow .18s ease}
.acceso:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(10,25,32,.22)}
.acceso-icono{font-size:22px}
.acceso b{display:block;font-family:var(--fuente-titulo);font-size:15px;color:var(--ink)}
.acceso span span{font-size:12.5px;color:var(--muted-fg)}
.hero2-credito{position:absolute;right:16px;bottom:8px;color:rgba(255,255,255,.6);font-size:10.5px}
/* Buscador principal sobre el hero (reutiliza el buscador real de Explorar). */
.hero2-busca{margin-top:20px;max-width:940px}
.hero2-busca .buscador{box-shadow:0 18px 50px rgba(10,25,32,.30);margin-bottom:0}
/* Iconos SVG de los accesos del hero, en el acento rosa. */
.acceso-icono{display:inline-flex;align-items:center;justify-content:center;color:var(--hestiat-primary-texto);flex:0 0 auto}
.acceso-icono svg{width:24px;height:24px}
.inicio{padding-bottom:40px}
.seccion-home{margin:46px 0}
.seccion-home-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
.seccion-home h2{font-size:clamp(20px,2.1vw,27px)}
.seccion-home-sub{color:var(--muted-fg);font-size:13.5px;margin-top:4px}
.ver-todos{color:var(--hestiat-primary-texto);font-weight:700;font-size:14px;white-space:nowrap;transition:opacity .16s ease}
.ver-todos:hover{opacity:.78}
.car{position:relative}
.car-pista{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 10px;scrollbar-width:thin}
.car-pista>*{scroll-snap-align:start;flex:0 0 auto}
.car-flecha{position:absolute;top:36%;width:38px;height:38px;border-radius:50%;border:1px solid var(--border);background:var(--card);color:var(--ink);font-size:16px;cursor:pointer;z-index:5;box-shadow:0 6px 18px rgba(20,40,50,.14);transition:transform .16s ease, opacity .16s ease}
.car-flecha:hover:not(:disabled){transform:scale(1.06)}
.car-flecha:disabled{opacity:.28;cursor:default}
.car-atras{left:-6px}
.car-alante{right:-6px}
.tdest{position:relative;width:100%;border-radius:var(--radio);overflow:hidden;background:var(--surface-strong);color:#fff;transition:transform .18s ease, box-shadow .18s ease}
.tdest{flex:0 0 calc((100% - 112px) / 8);min-width:186px;aspect-ratio:3/4}
.tdest:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(20,40,50,.16)}
.tdest-media{position:absolute;inset:0}
.tdest-media img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.tdest:hover .tdest-media img{transform:scale(1.03)}
.tdest-velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,20,26,0) 38%,rgba(10,20,26,.78) 100%)}
.tdest-sinfoto{position:absolute;inset:0;background:linear-gradient(135deg,#33454c,#1f2f36)}
.tdest-txt{position:absolute;left:12px;right:12px;bottom:11px;display:flex;flex-direction:column;gap:2px}
.tdest-txt b{font-family:var(--fuente-titulo);font-size:16px;color:#fff}
.tdest-txt span{font-size:12px;color:rgba(255,255,255,.86)}
.tcat{display:block;border-radius:var(--radio);overflow:hidden;background:var(--card);border:1px solid var(--border);transition:transform .18s ease, box-shadow .18s ease}
.tcat{flex:0 0 calc((100% - 112px) / 8);min-width:196px}
.tcat:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(20,40,50,.14)}
.tcat-media{display:block;aspect-ratio:4/3;background:var(--surface-strong);overflow:hidden}
.tcat-media img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.tcat:hover .tcat-media img{transform:scale(1.04)}
.tcat-sinfoto{display:block;width:100%;height:100%;background:linear-gradient(135deg,var(--surface-strong),var(--secondary))}
.tcat-txt{display:flex;flex-direction:column;gap:2px;padding:11px 12px 13px}
.tcat-txt b{font-family:var(--fuente-titulo);font-size:14.5px;color:var(--ink)}
.tcat-txt span{font-size:12px;color:var(--muted-fg)}
.pie-inicio{margin-top:30px}
/* Ficha de experiencia: mismo lenguaje visual que la de alojamiento, con piezas propias. */
.exp-portada{position:relative;border-radius:var(--radio);overflow:hidden;background:var(--surface-strong);aspect-ratio:21/9;margin-bottom:18px}
.exp-portada img{width:100%;height:100%;object-fit:cover}
.exp-portada-vacia{display:block;width:100%;height:100%;background:linear-gradient(135deg,var(--surface-strong),var(--secondary))}
.exp-portada-pie{position:absolute;right:10px;bottom:8px;background:rgba(10,20,26,.62);color:#fff;font-size:11px;padding:3px 9px;border-radius:var(--radio-pill)}
.exp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:28px;align-items:start}
.exp-etiquetas{font-size:13px;font-weight:700;color:var(--hestiat-primary-texto);margin-bottom:8px}
.exp-resumen{font-size:16.5px;line-height:1.6;color:var(--ink)}
.exp-caja{position:sticky;top:88px;background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:16px}
.exp-precio{font-size:15px;margin-bottom:6px}
.exp-precio strong{font-family:var(--fuente-titulo);font-size:22px;color:var(--hestiat-primary-texto)}
@media(max-width:900px){.exp-cols{grid-template-columns:1fr}.exp-caja{position:static}.exp-portada{aspect-ratio:16/9}}
/* «Cerca de ti»: la acción discreta para compartir la ubicación, y el ancho de las tarjetas de
   alojamiento dentro de un carrusel (8 visibles en escritorio, como el resto de filas). */
.cerca-ofrecer{margin:26px 0 0}
.cerca-ofrecer .fechas-disparador{width:auto;display:inline-block;background:var(--hestiat-primary);color:var(--ink);border:0;font-weight:700;font-size:14px;padding:11px 18px}
.cerca-ofrecer .fechas-disparador:hover{background:var(--hestiat-primary-hover);border:0}
.cerca-ofrecer .fechas-disparador:disabled{opacity:.6;cursor:default}
.car .car-pista>.tjg{flex:0 0 calc((100% - 112px) / 8);min-width:186px}
/* Las tarjetas de experiencia usan la misma pieza en rejilla y en carrusel. */
.car .car-pista>.serv-card{flex:0 0 calc((100% - 112px) / 8);min-width:200px}
@media(max-width:760px){.car .car-pista>.tjg{flex:0 0 62%;min-width:0}.car .car-pista>.serv-card{flex:0 0 62%;min-width:0}}
@media(max-width:430px){.car .car-pista>.tjg{flex:0 0 76%}.car .car-pista>.serv-card{flex:0 0 76%}}
/* Rejilla del catálogo de servicios: misma tarjeta que las categorías, pero en rejilla. */
.serv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:16px;margin-top:6px}
.serv-card{border:1px solid var(--border);border-radius:var(--radio);overflow:hidden;background:var(--card);transition:transform .18s ease, box-shadow .18s ease}
.serv-card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(20,40,50,.13)}
.serv-media{position:relative;display:block;aspect-ratio:4/3;background:var(--surface-strong);overflow:hidden}
.serv-enlace{position:absolute;inset:0;z-index:1;border-radius:var(--radio)}
.serv-media img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.serv-card:hover .serv-media img{transform:scale(1.04)}
.serv-txt{display:flex;flex-direction:column;gap:3px;padding:11px 12px 13px}
.serv-txt b{font-family:var(--fuente-titulo);font-size:14.5px;color:var(--ink);line-height:1.25}
.serv-txt .m{font-size:12.5px;color:var(--muted-fg)}
/* Sin opacidad parcial: al 85 % el texto de 11 px caía a 4,04:1 de contraste. Con el
   token a plena intensidad queda en 5,58:1, por encima del mínimo AA de 4,5. */
.serv-fuente{font-size:11px;color:var(--muted-fg);margin-top:2px}
@media(max-width:1280px){.cab-busca{max-width:460px}}
@media(max-width:900px){
  /* Por debajo de 900 px la cabecera ya no tiene sitio para las tres píldoras y la cuenta: pasan al
     desplegable nativo. En tablet (768–900) el menú sigue siendo claro y no se corta nada. */
  .cab-nav{display:none}
  .cab-cuenta{display:none}
  .cab-menu{display:block}
  .cab-busca{max-width:none}
}
@media(max-width:760px){
  .cab-in{min-height:64px;gap:10px;padding:8px 14px}
  .marca{font-size:18px}
  .bcab{padding:3px 3px 3px 13px}
  .bcab input{font-size:14px;padding:9px 2px}
  .bcab-btn{width:34px;height:34px;font-size:14px}
  .hero2{min-height:min(70vh,520px)}
  .hero2-accesos{grid-template-columns:1fr;gap:9px;margin-top:16px}
  .acceso{padding:11px 13px}
  .seccion-home{margin:34px 0}
  .tdest{flex:0 0 62%;min-width:0}
  .tcat{flex:0 0 58%;min-width:0}
  .car-flecha{display:none}
}
@media(prefers-reduced-motion:reduce){
  .acceso,.cab-pill,.tdest,.tcat,.tdest-media img,.tcat-media img,.car-flecha{transition:none}
  .tdest:hover,.tcat:hover,.acceso:hover,.cab-pill:hover{transform:none}
}
/* === MÓVIL Y TABLET: repaso para 320 / 375 / 390 / 414 / 768 ====================================
   El navegador de pruebas no permite emular anchos, así que esto está razonado a mano para cada
   ancho real y con medidas calculadas, no a ojo:
     · 768 (tablet)  → cabecera con el desplegable, búsqueda ancha, héroe de 70vh.
     · 414 / 390 / 375 → el buscador ocupa su propia fila, con destino + botón; las fechas y los
                         viajeros se eligen en la barra completa de Explorar, para que la cabecera
                         no se coma la pantalla.
     · 320 → el mismo esquema, con tarjetas al 76 % y tipografías mínimas legibles.
   Nada se sale del ancho: los carruseles son los únicos que se desplazan en horizontal, y lo hacen
   dentro de su caja (overflow-x propio), no en la página. */
@media(max-width:430px){
  /* Selectores con un poco más de peso que los de 760 px, a propósito: así estas medidas mandan sin
     tener que reordenar la hoja entera (que es donde se rompen las cosas sin que se note). */
  /* UNA SOLA LÍNEA: logo + buscador compacto + menú. Nada de segunda fila. */
  .cab .cab-in{min-height:56px;flex-wrap:nowrap;gap:8px;padding:6px 10px}
  .cab .marca{font-size:16px}
  .marca-casa{font-size:15px}
  .cab-menu{margin-left:auto}
  .cab-menu summary{padding:8px 12px;font-size:13px}
  /* El buscador comparte la línea con el logo y el menú: píldora compacta, lupa dentro y nada más.
     Las fechas y los viajeros viven donde tienen sentido (Explorar alojamientos y la ficha), y ahí
     siguen igual. Aquí no hay ni calendario ni contador. */
  .cab-busca{flex:1 1 auto;min-width:0;order:0;max-width:none}
  .bcab{padding:2px 2px 2px 12px}
  .bcab input{font-size:13.5px;padding:8px 2px}
  .bcab-btn{width:32px;height:32px;font-size:13px}
  .hero2{min-height:min(64vh,460px)}
  .hero2-cont{padding:0 14px 20px}
  .hero2 h1{font-size:clamp(26px,7.4vw,34px)}
  .hero2-sub{font-size:14.5px;margin-top:8px}
  .hero2-accesos{gap:8px;margin-top:14px}
  .acceso{padding:10px 12px;gap:9px}
  .acceso-icono{font-size:19px}
  .acceso b{font-size:14px}
  .acceso span span{font-size:12px}
  .seccion-home{margin:28px 0}
  .seccion-home-cab{flex-wrap:wrap;gap:6px;align-items:flex-start}
  .seccion-home h2{font-size:21px}
  .seccion-home-sub{font-size:12.5px}
  .ver-todos{font-size:13.5px}
  .car .car-pista{gap:12px;padding:2px 2px 8px}
  .car .car-pista>.tdest{flex:0 0 76%}
  .car .car-pista>.tcat{flex:0 0 72%}
  .pie-inicio{font-size:12.5px}
  .cab-menu-lista{min-width:200px;max-width:calc(100vw - 24px)}
}
@media(max-width:360px){
  .cab .marca{font-size:16px}
  .bcab input{font-size:13px;padding:7px 2px}
  .bcab-btn{width:30px;height:30px}
  .hero2 h1{font-size:25px}
  .car .car-pista>.tdest{flex:0 0 82%}
  .car .car-pista>.tcat{flex:0 0 78%}
  .seccion-home h2{font-size:19.5px}
}
@media(max-width:1000px){.buscador{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:760px){
  .buscador{grid-template-columns:1fr 1fr;gap:8px;padding:10px;border-radius:var(--radio)}
  .buscador-destino{grid-column:1/-1}
  .buscador-boton{grid-column:1/-1;width:100%}
  .buscador-etq{font-size:11.5px}
  .sugerencias{max-height:250px}
}
.galeria-cuenta{color:var(--muted-fg);font-size:13.5px;margin:4px 0 14px}
/* Columnas derivadas del ancho REAL disponible, no de tramos fijos: la cuadrícula llena siempre el
   contenedor y no deja huecos, y las filas del scroll infinito salen con esta misma regla, así que
   no cambia de aspecto a mitad de página. A 1760 → 7 columnas (tarjetas de ~231 px, el tamaño ya
   probado); a 1520 → 6; a 1200 → 5; a 900 → 3; a 600 → 2. */
.galeria{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));align-items:start}
@media(max-width:820px){.galeria{gap:16px}}
@media(max-width:600px){.galeria{grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:14px}}
@media(max-width:430px){.galeria{grid-template-columns:1fr}}
/* tarjeta: la fotografía manda, la información es mínima */
.tjg{position:relative;display:flex;flex-direction:column}
.tjg-foto{position:relative;aspect-ratio:4/3;border-radius:var(--radio);overflow:hidden;background:var(--surface-strong);box-shadow:0 4px 14px rgba(20,40,50,.10);transition:box-shadow .22s ease,transform .22s ease}
.tjg-foto img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}
.tjg:hover .tjg-foto{box-shadow:0 10px 26px rgba(20,40,50,.16);transform:translateY(-3px)}
.tjg:hover .tjg-foto img{transform:scale(1.04)}
.tjg-sinfoto{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--muted-fg);font-size:12.5px;background:var(--surface-strong)}
.tjg-info{padding:9px 2px 0}
/* Nombre recortado a dos líneas con altura reservada: una tarjeta no puede ser el doble de alta
   por culpa de un nombre largo. */
.tjg-nombre{font-family:var(--fuente-titulo);font-weight:700;font-size:14.5px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em}
.tjg-lugar{color:var(--muted-fg);font-size:12.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tjg-estrella{font-size:12.5px;margin-top:2px;color:var(--ink)}
.tjg-resenas{color:var(--muted-fg)}
.tjg-precio{margin-top:3px;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
.tjg-sufijo{color:var(--muted-fg);font-weight:400;font-size:12.5px}
.tjg-badge{position:absolute;left:8px;top:8px;z-index:2;background:rgba(255,255,255,.92);color:var(--ink);font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:var(--radio-pill)}
/* Toda la tarjeta es clicable: enlace estirado por debajo del corazón. */
.tjg-enlace{position:absolute;inset:0;z-index:1;border-radius:var(--radio)}
.tjg-enlace:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.corazon{position:absolute;right:8px;top:8px;z-index:3;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:0;border-radius:var(--radio-pill);background:rgba(20,30,35,.42);color:#fff;font-size:17px;line-height:1;cursor:pointer;text-decoration:none}
.corazon:hover{background:rgba(20,30,35,.66)}
.corazon-ok{color:#ff6b81}
.corazon:disabled{opacity:.6;cursor:default}
.galeria-pie{padding:26px 0 8px;text-align:center;min-height:40px}
.cargando-mas{color:var(--muted-fg);font-size:13.5px}
/* ---------- portada cinematográfica: el scroll manda sobre el vídeo ---------- */
.hero-cine{position:relative;height:220vh;background:var(--ink)}
.hero-cine-quieto{height:auto;min-height:560px}
.hero-cine-fijo{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:flex-end}
.hero-cine-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity .7s ease}
.hero-cine-video-listo{opacity:1}
/* El velo se aclara según avanza el scroll: cuando el texto ya se ha ido no tiene que tapar la
   película, y sin esto el final del recorrido se veía como un bloque negro. */
.hero-cine-velo{position:absolute;inset:0;opacity:calc(1 - var(--cine-progreso,0) * .78);background:linear-gradient(180deg,rgba(8,22,28,.30) 0%,rgba(8,22,28,.55) 45%,rgba(8,22,28,.88) 100%),radial-gradient(130% 95% at 18% 100%,rgba(8,22,28,.80) 0%,rgba(8,22,28,.42) 48%,rgba(8,22,28,.10) 78%)}
/* El titular va sobre imagen en movimiento: sin sombra, un fotograma claro se lo come. */
.hero-cine-contenido h1{color:#fff;font-size:38px;max-width:22ch;margin-bottom:10px;text-shadow:0 2px 20px rgba(4,14,18,.75),0 1px 3px rgba(4,14,18,.55)}
.hero-cine-contenido .sub{color:rgba(255,255,255,.96);max-width:54ch;margin-bottom:18px;font-size:14.5px;text-shadow:0 1px 12px rgba(4,14,18,.75)}
/* El texto se retira pronto y con él sus clics, para que no estorbe a la película. */
.hero-cine-contenido{position:relative;width:100%;max-width:var(--contenedor);margin:0 auto;padding:28px 18px 46px;opacity:calc(1 - var(--cine-progreso,0) * 2.7);transform:translateY(calc(var(--cine-progreso,0) * -24px));pointer-events:var(--cine-clics,auto)}
.hero-cine-contenido .eyebrow{color:var(--accent);font-weight:700;letter-spacing:.14em;font-size:11.5px;text-transform:uppercase;margin-bottom:8px}
.hero-cine-credito{position:absolute;right:14px;bottom:10px;color:rgba(255,255,255,.72);font-size:11.5px;text-shadow:0 1px 8px rgba(4,14,18,.7)}
.hero-cine-pista{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);color:rgba(255,255,255,.75);font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;opacity:calc(1 - var(--cine-progreso,0) * 4)}
@media(max-width:760px){
  .hero-cine{height:200vh}
  .hero-cine-contenido h1{font-size:29px}
  .hero-cine-credito{right:10px;bottom:auto;top:10px}
}
@media(prefers-reduced-motion:reduce){.hero-cine{height:auto}}
/* ---------- ficha divertida: iconos ilustrativos y acento fucsia ---------- */
/* Los tres tokens conservan su nombre por compatibilidad con las reglas que ya los usan, pero su
   valor cambia aquí y con él cambia la interfaz entera (botones, enlaces, destacados, cabecera y
   pie) sin tocar ni una regla.
   DECISIÓN DEL PROPIETARIO (nov-2026): NUEVA IDENTIDAD. El acento pasa de turquesa a ROSA PASTEL.
   El relleno pastel #EE8CA6 mantiene un contraste alto con la tinta marina del texto de los botones
   (relación ~6.7:1, por encima del 4.5:1 que exige la norma de accesibilidad), así que no se pierde
   legibilidad al cambiar de color. */
:root{--fucsia:#EE8CA6; --fucsia-soft:#FBE7EE; --fucsia-tinta:#8E2E49}
/* Color primario oficial de acción, tomado de la ficha (ver la explicación junto a .f-aplicar).
   --hestiat-primary        relleno de los botones principales: el pastel que se ve en la ficha.
   --hestiat-primary-hover  el mismo tono un poco más profundo, solo al pasar el ratón.
   --hestiat-primary-texto  el mismo tono oscuro, para enlaces y estados activos (contraste). */
/* NUEVA IDENTIDAD (nov-2026): el acento pasa a ROSA PASTEL. El relleno pastel #EE8CA6 mantiene la
   tinta marina del texto de los botones por encima del mínimo de accesibilidad (relación ~6.7:1,
   sobre el 4.5:1 exigido); el tono de texto #8E2E49 (rosa oscuro) se usa en enlaces y estados
   activos sobre fondo claro (~6.4:1). */
:root{--hestiat-primary:#EE8CA6; --hestiat-primary-hover:#E67792; --hestiat-primary-texto:#8E2E49}
/* Identidad de marca tomada del logo del canal: emblema circular con casa y corazón.
   Se AÑADEN; los tokens de acción de arriba se conservan tal cual para no alterar ningún flujo. */
:root{--marca-oro-texto:#8A6A1E; --marca-marino:#0A1435; --marca-oro:#C8A858; --marca-oro-claro:#F2E3B4; --marca-oro-oscuro:#6E5220;
      --marca-arena:#D0B890; --marca-crema:#F7EFD8}
/* Los accesorios se ven antes de leerse: cada uno con su icono, que viene del diccionario de
   servicios (su campo de icono), no de una lista metida en el código. */
.servicio-icono{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radio-pill);background:var(--fucsia-soft);font-size:17px;flex:0 0 auto;color:var(--fucsia-tinta)}
.servicio-icono svg,.hecho-icono svg{width:18px;height:18px}
/* Selector con .ficha delante a propósito: las reglas de la ficha vienen después en la hoja y, con
   la misma especificidad, ganarían ellas. */
.ficha .servicios-grid li{display:flex;align-items:center;gap:10px;border-radius:var(--radio-pill);padding:8px 15px 8px 9px;background:var(--card)}
.hecho-icono{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radio-pill);background:var(--fucsia-soft);font-size:15px;flex:0 0 auto}
.ficha .ficha-hechos li{display:flex;align-items:center;gap:8px}
.regla-icono{display:inline-block;width:20px;text-align:center}
/* El botón de reservar es la acción de la ficha: va en fucsia, que es lo único de la página con
   ese color, y por eso se encuentra sin buscarlo. */
.rc-boton,.barra-movil .f-aplicar,.accion-reservar{background:var(--hestiat-primary)!important;color:var(--ink)!important}
.rc-boton:hover,.accion-reservar:hover{background:var(--hestiat-primary-hover)!important}
.reserva-caja .rc-precio strong{color:var(--hestiat-primary-texto)}
.corazon-ok{color:var(--hestiat-primary)}
/* ---------- ficha de alojamiento ---------- */
.migas{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--muted-fg);padding:16px 0 12px;flex-wrap:wrap}
.migas a{text-decoration:underline}
.ficha{padding-bottom:26px}
.meta{color:var(--muted-fg);font-size:13.5px}
.m{color:var(--muted-fg)}
.ficha-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,380px);gap:34px;align-items:start;margin-top:22px}
.ficha-principal{min-width:0}
.ficha-principal h1{font-size:27px;margin-bottom:3px}
.ficha-seccion{margin-top:30px;border-top:1px solid var(--border);padding-top:20px}
.ficha-seccion h2{font-size:19px;margin-bottom:9px}
.ficha-texto{font-size:14.6px;color:var(--foreground);max-width:76ch}
.ficha-resumen{cursor:pointer;color:var(--primary);font-weight:600;font-size:13.5px;margin-bottom:8px}
.ficha-hechos{list-style:none;display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.ficha-hechos li{border:1px solid var(--border);border-radius:var(--radio-pill);padding:7px 13px;font-size:13.5px;background:var(--card)}
.servicios-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:9px;margin-top:10px}
.servicios-grid li{border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13.6px;background:var(--card)}
.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--border);border-radius:var(--radio-pill);padding:6px 12px;font-size:13px;background:var(--card)}
.resenas{list-style:none;display:grid;gap:14px;margin-top:10px}
.resenas li{border:1px solid var(--border);border-radius:var(--radio);padding:13px 15px;background:var(--card)}
.resena-cab{font-size:13.5px;margin-bottom:5px}
.tarjeta-enlace{position:relative;display:block;padding:0;overflow:hidden;transition:box-shadow .18s ease,transform .18s ease}
.tarjeta-enlace:hover{box-shadow:0 12px 28px rgba(20,40,50,.12);transform:translateY(-2px)}
.tarjeta-foto{display:block;width:100%;height:150px;object-fit:cover;background:var(--surface-strong)}
.tarjeta-sinfoto{display:block;height:150px;background:var(--surface-strong)}
.tarjeta-titulo{font-family:var(--fuente-titulo);font-weight:700;font-size:15px;padding:11px 13px 2px;line-height:1.25}
.tarjeta-enlace .m{padding:0 13px 12px}
/* galeria */
.galeria-escritorio{display:grid;gap:8px;position:relative;border-radius:var(--radio);overflow:hidden}
/* La parrilla se ajusta al número REAL de fotos. Con una fija de cinco huecos, una ficha de dos
   fotos dejaba tres huecos vacíos enormes y parecía rota. */
.gal-n1{grid-template-columns:1fr;grid-template-rows:330px}
.gal-n2{grid-template-columns:1fr 1fr;grid-template-rows:300px}
.gal-n3{grid-template-columns:1fr 1fr 1fr;grid-template-rows:260px}
.gal-n4{grid-template-columns:1fr 1fr;grid-template-rows:200px 200px}
.gal-n5{grid-template-columns:2fr 1fr 1fr;grid-template-rows:150px 150px}
.gal-n5 .gal-principal{grid-row:1/3;grid-column:1/2}
.galeria-escritorio button{border:0;padding:0;background:var(--surface-strong);cursor:pointer;overflow:hidden;position:relative}
.galeria-escritorio img{width:100%;height:100%;object-fit:cover;transition:transform .25s ease}
.galeria-escritorio button:hover img{transform:scale(1.03)}
.gal-etiqueta{position:absolute;left:8px;bottom:8px;background:rgba(15,25,30,.72);color:#fff;font-size:10.5px;padding:3px 8px;border-radius:var(--radio-pill);letter-spacing:.02em}
.gal-ver-todas{position:absolute;right:12px;bottom:12px;background:var(--card)!important;border:1px solid var(--border)!important;border-radius:var(--radio-pill)!important;padding:9px 15px!important;font:inherit;font-weight:600;font-size:13px;box-shadow:0 4px 14px rgba(20,40,50,.16)}
.galeria-movil{display:none}
/* lightbox */
.lightbox{position:fixed;inset:0;background:rgba(10,18,22,.94);z-index:90;display:flex;align-items:center;justify-content:center;padding:22px}
.lightbox figure{max-width:min(1100px,92vw);max-height:88vh;display:flex;flex-direction:column;gap:10px}
.lightbox img{max-width:100%;max-height:80vh;object-fit:contain;border-radius:10px;margin:0 auto}
.lightbox figcaption{color:rgba(255,255,255,.82);font-size:13px;text-align:center}
.lb-cerrar{position:absolute;top:16px;right:20px;background:transparent;border:0;color:#fff;font-size:34px;line-height:1;cursor:pointer}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#fff;width:46px;height:46px;border-radius:var(--radio-pill);font-size:26px;line-height:1;cursor:pointer}
.lb-prev{left:18px}.lb-next{right:18px}
/* caja de reserva */
.reserva-caja{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:18px;position:sticky;top:78px;box-shadow:0 14px 34px rgba(20,40,50,.09)}
.rc-precio{font-size:18px;margin-bottom:2px}
.rc-noche{color:var(--muted-fg);font-weight:400;font-size:13.5px}
.rc-fechas{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--card);padding:0;font:inherit;text-align:left;width:100%;cursor:pointer}
.rc-fechas:hover{border-color:var(--primary)}
.rc-campo{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border:1px solid var(--border);border-radius:10px}
.rc-fechas .rc-campo{border:0;border-radius:0}
.rc-fechas .rc-campo:first-child{border-right:1px solid var(--border)}
.rc-campo .etq{font-size:10.5px;font-weight:700;letter-spacing:.06em;color:var(--muted-fg);text-transform:uppercase}
.rc-valor{font-size:14.5px;font-variant-numeric:tabular-nums;color:var(--ink)}
.rc-activo{outline:2px solid var(--primary);outline-offset:-2px}
.rc-paso{width:32px;height:32px;border-radius:var(--radio-pill);border:1px solid var(--border);background:var(--background);font:inherit;font-size:16px;line-height:1;cursor:pointer;color:var(--ink)}
.rc-calendario{margin-top:12px;border-top:1px solid var(--border);padding-top:10px}
.mes-nav{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}
.meses{display:grid;grid-template-columns:1fr;gap:14px}
.mes-titulo{font-size:13.5px;font-weight:700;text-align:center;margin-bottom:6px;font-family:var(--fuente-titulo)}
.mes-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.mes-dia-semana{font-size:10.5px;color:var(--muted-fg);text-align:center;font-weight:700}
.mes-dia{border:0;background:transparent;font:inherit;font-size:12.5px;padding:7px 0;border-radius:8px;cursor:pointer;color:var(--ink);font-variant-numeric:tabular-nums}
.mes-dia:hover:not(:disabled){background:var(--primary-soft)}
.mes-ocupado,.mes-pasado{color:var(--muted-fg);text-decoration:line-through;cursor:not-allowed;opacity:.55}
.mes-elegido{background:var(--primary)!important;color:var(--primary-fg)!important;font-weight:700}
.mes-en-rango{background:var(--primary-soft)}
.rc-desglose{border-top:1px solid var(--border);margin-top:12px;padding-top:10px;font-size:13.6px;font-variant-numeric:tabular-nums}
.rc-desglose p{display:flex;justify-content:space-between;gap:10px;color:var(--muted-fg);margin-bottom:4px}
.rc-total{color:var(--ink)!important;font-weight:700;border-top:1px solid var(--border);padding-top:7px;margin-top:7px!important}
.rc-boton{display:block;width:100%;margin-top:12px;padding:14px 22px;text-align:center;text-decoration:none}
.rc-boton:disabled{opacity:.5;cursor:not-allowed}
.barra-movil{display:none}
/* disponibilidad */
.tira-dias{display:flex;flex-wrap:wrap;gap:3px;margin:10px 0 8px}
.dia{width:14px;height:22px;border-radius:3px;display:inline-block}
.dia-libre-num{border-radius:8px;padding:7px 0;text-align:center;font-size:12.5px;color:var(--ink);background:var(--primary-soft)}
.dia-ocupado-num{border-radius:8px;padding:7px 0;text-align:center;font-size:12.5px;color:var(--muted-fg);background:var(--surface-strong);text-decoration:line-through}
.dispo-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;max-width:600px;margin-top:12px}
.leyenda{display:flex;gap:18px;align-items:center;font-size:12.5px;color:var(--muted-fg);margin-top:10px}
.leyenda span{display:inline-flex;align-items:center;gap:6px}
.leyenda i{width:13px;height:13px;border-radius:4px;display:inline-block}
/* Arriba a la izquierda y no abajo: abajo tapaba el precio de la tarjeta y se leía «Referencia € /
   noche», un fallo detectado al mirar la página, no en el código. */
.img-ref{position:absolute;left:8px;top:8px;background:rgba(15,25,30,.72);color:#fff;font-size:10.5px;padding:2px 7px;border-radius:var(--radio-pill)}
.mapa-ficha{height:330px;border-radius:var(--radio);border:1px solid var(--border);margin-top:10px;z-index:0}
/* anfitrion */
.anfitrion{display:flex;gap:14px;align-items:flex-start}
.anfitrion-foto{width:60px;height:60px;border-radius:var(--radio-pill);object-fit:cover}
.anfitrion-inicial{width:60px;height:60px;border-radius:var(--radio-pill);background:var(--primary);color:var(--primary-fg);display:flex;align-items:center;justify-content:center;font-family:var(--fuente-titulo);font-size:23px;font-weight:700;flex:0 0 auto}
.anfitrion-nombre{font-family:var(--fuente-titulo);font-weight:700;font-size:16.5px}
.anfitrion-cabecera{display:flex;gap:18px;align-items:flex-start;margin-bottom:24px}
.anfitrion-cabecera h1{font-size:26px;margin-bottom:3px}
.anfitrion-foto-grande,.anfitrion-inicial-grande{width:88px;height:88px;font-size:33px}
@media(max-width:1060px){
  .ficha-cols{grid-template-columns:minmax(0,1fr) minmax(300px,330px);gap:22px}
  .mes-segundo{display:none}
}
@media(max-width:860px){.admin{grid-template-columns:1fr}.admin-nav{position:static}.fila-2{grid-template-columns:1fr}}
@media(max-width:760px){
  /* En móvil la caja de reserva sube justo debajo de la galería: fechas, huéspedes y precio a la
     vista cuanto antes, y la barra inferior no tapa el final del contenido. */
  .ficha-cols{display:flex;flex-direction:column;gap:22px}
  .reserva-caja{order:-1;position:static;box-shadow:none}
  .galeria-escritorio{display:none}
  .galeria-movil{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;position:relative}
  .gal-movil-item{flex:0 0 88%;scroll-snap-align:center;border:0;padding:0;background:var(--surface-strong);border-radius:var(--radio);overflow:hidden;position:relative}
  .gal-movil-item img{width:100%;height:230px;object-fit:cover}
  .gal-contador{position:sticky;left:12px;align-self:flex-start;background:rgba(15,25,30,.72);color:#fff;font-size:11.5px;padding:3px 9px;border-radius:var(--radio-pill);height:fit-content}
  .barra-movil{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--card);border-top:1px solid var(--border);padding:10px 14px;padding-bottom:calc(10px + env(safe-area-inset-bottom));align-items:center;gap:12px}
  .bm-precio{font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}
  .barra-movil .f-aplicar{margin-left:auto;text-decoration:none;white-space:nowrap}
  .ficha{padding-bottom:104px}
  .ficha-principal h1{font-size:23px}
  .servicios-grid{grid-template-columns:1fr}
  .lightbox{padding:0}
  .lb-nav{width:40px;height:40px;font-size:22px}
  .hero{min-height:340px}.hero h1{font-size:30px}
  .buscador{flex-direction:column;align-items:stretch;border-radius:var(--radio)}
  .buscador .sep{display:none}
  .buscador .campo{border-bottom:1px solid var(--border)}
  .buscador button{margin:6px}
  .estilo{flex:0 0 210px;height:150px}
  .busqueda{grid-template-columns:1fr}
  .mapa-lado{position:static}
  .filtros{grid-template-columns:1fr 1fr}
}
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // La cabecera refleja la sesión real. Antes había un botón «Publica tu espacio» que no hacía
  // absolutamente nada, y ningún acceso a la cuenta.
  const sesion = await getCurrentUser();
  const esAnfitrion = sesion?.rol === "anfitrion" || sesion?.rol === "admin";
  return (
    <html lang="es" className={`${manrope.variable} ${dmSans.variable}`}>
      <head>
        {process.env.GOOGLE_SITE_VERIFICATION ? (
          <meta name="google-site-verification" content={process.env.GOOGLE_SITE_VERIFICATION} />
        ) : null}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A1435" />
        <style dangerouslySetInnerHTML={{ __html: estilos }} />
      </head>
      <body>
        {/* GOOGLE ADSENSE — CARGADOR DE LA LIBRERÍA, EN EL BODY.
            Es la primera mitad del bloque que entrega Google para un anuncio:

              <script async src="…/adsbygoogle.js?client=ca-pub-8207026302114375" crossorigin="anonymous"></script>
              <ins class="adsbygoogle" data-ad-client="…" data-ad-slot="…" data-ad-format="auto" data-full-width-responsive="true"></ins>
              <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>

            Aquí vive solo esa primera línea, una vez por página, para no repetir la misma descarga en
            cada uno de los ocho bloques. La segunda mitad —el <ins> y el push— la pone
            components/espacio-publicidad.tsx en su sitio, y el push se hace desde JavaScript porque
            los bloques aparecen al aceptar el consentimiento, y un <script> insertado por React
            después de cargar la página no se ejecuta.

            Va renderizado por el servidor, así que el navegador lo descarga en cuanto empieza a leer
            el documento: `async` evita que frene el primer pintado.

            El identificador de editor es público (viaja en la propia dirección del script).
            PENDIENTE DEL PROPIETARIO: este script deja cookies de Google en todas las visitas; en
            España eso exige consentimiento previo, así que hay que publicar el mensaje de
            consentimiento (CMP) en el panel de AdSense, en «Privacidad y mensajería». */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8207026302114375" crossorigin="anonymous"></script>',
          }}
        />
        <header className="cab">
          <div className="wrap cab-in">
            {/* EL LOGOTIPO DE LA MARCA. El archivo trae la palabra convertida a trazados, así que no
                depende de ninguna fuente instalada. Se le da el alto con clamp() para que se adapte solo
                al ancho de pantalla, sin depender de que ninguna regla de móvil lo recoja. El texto
                alternativo nombra el enlace: no hace falta un aria-label aparte. */}
            <a href="/" className="marca">
              {/* EL LOGOTIPO CAMBIA SOLO CON EL TEMA. Con <picture> y prefers-color-scheme no hace
                  falta JavaScript ni un conmutador: el navegador elige el archivo según el tema del
                  sistema. En tema oscuro se usa la versión con placa marino, porque la palabra en
                  crema necesita fondo oscuro para leerse: sobre una cabecera clara quedaría invisible. */}
              {/* UN SOLO ARCHIVO, TAMBIÉN EN MODO OSCURO. La cabecera es blanca siempre, así que
                  la palabra va en azul marino siempre. Antes había una variante de tema oscuro con la
                  palabra en crema: si el móvil estaba en modo oscuro, el navegador servía letras crema
                  sobre la cabecera blanca y el nombre era ilegible. Se ha retirado esa variante. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca/logotipo-web.svg" alt="Hestiat" className="marca-logo" width="80" height="30" />
            </a>

            {/* LA BÚSQUEDA GENERAL VIVE AQUÍ: un destino y la lupa, en el mismo bloque. Está en todas
                las páginas, no empuja el contenido hacia abajo y NO es un formulario de reserva: sin
                fechas y sin viajeros. Lo escrito se manda a /buscar, que decide qué es (ciudad,
                provincia, zona, alojamiento, experiencia o servicio) y lleva a la página que toca. */}
            <div className="cab-busca">
              <BuscadorCabecera />
            </div>

            <nav className="cab-nav" aria-label="Secciones de Hestiat">
              <a className="cab-pill cab-pill-on" href="/search">
                <svg className="cab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.4V21h14V9.4" /><path d="M9.5 21v-6h5v6" /></svg>
                Alojamientos
              </a>
              <a className="cab-pill" href="/experiencias">
                <svg className="cab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15.2 8.8-2 5.4-5.4 2 2-5.4z" /></svg>
                Experiencias
              </a>
              <a className="cab-pill" href="/servicios">
                <svg className="cab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18h16" /><path d="M6 18a6 6 0 0 1 12 0" /><path d="M12 6.2V4.2" /><circle cx="12" cy="3.6" r="1" /></svg>
                Servicios
              </a>
            </nav>

            <nav className="cab-cuenta">
              {esAnfitrion && (
                <a href="/host" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
                  Mi panel
                </a>
              )}
              {sesion ? (
                <>
                  <a href="/favoritos" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
                    Favoritos
                  </a>
                  <a href="/perfil" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
                    Mi perfil
                  </a>
                  <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
                    <button className="cab-btn" type="submit">
                      Salir
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/login" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
                    Entrar
                  </a>
                  <a href={sesion ? "/anfitrion" : "/registro"} className="cab-btn">
                    Publica tu espacio
                  </a>
                </>
              )}
            </nav>

            {/* LA TIENDA. Botón destacado en rosa pastel que lleva a la tienda de Hestiat
                (Shopify, en su propio subdominio). Vive FUERA de .cab-nav/.cab-cuenta para seguir
                visible en móvil, donde esas dos zonas se ocultan. Abre en pestaña nueva porque es
                otro sitio; no se toca nada de shop.hestiat.com desde aquí. */}
            <a
              className="cab-tienda"
              href="https://shop.hestiat.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Tienda Hestiat (se abre en una pestaña nueva)"
            >
              <svg className="cab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8h12l-1 11.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
              <span className="cab-tienda-txt">Tienda</span>
            </a>

            {/* En móvil, las secciones y la cuenta caben en este desplegable nativo: sin
                JavaScript, sin tapar la pantalla y sin menús que no llevan a ningún sitio. */}
            <details className="cab-menu">
              <summary aria-label="Abrir menú">Menú</summary>
              <div className="cab-menu-lista">
                <a href="/search">Alojamientos</a>
                <a href="/experiencias">Experiencias</a>
                <a href="/servicios">Servicios</a>
                <a className="cab-menu-tienda" href="https://shop.hestiat.com" target="_blank" rel="noopener noreferrer">Tienda</a>
                {esAnfitrion && <a href="/host">Mi panel</a>}
                {sesion ? (
                  <>
                    <a href="/favoritos">Favoritos</a>
                    <a href="/perfil">Mi perfil</a>
                    <form action="/api/auth/logout" method="post">
                      <button className="cab-btn" type="submit">Salir</button>
                    </form>
                  </>
                ) : (
                  <>
                    <a href="/login">Entrar</a>
                    <a href="/registro">Publica tu espacio</a>
                  </>
                )}
              </div>
            </details>
          </div>
        </header>
        {children}
        <footer>
          <div className="wrap pie">
            <div className="pie-cols">
              <div>
                <p className="pie-marca"><MarcaLogo /></p>
                <p className="m" style={{ fontSize: 12.5, marginTop: 6 }}>
                  <BotonConfigurarCookies />
                </p>
                {/* EL AVISO DE COOKIES. Pide permiso antes de que se cargue ninguna publicidad y
                    permite retirarlo desde el enlace de arriba. Va aquí porque es un elemento fijo:
                    no ocupa sitio en el flujo de la página. */}
                <AvisoCookies />
                <p className="pie-nota">
                  Alojamientos, experiencias y servicios de toda España, con datos reales y sin
                  inventar precios.
                </p>
              </div>
              <nav aria-label="Hestiat">
                <p className="pie-tit">Hestiat</p>
                <p className="pie-tit">Información</p>
                <a href="/sobre">Sobre Hestiat</a>
                <a href="/como-funciona">Cómo funciona</a>
                <a href="/contacto">Contacto</a>
                <a href="/preguntas-frecuentes">Preguntas frecuentes</a>
              </nav>
              <nav aria-label="Descubre">
                <p className="pie-tit">Descubre</p>
                <a href="/search">Alojamientos</a>
                <a href="/experiencias">Experiencias</a>
                <a href="/servicios">Servicios</a>
                <a href="/destinos">Destinos</a>
                <a href="/favoritos">Favoritos</a>
                <a href="https://shop.hestiat.com" target="_blank" rel="noopener noreferrer">Tienda</a>
              </nav>
              <nav aria-label="Para anfitriones y proveedores">
                <p className="pie-tit">Anfitriones y proveedores</p>
                <p style={{ fontWeight: 700, color: "var(--hestiat-primary-texto)" }}>
                  Publica gratis en Hestiat
                </p>
                <a href="/hazte-anfitrion">Hazte anfitrión</a>
                <a href="/nuevo">Publicar alojamiento</a>
                <a href="/publicar-experiencia">Publicar experiencia</a>
                <a href="/publicar-servicio">Publicar servicio</a>
                <a href="/condiciones-anfitrion">Ayuda para anfitriones</a>
              </nav>
              <nav aria-label="Ayuda">
                <p className="pie-tit">Ayuda</p>
                <a href="/ayuda">Centro de ayuda</a>
                <a href="/como-reservar">Cómo reservar</a>
                <a href="/cancelaciones">Cancelaciones</a>
                <a href="/seguridad">Seguridad</a>
                <a href="/contacto">Contacto</a>
              </nav>
            </div>
            <nav aria-label="Legal" className="pie-legal-enlaces">
              <a href="/aviso-legal">Aviso legal</a>
              <a href="/privacidad">Privacidad</a>
              <a href="/cookies">Cookies</a>
              <a href="/condiciones-uso">Condiciones de uso</a>
            </nav>
            <p className="pie-legal">
              Los datos del catálogo proceden de fuentes públicas (OpenStreetMap y otras) y figuran con
              su autoría; las fotografías son imágenes de referencia salvo que se indique otra cosa. Si
              encuentras algo que no cuadra, escríbenos a{" "}
              <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>.
            </p>
          </div>
        </footer>
        {/* Mide LCP, CLS e INP en el navegador de quien visita y los envía una sola vez, sin datos
            personales. Sirve para saber el rendimiento real, no el teórico. */}
        <Vitales />
      </body>
    </html>
  );
}
