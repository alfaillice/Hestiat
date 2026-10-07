import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth.server";
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
};

const estilos = `
:root{
  --background:oklch(98.8% .005 92); --foreground:oklch(23.5% .021 225); --ink:oklch(18.5% .024 230);
  --card:oklch(100% 0 0); --primary:oklch(41.5% .072 197); --primary-fg:oklch(98.5% .008 190);
  --primary-soft:oklch(94.5% .022 195); --accent:oklch(79.5% .135 74); --accent-fg:oklch(29% .06 62);
  --secondary:oklch(96.2% .008 92); --muted:oklch(95.5% .007 92); --muted-fg:oklch(51.5% .019 232);
  --success:oklch(58% .115 158); --destructive:oklch(55.2% .191 25);
  --border:oklch(90% .008 232); --surface:oklch(97.2% .008 92); --surface-strong:oklch(93.5% .014 92);
  --radio:14px; --radio-pill:9999px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--background);color:var(--foreground)}
body{font-family:var(--fuente-texto),ui-sans-serif,system-ui,sans-serif;font-size:15.2px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--fuente-titulo),ui-sans-serif,system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;line-height:1.12}
a{color:inherit;text-decoration:none} img{display:block;max-width:100%}
.wrap{max-width:1360px;margin:0 auto;padding:0 18px}
/* cabecera */
.cab{border-bottom:1px solid var(--border);background:var(--background);position:sticky;top:0;z-index:40}
.cab-in{display:flex;align-items:center;gap:14px;height:60px}
.marca{font-weight:700;letter-spacing:-.01em;font-size:20px;color:var(--primary);font-family:var(--fuente-titulo)}
.cab-btn{margin-left:auto;border:1px solid var(--border);background:var(--card);border-radius:var(--radio-pill);padding:11px 16px;font:inherit;cursor:pointer}
/* buscador pill */
.buscador{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:var(--radio-pill);padding:6px;box-shadow:0 10px 30px rgba(20,40,50,.10);max-width:940px}
.buscador .campo{flex:1;display:flex;flex-direction:column;padding:6px 14px;min-width:0}
.buscador .etq{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--muted-fg);text-transform:uppercase}
.buscador input{border:0;background:transparent;font:inherit;outline:none;color:var(--ink);width:100%}
.buscador .sep{width:1px;height:28px;background:var(--border)}
.buscador button{background:var(--primary);color:var(--primary-fg);border:0;border-radius:var(--radio-pill);padding:12px 22px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}
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
.estilo .txt span{font-size:12.5px;opacity:.85}
/* destinos */
/* 200px: con 1360 de contenedor, 6 columnas de 210 se quedaban a 6px de entrar. */
.destinos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.destino{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);overflow:hidden}
.destino img{height:110px;width:100%;object-fit:cover;background:var(--surface-strong)}
.destino .d{padding:10px 12px 12px}
.destino b{font-family:var(--fuente-titulo);font-size:15px;display:block}
.destino span{color:var(--muted-fg);font-size:12.5px;font-variant-numeric:tabular-nums}
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
.aloj .t{font-family:var(--fuente-titulo);font-weight:700;font-size:15.5px;line-height:1.25;margin-bottom:2px}
.aloj .m{color:var(--muted-fg);font-size:12.5px}
.aloj .p{margin-top:8px;font-weight:700;font-variant-numeric:tabular-nums}
.aloj .p .ref{color:var(--muted-fg);font-weight:400;font-size:12px}
.precio{font-variant-numeric:tabular-nums}
footer{border-top:1px solid var(--border);margin-top:44px;padding:24px 0;color:var(--muted-fg);font-size:13px}
.aviso{background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio);padding:12px 15px;font-size:13px;color:var(--muted-fg)}
/* busqueda con mapa y filtros */
.busqueda{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,42%);gap:26px;align-items:start}
.mapa-lado{position:sticky;top:76px}
.filtros{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:14px;margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.f-campo{display:flex;flex-direction:column;gap:5px}
.f-campo select,.f-campo input{border:1px solid var(--border);border-radius:10px;padding:11px 12px;font:inherit;background:var(--background);color:var(--ink);width:100%}
.f-servicios{grid-column:1/-1;border:0}
.f-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.f-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:var(--radio-pill);padding:6px 12px;font-size:13.5px;cursor:pointer;background:var(--background)}
.f-chip input{accent-color:var(--primary)}
.f-chip em{color:var(--muted-fg);font-style:normal;font-size:12px}
.f-acciones{grid-column:1/-1;display:flex;align-items:center;gap:14px}
.f-aplicar{background:var(--primary);color:var(--primary-fg);border:0;border-radius:var(--radio-pill);padding:12px 22px;font:inherit;font-weight:700;cursor:pointer}
.f-limpiar{color:var(--muted-fg);font-size:13.5px;text-decoration:underline}
/* marcadores de precio del mapa */
.hx-pin-wrapper{background:none;border:0}
.hx-pin{display:inline-block;transform:translate(-50%,-50%);background:var(--card);border:1.5px solid var(--border);border-radius:var(--radio-pill);padding:4px 10px;font-weight:600;font-size:12.5px;color:var(--ink);font-variant-numeric:tabular-nums;box-shadow:0 3px 10px rgba(20,40,50,.18);white-space:nowrap}
.hx-pin--activo{border-color:var(--accent);box-shadow:0 4px 14px rgba(200,120,0,.30)}
/* paneles: administracion y anfitrion */
.admin{display:grid;grid-template-columns:230px minmax(0,1fr);gap:26px;max-width:1360px;margin:0 auto;padding:22px 18px}
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
.explorar{max-width:1720px;margin:0 auto;padding:22px 18px 30px}
.explorar-cab{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.explorar-cab h1{font-size:30px}
.vista{display:flex;gap:6px;margin-left:auto;background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio-pill);padding:4px}
.vista a{padding:7px 15px;border-radius:var(--radio-pill);font-size:13.5px;font-weight:600;color:var(--muted-fg)}
.vista a.vista-activa{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(20,40,50,.10)}
.galeria-cuenta{color:var(--muted-fg);font-size:13.5px;margin:4px 0 14px}
/* Columnas por anchura disponible. En pantalla grande, 7; nunca se encogen las tarjetas a la fuerza
   para meter más: a partir de cierto punto baja el número de columnas. */
.galeria{display:grid;gap:20px;grid-template-columns:repeat(7,minmax(0,1fr))}
@media(max-width:1800px){.galeria{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media(max-width:1400px){.galeria{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:1080px){.galeria{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:820px){.galeria{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}
@media(max-width:600px){.galeria{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
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
.ficha-texto{font-size:14.6px;color:var(--foreground)}
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: estilos }} />
      </head>
      <body>
        <header className="cab">
          <div className="wrap cab-in">
            <a href="/" className="marca">
              hestiat
            </a>
            <a href="/search" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
              Explorar
            </a>
            <a href="/experiencias" style={{ color: "var(--muted-fg)", fontSize: 14 }}>
              Experiencias
            </a>
            <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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
          </div>
        </header>
        {children}
        <footer>
          <div className="wrap">
            Hestiat · datos del esquema nuevo migrado desde la base original · sin cargos ocultos
          </div>
        </footer>
      </body>
    </html>
  );
}
