import type { Metadata } from "next";
import type { ReactNode } from "react";
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
.cab-btn{margin-left:auto;border:1px solid var(--border);background:var(--card);border-radius:var(--radio-pill);padding:8px 16px;font:inherit;cursor:pointer}
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
.destinos{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
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
@media(max-width:760px){
  .hero{min-height:340px}.hero h1{font-size:30px}
  .buscador{flex-direction:column;align-items:stretch;border-radius:var(--radio)}
  .buscador .sep{display:none}
  .buscador .campo{border-bottom:1px solid var(--border)}
  .buscador button{margin:6px}
  .estilo{flex:0 0 210px;height:150px}
}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
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
            <button className="cab-btn">Publica tu espacio</button>
          </div>
        </header>
        {children}
        <footer>
          <div className="wrap">
            Hestiat 2.0 · datos del esquema nuevo migrado desde la base original · sin cargos ocultos
          </div>
        </footer>
      </body>
    </html>
  );
}
