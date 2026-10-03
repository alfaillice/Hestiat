import type { Metadata } from "next";
import Resultados from "@/components/resultados";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar alojamiento — Hestiat",
  description:
    "Busca alojamiento rural, natural y singular en toda España por ciudad, provincia o punto de interés.",
  alternates: { canonical: "/search" },
};

/**
 * `/search` — resultados de búsqueda.
 * Misma implementación que la portada (componente compartido), distinta URL: así se
 * conservan las rutas ya indexadas y no se duplica lógica.
 */
export default async function Buscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);

  return (
    <main className="wrap">
      <h1 style={{ fontSize: 36, lineHeight: 1.12, margin: "30px 0 8px" }}>Buscar alojamiento</h1>
      <Resultados q={q} pagina={pagina} basePath="/search" />
    </main>
  );
}
