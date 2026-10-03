import type { Metadata } from "next";
import Resultados from "@/components/resultados";

export const dynamic = "force-dynamic"; // datos vivos: la búsqueda no se cachea

export const metadata: Metadata = {
  title: "Hestiat — Alojamientos con carácter en toda España",
  description:
    "Encuentra dónde quedarte, sin sorpresas y sin comisiones. Alojamiento rural, natural y singular en toda España.",
  alternates: { canonical: "/" },
};

/**
 * Portada. Server Component: la consulta se resuelve en el servidor y el HTML sale
 * renderizado (SSR), que es lo que exigen el SEO y la velocidad en móvil.
 *
 * La lógica de resultados vive en `components/resultados.tsx`, compartida con `/search`:
 * una sola implementación, como exige el mandato.
 */
export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);

  return (
    <main className="wrap">
      <h1 style={{ fontSize: 40, lineHeight: 1.12, margin: "30px 0 8px", maxWidth: "20ch" }}>
        ¿Dónde quieres despertar?
      </h1>
      <Resultados q={q} pagina={pagina} basePath="/" />
    </main>
  );
}
