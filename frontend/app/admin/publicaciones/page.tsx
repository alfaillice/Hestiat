import Link from "next/link";
import { pool, poolLegacy } from "@/lib/db";
import { Aviso } from "@/components/estados";

export const dynamic = "force-dynamic";

/**
 * ADMINISTRACIÓN → PUBLICACIONES. Las tres pestañas en un solo listado.
 *
 * ── QUÉ REUTILIZA, Y POR QUÉ ASÍ ────────────────────────────────────────────────────────────────
 * El listado del backoffice de alojamientos (`/admin/alojamientos`) ya resolvía lo difícil:
 * filtros y paginación EN EL SERVIDOR (LIMIT/OFFSET), contador total, rango mostrado y los
 * componentes de la casa (`admin-cab`, `admin-buscar`, `Aviso`, `f-aplicar`). Esta sección hace
 * exactamente lo mismo, pero con un parámetro `tipo` que decide de qué catálogo se lee. No hay una
 * segunda forma de listar: es el mismo patrón aplicado a tres orígenes.
 *
 * ── DE DÓNDE LEE CADA TIPO ──────────────────────────────────────────────────────────────────────
 * Los alojamientos viven en la base ORIGINAL (`poolLegacy`), que es donde están los datos vivos.
 * Experiencias y servicios viven en la base nueva (`pool`). Cada pestaña usa la suya: mezclarlas
 * sería el primer paso para romper algo.
 *
 * ── LO QUE TODAVÍA NO HACE, Y NO SE DISIMULA ────────────────────────────────────────────────────
 * · Se busca por nombre, identificador y estado, con paginación real en servidor. Los filtros por
 *   localidad, provincia, categoría y responsable llegan cuando se confirmen las columnas exactas de
 *   cada tabla: prefiero dejar el filtro fuera que inventarme un nombre de columna y romper la
 *   página en producción.
 * · La columna de fotografía indica CUÁNTAS tiene la publicación (dato que ya existe), no la
 *   miniatura: la miniatura necesita el mismo tratamiento por tipo y va con la Fase 5.
 */
const POR_PAGINA = 25;

interface Fuente {
  etiqueta: string;
  /** Nombre y columnas de la tabla, ya comprobadas en consultas que funcionan hoy. */
  tabla: string;
  base: "legacy" | "nueva";
  nombre: string;
  estado: string;
  rutaEditar: (id: number, slug: string | null) => string;
  rutaVer: (id: number, slug: string | null) => string;
  /** Columna de fotos, cuando existe una tabla de fotos por publicación. */
  fotos?: string;
  slug?: boolean;
}

const FUENTES: Record<string, Fuente> = {
  alojamiento: {
    etiqueta: "Alojamientos",
    tabla: "alojamiento",
    base: "legacy",
    nombre: "titulo",
    estado: "activo",
    fotos: "alojamiento_foto",
    rutaEditar: (id) => `/admin/editar/alojamiento/${id}`,
    rutaVer: (id) => `/admin/alojamientos/${id}`,
  },
  experiencia: {
    etiqueta: "Experiencias",
    tabla: "experiencia",
    base: "nueva",
    nombre: "name",
    estado: "is_active",
    slug: true,
    rutaEditar: (id) => `/admin/editar/experiencia/${id}`,
    rutaVer: (_id, slug) => (slug ? `/experiencias/${slug}` : "#"),
  },
  servicio: {
    etiqueta: "Servicios",
    tabla: "servicio_turistico",
    base: "nueva",
    nombre: "name",
    estado: "is_active",
    slug: true,
    rutaEditar: (id) => `/admin/editar/servicio/${id}`,
    rutaVer: (_id, slug) => (slug ? `/servicios/${slug}` : "#"),
  },
};

export default async function AdminPublicaciones({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string; p?: string; estado?: string; aviso?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const tipo = sp.tipo && FUENTES[sp.tipo] ? sp.tipo : "alojamiento";
  const f = FUENTES[tipo];
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.p ?? 1) || 1);
  const offset = (pagina - 1) * POR_PAGINA;
  const db = f.base === "legacy" ? poolLegacy : pool;

  const filtros: string[] = ["1=1"];
  const valores: unknown[] = [];
  if (q) {
    filtros.push(`(${f.nombre} LIKE ? OR CAST(id AS CHAR) = ?)`);
    valores.push(`%${q}%`, q);
  }
  if (sp.estado === "publicados") filtros.push(`${f.estado} = 1`);
  if (sp.estado === "no-publicados") filtros.push(`${f.estado} = 0`);
  const where = filtros.join(" AND ");

  const [tot] = await db.query<any[]>(`SELECT COUNT(*) AS n FROM ${f.tabla} WHERE ${where}`, valores);
  const total = Number(tot[0]?.n ?? 0);

  const columnas = [
    "id",
    f.slug ? "slug" : "NULL AS slug",
    `${f.nombre} AS nombre`,
    `${f.estado} AS estado`,
    f.fotos
      ? `(SELECT COUNT(*) FROM ${f.fotos} x WHERE x.${f.tabla === "alojamiento" ? "alojamiento" : "accommodation"}_id = t.id) AS fotos`
      : "NULL AS fotos",
  ].join(", ");

  const [filas] = await db.query<any[]>(
    `SELECT ${columnas} FROM ${f.tabla} t WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset],
  );

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + POR_PAGINA, total);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const conFiltros = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ tipo, ...(q ? { q } : {}), ...(sp.estado ? { estado: sp.estado } : {}), ...extra });
    return `/admin/publicaciones?${qs.toString()}`;
  };

  return (
    <>
      <header className="admin-cab">
        <h1>Publicaciones</h1>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          Alojamientos, experiencias y servicios en un solo sistema. La plataforma sigue siendo
          gratuita: sin cuota de publicación y sin comisión.
        </p>
      </header>

      <Aviso texto={sp.aviso} ok={sp.ok} />

      <nav className="admin-tabs" aria-label="Tipo de publicación" style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
        {Object.entries(FUENTES).map(([clave, fuente]) => (
          <Link
            key={clave}
            href={conFiltros({ tipo: clave, p: "1" })}
            className={clave === tipo ? "f-aplicar" : "f-limpiar"}
            aria-current={clave === tipo ? "page" : undefined}
          >
            {fuente.etiqueta}
          </Link>
        ))}
      </nav>

      <form className="admin-buscar" method="get">
        <input type="hidden" name="tipo" value={tipo} />
        <input name="q" defaultValue={q} placeholder={`Buscar en ${f.etiqueta.toLowerCase()} por nombre o identificador`} />
        <select name="estado" defaultValue={sp.estado ?? ""}>
          <option value="">Todos</option>
          <option value="publicados">Publicados</option>
          <option value="no-publicados">No publicados</option>
        </select>
        <button className="f-aplicar" type="submit">
          Buscar
        </button>
        <Link className="f-limpiar" href={`/admin/publicaciones?tipo=${tipo}`}>
          Quitar filtros
        </Link>
      </form>

      <p className="m" style={{ color: "var(--muted-fg)", margin: "10px 0 14px" }}>
        {total.toLocaleString("es-ES")} publicaciones en {f.etiqueta.toLowerCase()} · mostrando {desde}–{hasta}
      </p>

      {filas.length === 0 ? (
        <p className="m">No hay publicaciones que cumplan esos filtros.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-tabla" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 10px" }}>Fotos</th>
                <th style={{ padding: "8px 10px" }}>Nombre</th>
                <th style={{ padding: "8px 10px" }}>Tipo</th>
                <th style={{ padding: "8px 10px" }}>Id</th>
                <th style={{ padding: "8px 10px" }}>Estado</th>
                <th style={{ padding: "8px 10px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const id = Number(r.id);
                const slug = r.slug ? String(r.slug) : null;
                const publicado = Number(r.estado) === 1;
                return (
                  <tr key={id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px" }}>{r.fotos == null ? "—" : Number(r.fotos)}</td>
                    <td style={{ padding: "8px 10px" }}>{String(r.nombre ?? "—")}</td>
                    <td style={{ padding: "8px 10px" }}>{f.etiqueta.slice(0, -1)}</td>
                    <td style={{ padding: "8px 10px" }}>{id}</td>
                    <td style={{ padding: "8px 10px" }}>{publicado ? "Publicada" : "No publicada"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <Link href={f.rutaVer(id, slug)} style={{ fontWeight: 600, marginRight: 12 }}>
                        Ver
                      </Link>
                      <Link href={f.rutaEditar(id, slug)} style={{ fontWeight: 600 }}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 ? (
        <nav style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }} aria-label="Paginación">
          {pagina > 1 ? (
            <Link className="f-limpiar" href={conFiltros({ p: String(pagina - 1) })}>
              ← Anterior
            </Link>
          ) : null}
          <span className="m">
            Página {pagina} de {paginas.toLocaleString("es-ES")}
          </span>
          {pagina < paginas ? (
            <Link className="f-limpiar" href={conFiltros({ p: String(pagina + 1) })}>
              Siguiente →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
