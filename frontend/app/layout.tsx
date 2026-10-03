import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hestiat — Alojamientos con carácter",
  description:
    "Alojamiento rural, natural y singular en toda España. Sin sorpresas y sin comisiones.",
};

/**
 * Sistema de diseño de Hestiat 2.0 en un único lugar.
 * Paleta: hueso #FAF7F2 · oliva #2F4A3C · terracota #C4552D (solo acción de reservar).
 * Tipografía: serif de alto contraste para titulares, sans para interfaz, cifras tabulares.
 */
const estilos = `
:root{--bone:#FAF7F2;--bone2:#F1EBE2;--olive:#2F4A3C;--terra:#C4552D;--ink:#1F1C19;--stone:#6E655C;--line:#E3DBD0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bone);color:var(--ink)}
body{font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-.01em}
.wrap{max-width:1180px;margin:0 auto;padding:24px}
header{border-bottom:1px solid var(--line);padding:14px 0;background:var(--bone)}
.logo{letter-spacing:.18em;text-transform:uppercase;font-family:Georgia,serif;font-size:20px;color:var(--olive)}
.search{display:flex;gap:10px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:8px;margin:22px 0 10px;box-shadow:0 6px 20px rgba(31,28,25,.06)}
.search input{flex:1;border:0;padding:12px 16px;font-size:16px;background:transparent;outline:none;color:var(--ink)}
.search button{background:var(--olive);color:#fff;border:0;border-radius:18px;padding:12px 26px;font-size:15px;font-weight:600;cursor:pointer}
.count{color:var(--stone);font-size:14px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-top:24px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:box-shadow .18s ease,transform .18s ease}
.card:hover{box-shadow:0 12px 28px rgba(31,28,25,.10);transform:translateY(-2px)}
.card img,.card .nofoto{width:100%;height:180px;object-fit:cover;background:var(--bone2)}
.card .body{padding:12px 14px 16px}
.card .t{font-family:Georgia,serif;font-size:18px;line-height:1.25;margin-bottom:4px}
.card .m{color:var(--stone);font-size:13px}
.card .p{margin-top:8px;font-variant-numeric:tabular-nums;font-weight:600}
.card .p .ref{color:var(--stone);font-weight:400;font-size:12px}
.nav{display:flex;gap:14px;justify-content:center;margin:30px 0}
.nav a{color:var(--olive);border:1px solid var(--line);border-radius:12px;padding:9px 18px;background:#fff;font-size:14px}
.hero{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin:20px 0;border-radius:16px;overflow:hidden}
.hero img,.hero .nofoto{width:100%;height:300px;object-fit:cover;background:var(--bone2)}
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.grid2 img{height:146px;object-fit:cover;border-radius:8px;background:var(--bone2)}
.meta{color:var(--stone);font-size:15px}
.facts{display:flex;flex-wrap:wrap;gap:22px;margin:18px 0;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font-size:14px}
.cols{display:grid;grid-template-columns:1fr 340px;gap:36px;align-items:start}
.card-reserva{border:1px solid var(--line);background:#fff;border-radius:16px;padding:20px;box-shadow:0 6px 20px rgba(31,28,25,.06);position:sticky;top:20px}
.price{font-family:Georgia,serif;font-size:30px;font-variant-numeric:tabular-nums}
.btn{display:block;width:100%;margin-top:14px;background:var(--terra);color:#fff;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:600;cursor:pointer}
.note{color:var(--stone);font-size:13px;margin-top:10px;text-align:center}
.desc{margin:24px 0;max-width:62ch}
table.info{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
table.info td{border-top:1px solid var(--line);padding:7px 0}
.warn{background:var(--bone2);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--stone);margin-top:30px}
footer{border-top:1px solid var(--line);margin-top:40px;padding:22px 0;color:var(--stone);font-size:13px}
@media(max-width:820px){.hero{grid-template-columns:1fr}.hero img{height:220px}.grid2{display:none}.cols{grid-template-columns:1fr}.card-reserva{position:static}}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: estilos }} />
      </head>
      <body>
        <header>
          <div className="wrap">
            <a href="/" className="logo">
              hestiat
            </a>
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
