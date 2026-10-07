import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth.server";
import { cargarParaEditar, permisoEdicion } from "@/lib/editor.server";
import { ESTADOS, estadoDe } from "@/lib/editor-estado.server";
import { poolLegacy } from "@/lib/db";
import { listarCanales, obtenerTokenExport, sincronizarSiCaduca } from "@/lib/canales.server";
import EditorAlojamiento from "@/components/editor-alojamiento";
import type { FotoMedio } from "@/components/medios";
import type { EstadoCanalVista } from "@/components/calendarios";

export const dynamic = "force-dynamic";

/**
 * El permiso se comprueba también aquí, y no solo en la página: es el único sitio donde todavía se
 * puede responder con un 404 de verdad. Cuando la guarda de la página se ejecuta, la respuesta ya
 * ha empezado a enviarse y el estado no se puede cambiar.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) notFound();
  const sesion = await getCurrentUser();
  const permiso = await permisoEdicion(sesion ?? null, legacyId);
  if (!permiso.puede) notFound();
  // Y que exista: un administrador tiene permiso sobre cualquiera, pero no sobre uno que no existe.
  const [existe] = await poolLegacy.query<any[]>(`SELECT id FROM alojamiento WHERE id = ? LIMIT 1`, [legacyId]);
  if (!existe[0]) notFound();
  return { title: "Editar alojamiento — Hestiat", robots: { index: false, follow: false } };
}

type Pestana = "general" | "fotos" | "precios" | "caracteristicas" | "disponibilidad" | "calendarios" | "reglas" | "publicacion";
const PESTANAS: Pestana[] = ["general", "fotos", "precios", "caracteristicas", "disponibilidad", "calendarios", "reglas", "publicacion"];

/**
 * EL editor de alojamiento de Hestiat. Uno solo, para anfitriones y administradores.
 *
 * Aquí no hay `/admin/edit-property` ni `/host/edit-property`: hay una página, un componente y una
 * lógica. Lo que cambia según el rol es el permiso —comprobado en servidor al cargar y otra vez en
 * cada guardado— y la pestaña de administración (propietario, estados de bloqueo y eliminación).
 */
export default async function EditarAlojamiento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) notFound();

  const sesion = await getCurrentUser();
  const permiso = await permisoEdicion(sesion ?? null, legacyId);
  if (!permiso.puede) notFound();

  const cargado = await cargarParaEditar(legacyId);
  if (!cargado) notFound();
  const { alojamiento, servicios } = cargado;

  // Los calendarios externos caducados se sincronizan al abrir: el anfitrión no depende de
  // acordarse de pulsar «actualizar». Un fallo de un canal no rompe la página.
  try {
    await sincronizarSiCaduca(Number(sesion!.id), legacyId);
  } catch (error) {
    console.error("[hestiat] sincronizarSiCaduca en el editor", legacyId, error);
  }

  const [fotosFilas] = await poolLegacy.query<any[]>(
    `SELECT id, url, alt, orden, ancho, alto FROM alojamiento_foto WHERE alojamiento_id = ? ORDER BY orden ASC, id ASC`,
    [legacyId],
  );
  const [reservas] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM reserva WHERE alojamiento_id = ?`, [legacyId]);
  const [noches] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n, SUM(origen IS NOT NULL AND origen <> 'hestiat') AS importadas FROM disponibilidad WHERE alojamiento_id = ?`,
    [legacyId],
  );
  const [auditoria] = await poolLegacy.query<any[]>(
    `SELECT activo, estado_auditoria FROM alojamiento WHERE id = ? LIMIT 1`,
    [legacyId],
  );
  const [propietarios] = await poolLegacy.query<any[]>(
    `SELECT id, COALESCE(nombre_mostrado, nombre, apellidos, email) AS nombre, rol
       FROM usuario
      WHERE activo = 1 AND bloqueado_en IS NULL AND rol IN ('anfitrion','admin')
      ORDER BY nombre LIMIT 300`,
  );
  const [enlace] = await poolLegacy.query<any[]>(
    `SELECT u.id, COALESCE(u.nombre_mostrado, u.nombre, u.apellidos, u.email) AS nombre
       FROM alojamiento_anfitrion af
       JOIN usuario u ON u.id = af.usuario_id
      WHERE af.alojamiento_id = ? LIMIT 1`,
    [legacyId],
  );

  const resultadoCanales = await listarCanales(Number(sesion!.id), legacyId);
  const canales: EstadoCanalVista[] = (resultadoCanales?.canales ?? []) as EstadoCanalVista[];

  // Dirección del calendario de Hestiat para pegarla en Airbnb, Booking u otro canal. Estaba en una
  // página aparte; se trae aquí para que el editor sea el único sitio donde se gestionan los
  // calendarios, sin perder la función.
  const tokenExport = await obtenerTokenExport(Number(sesion!.id), legacyId);
  const base = process.env.APP_URL?.trim() || "https://hestiat.com";
  const urlExport = tokenExport ? `${base}/api/ical/${tokenExport.token}` : null;

  const estado = estadoDe(
    auditoria[0]?.activo,
    alojamiento.estadoPublico,
    auditoria[0]?.estado_auditoria,
  );

  // Pestaña activa: la que trae el guardado, o la que se pidió. Nunca una inventada.
  const pedida = String((Array.isArray(sp.seccion) ? sp.seccion[0] : sp.seccion) ?? (Array.isArray(sp.pestana) ? sp.pestana[0] : sp.pestana) ?? "general");
  const pestanaInicial: Pestana = (PESTANAS as string[]).includes(pedida) ? (pedida as Pestana) : "general";
  const ok = Array.isArray(sp.ok) ? sp.ok[0] : sp.ok;
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const mensaje = error ? { tipo: "error" as const, texto: String(error) } : ok ? { tipo: "ok" as const, texto: String(ok) } : null;

  return (
    <main className="explorar">
      <nav className="migas" aria-label="Migas de pan">
        <Link href={permiso.esAdmin ? "/admin/alojamientos" : "/host"}>
          {permiso.esAdmin ? "Administración" : "Mis alojamientos"}
        </Link>
        <span>/</span> Editar
      </nav>

      <header className="editor-cab">
        <div>
          <h1>{alojamiento.titulo || "Alojamiento sin nombre"}</h1>
          <p className="meta">
            #{alojamiento.legacyId}
            {alojamiento.ciudad || alojamiento.provincia
              ? ` · ${[alojamiento.ciudad, alojamiento.provincia].filter(Boolean).join(", ")}`
              : ""}{" "}
            · {ESTADOS.find((e) => e.id === estado)?.etiqueta ?? estado}
            {" · "}
            <span className={"rol-badge" + (permiso.esAdmin ? " rol-badge-admin" : "")}>
              {permiso.esAdmin ? "Administrador" : "Anfitrión"}
            </span>
          </p>
          <p style={{ marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {alojamiento.slug && (
              <>
                <Link className="f-limpiar" href={`/alojamiento/${alojamiento.slug}`} target="_blank">
                  Ver la ficha pública →
                </Link>
                <Link className="f-limpiar" href={`/alojamiento/${alojamiento.slug}?vista=previa`} target="_blank">
                  Vista previa →
                </Link>
              </>
            )}
          </p>
        </div>
      </header>

      <EditorAlojamiento
        alojamiento={alojamiento}
        servicios={servicios}
        fotos={fotosFilas as FotoMedio[]}
        canales={canales}
        urlExport={urlExport}
        esAdmin={permiso.esAdmin}
        estado={estado}
        estados={ESTADOS.map((e) => ({ id: e.id, etiqueta: e.etiqueta, explicacion: e.explicacion, soloAdmin: e.soloAdmin }))}
        propietarios={propietarios.map((p) => ({ id: Number(p.id), nombre: String(p.nombre ?? ""), rol: String(p.rol ?? "") }))}
        propietarioActual={enlace[0] ? { id: Number(enlace[0].id), nombre: String(enlace[0].nombre ?? "") } : null}
        pestanaInicial={pestanaInicial}
        mensaje={mensaje}
        datos={{
          reservas: Number(reservas[0]?.n ?? 0),
          nochesBloqueadas: Number(noches[0]?.n ?? 0),
          nochesImportadas: Number(noches[0]?.importadas ?? 0),
        }}
      />
    </main>
  );
}
