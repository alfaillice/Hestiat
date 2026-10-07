import Link from "next/link";

export const metadata = { title: "Página no encontrada — Hestiat" };

/**
 * Página 404 propia.
 *
 * Antes se servía la de por defecto de Next, en inglés y fuera del diseño. Esta mantiene el
 * lenguaje visual y, sobre todo, **ofrece una salida**: buscar o volver a la portada.
 */
export default function NoEncontrado() {
  return (
    <main className="wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
      <div className="vacio" style={{ margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--fuente-titulo)", fontSize: 44, fontWeight: 700, color: "var(--primary)" }}>404</p>
        <p className="vacio-titulo">No hemos encontrado esta página</p>
        <p className="vacio-texto">
          Puede que el enlace esté mal escrito o que el alojamiento ya no esté publicado. Prueba a
          buscarlo de nuevo.
        </p>
        <p style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="f-aplicar" href="/search">Buscar alojamiento</Link>
          <Link className="f-limpiar" href="/">Ir a la portada</Link>
        </p>
      </div>
    </main>
  );
}
