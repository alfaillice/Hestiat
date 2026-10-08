import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editar publicación — Administración",
  robots: { index: false, follow: false },
};

/**
 * EDITOR DE ADMINISTRACIÓN PARA EXPERIENCIAS Y SERVICIOS.
 *
 * Antes solo existía editor para alojamientos, así que el botón «Editar publicación» de las fichas de
 * experiencia y servicio habría sido un botón sin destino. Esto lo resuelve de verdad.
 *
 * Solo administración: si la sesión no es exactamente `admin`, se devuelve acceso denegado (no basta
 * con ocultar el botón en la ficha). Los alojamientos siguen usando su editor de siempre.
 */
const CAMPOS = {
  experiencia: {
    tabla: "experiencia",
    titulo: "Editar experiencia",
    descripcionCampo: "description",
    resumenCampo: "short_description",
    volver: "/experiencias",
  },
  servicio: {
    tabla: "servicio_turistico",
    titulo: "Editar servicio",
    descripcionCampo: "short_description",
    resumenCampo: "short_description",
    volver: "/servicios",
  },
} as const;

export default async function EditarCatalogo({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await getCurrentUser();
  if (!sesion || sesion.rol !== "admin") {
    return (
      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Acceso denegado</h1>
        <p className="aviso">
          Esta pantalla es solo para administración. Si crees que es un error, escríbenos a{" "}
          <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>.
        </p>
      </main>
    );
  }

  const { tipo: tipoCrudo, id: idCrudo } = await params;
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tipo = tipoCrudo === "servicio" ? "servicio" : tipoCrudo === "experiencia" ? "experiencia" : null;
  const id = Number(idCrudo);
  if (!tipo || !Number.isInteger(id) || id <= 0) notFound();

  const conf = CAMPOS[tipo];
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, name, ${conf.descripcionCampo} AS descripcion, phone, website_url, address, price, price_type, slug
       FROM ${conf.tabla} WHERE id = ? LIMIT 1`,
    [id],
  );
  const fila = filas[0];
  if (!fila) notFound();

  const aviso = uno(sp.aviso) ?? "";
  const ok = (uno(sp.ok) ?? "") === "1";

  return (
    <main style={{ paddingBottom: 40 }}>
      <p className="m" style={{ marginBottom: 10 }}>
        <Link className="f-limpiar" href={conf.volver}>
          ← Volver al listado
        </Link>
      </p>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{conf.titulo}</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 16 }}>
        {String(fila.name ?? "")} · identificador {id} · los cambios se guardan en el catálogo y quedan
        registrados como edición manual de administración.
      </p>

      {aviso ? (
        <p className="aviso" style={ok ? { borderColor: "var(--hestiat-primary)" } : { borderColor: "var(--destructive)" }}>
          {aviso}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/admin/catalogo"
        className="filtros"
        style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", maxWidth: 760 }}
      >
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="id" value={id} />

        <label className="f-campo">
          <span className="etq">Nombre</span>
          <input name="nombre" defaultValue={String(fila.name ?? "")} maxLength={255} />
        </label>

        <label className="f-campo">
          <span className="etq">Descripción</span>
          <textarea name="descripcion" defaultValue={String(fila.descripcion ?? "")} rows={5} maxLength={4000} />
        </label>

        <label className="f-campo">
          <span className="etq">Teléfono (solo si es público)</span>
          <input name="telefono" defaultValue={String(fila.phone ?? "")} maxLength={40} />
        </label>

        <label className="f-campo">
          <span className="etq">Web oficial</span>
          <input name="web" defaultValue={String(fila.website_url ?? "")} maxLength={512} />
        </label>

        <label className="f-campo">
          <span className="etq">Dirección</span>
          <input name="direccion" defaultValue={String(fila.address ?? "")} maxLength={255} />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label className="f-campo">
            <span className="etq">Precio</span>
            <input name="precio" defaultValue={fila.price === null ? "" : String(fila.price)} inputMode="decimal" />
          </label>
          <label className="f-campo">
            <span className="etq">Tipo de precio</span>
            <select name="tipoPrecio" defaultValue={String(fila.price_type ?? "")}>
              <option value="">Sin publicar (Consultar)</option>
              <option value="free">Gratis</option>
              <option value="exact">Importe exacto</option>
              <option value="from">Desde</option>
              <option value="variable">Variable</option>
              <option value="unavailable">No disponible</option>
            </select>
          </label>
        </div>

        <div className="f-acciones">
          <button className="f-aplicar" type="submit">
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
