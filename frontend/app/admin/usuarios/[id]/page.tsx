import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { RowDataPacket } from "mysql2/promise";
import { requireAdmin } from "@/lib/auth.server";
import { poolLegacy } from "@/lib/db";
import { leerContactosPerfil } from "@/lib/perfil-contactos.server";
import FormularioValidado from "@/components/formulario-validado";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar usuario — Hestiat", robots: { index: false } };

/**
 * EDICIÓN DE UN USUARIO DESDE EL PANEL.
 *
 * Existe porque el listado de usuarios no tenía ningún camino a una ficha editable: la pantalla
 * de perfil (`/perfil`) lee SIEMPRE de la sesión, y un administrador necesita abrir la de OTRA
 * persona. Esta página es el destino del botón «Editar» de cada fila.
 *
 * PROTECCIÓN: `requireAdmin()` en el servidor. Sin rol admin, redirige al login. La comprobación
 * no depende de que la interfaz oculte nada.
 *
 * QUÉ SE PUEDE EDITAR Y QUÉ NO:
 *   · Datos administrativos: nombre, apellidos, teléfono, ciudad, país, nombre público, bio.
 *   · Contacto público: WhatsApp, correo público y web, con SUS interruptores de autorización.
 *   · NO se tocan contraseñas ni credenciales: no se muestran y no hay campo para cambiarlas.
 *   · Los interruptores de publicación siguen siendo del usuario: el administrador puede ver su
 *     estado y corregir el dato, pero la autorización para hacerlo público es del propietario de
 *     la cuenta. Esta pantalla NO activa consentimientos en su nombre.
 */

type Fila = RowDataPacket & {
  id: number; email: string; nombre: string | null; apellidos: string | null;
  telefono: string | null; ciudad: string | null; pais: string | null;
  nombre_mostrado: string | null; bio: string | null; rol: string; activo: number | null;
  creado_en: string | null;
};

export default async function AdminUsuario({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return null; // requireAdmin ya redirige; esto satisface al compilador

  const { id } = await params;
  const uid = Number(id);
  if (!Number.isFinite(uid)) notFound();

  const [filas] = await poolLegacy.query<Fila[]>(
    `SELECT id, email, nombre, apellidos, telefono, ciudad, pais, nombre_mostrado, bio, rol,
            activo, creado_en
       FROM usuario WHERE id = ? LIMIT 1`,
    [uid],
  );
  const u = filas[0];
  if (!u) notFound();

  const contactos = await leerContactosPerfil(uid);

  const [alojamientos] = await poolLegacy.query<(RowDataPacket & { id: number; titulo: string | null })[]>(
    `SELECT al.id, al.titulo
       FROM alojamiento_anfitrion af JOIN alojamiento al ON al.id = af.alojamiento_id
      WHERE af.usuario_id = ? LIMIT 50`,
    [uid],
  );

  return (
    <>
      <div className="admin-cab">
        <h1>Editar usuario</h1>
        <p style={{ color: "var(--muted-fg)", fontSize: 14 }}>
          <Link href="/admin/usuarios">← Volver al listado</Link>
          {" · "}Cuenta #{u.id} · {u.email} · rol {u.rol}
        </p>
      </div>

      {/* DATOS ADMINISTRATIVOS. El envío va a la API administrativa, que vuelve a comprobar el
          rol en el servidor: esta página no es la que protege, es solo el formulario. */}
      {/* El formulario va envuelto para validar en cliente ANTES de enviar. Los campos y el POST
          son los mismos de siempre: si el JavaScript falla, sigue funcionando y la API decide. */}
      <FormularioValidado
        action={`/api/admin/usuarios/${u.id}`}
        rolActual={u.rol}
        esUnoMismo={Number((admin as { id?: number }).id) === Number(u.id)}
      >
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Datos de la cuenta</h2>

        <div className="f-campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={u.nombre ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="apellidos">Apellidos</label>
          <input id="apellidos" name="apellidos" defaultValue={u.apellidos ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" defaultValue={u.telefono ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="nombre_mostrado">Nombre público</label>
          <input id="nombre_mostrado" name="nombre_mostrado" defaultValue={u.nombre_mostrado ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" name="ciudad" defaultValue={u.ciudad ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="pais">País</label>
          <input id="pais" name="pais" defaultValue={u.pais ?? ""} />
        </div>
        <div className="f-campo">
          <label htmlFor="bio">Sobre mí</label>
          <textarea id="bio" name="bio" rows={4} defaultValue={u.bio ?? ""} />
        </div>

        <h2 style={{ fontSize: 17, margin: "22px 0 12px", borderTop: "1px solid var(--border)", paddingTop: 18 }}>
          Acceso y permisos
        </h2>

        {/* CORREO DE ACCESO. Distinto del correo público de contacto: este sirve para entrar y es
            único en la tabla (uq_usuario_email). La API comprueba que no lo tenga otra cuenta. */}
        <div className="f-campo">
          <label htmlFor="email">Correo de acceso</label>
          <input id="email" name="email" type="email" defaultValue={u.email} required />
        </div>

        {/* ROL. Los valores reales del sistema son admin / anfitrion / huesped: el tipo `Rol` de
            lib/auth.server.ts no contempla otro. La API valida contra esa misma lista y rechaza
            que un administrador se retire a sí mismo el rol: si lo hiciera se quedaría sin acceso
            al panel y sin forma de volver por la interfaz. */}
        <div className="f-campo">
          <label htmlFor="rol">Rol</label>
          <select id="rol" name="rol" defaultValue={u.rol}>
            <option value="huesped">Huésped (usuario normal)</option>
            <option value="anfitrion">Anfitrión</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        {/* CONTRASEÑA. Dejar en blanco = no se cambia. Si se rellena, se exige mínimo 8 y doble
            escritura, y el servidor la guarda con hashPassword() —el mismo ayudante del registro
            y de la recuperación—, así que el usuario sigue pudiendo entrar con el formato scrypt. */}
        <div className="f-campo">
          <label htmlFor="password">Nueva contraseña</label>
          <input id="password" name="password" type="password" autoComplete="new-password"
                 minLength={8} placeholder="Dejar en blanco para no cambiarla" />
        </div>
        <div className="f-campo">
          <label htmlFor="password2">Repite la contraseña</label>
          <input id="password2" name="password2" type="password" autoComplete="new-password" minLength={8} />
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-fg)", margin: "4px 0 14px" }}>
          La contraseña solo se cambia si escribes una nueva. Mínimo 8 caracteres. No se guarda en
          claro ni se muestra nunca.
        </p>

        <div className="f-acciones"><button className="f-aplicar" type="submit">Guardar cambios</button></div>
      </FormularioValidado>

      {/* CONTACTO PÚBLICO DEL USUARIO: se muestra su estado real, sin activarlo en su nombre. */}
      <section style={{ marginTop: 26, borderTop: "1px solid var(--border)", paddingTop: 22 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Contacto público</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)", marginBottom: 12 }}>
          Las autorizaciones de publicación pertenecen al usuario: se muestran para su revisión,
          pero no se activan desde el panel en su nombre.
        </p>
        <table className="tabla">
          <thead>
            <tr><th>Canal</th><th>Dato</th><th>Autoriza su publicación</th></tr>
          </thead>
          <tbody>
            <tr><td>Teléfono</td><td>{contactos?.telefono || "—"}</td><td>{contactos?.mostrarTelefono ? "Sí" : "No"}</td></tr>
            <tr><td>WhatsApp</td><td>{contactos?.whatsapp || "—"}</td><td>{contactos?.mostrarWhatsapp ? "Sí" : "No"}</td></tr>
            <tr><td>Correo público</td><td>{contactos?.emailPublico || "—"}</td><td>{contactos?.mostrarEmail ? "Sí" : "No"}</td></tr>
            <tr><td>Página web</td><td>{contactos?.webPublica || "—"}</td><td>{contactos?.mostrarWeb ? "Sí" : "No"}</td></tr>
          </tbody>
        </table>
      </section>

      {/* ALOJAMIENTOS ASOCIADOS, con acceso a su editor. */}
      <section style={{ marginTop: 26, borderTop: "1px solid var(--border)", paddingTop: 22 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Alojamientos asociados</h2>
        {alojamientos.length === 0 ? (
          <p style={{ color: "var(--muted-fg)", fontSize: 14 }}>Sin alojamientos vinculados.</p>
        ) : (
          <table className="tabla">
            <thead><tr><th>ID</th><th>Alojamiento</th><th></th></tr></thead>
            <tbody>
              {alojamientos.map((a) => (
                <tr key={a.id}>
                  <td className="num">{a.id}</td>
                  <td>{a.titulo || "—"}</td>
                  <td>
                    <Link className="f-limpiar" href={`/admin/editar/alojamiento/${a.id}`}>Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
