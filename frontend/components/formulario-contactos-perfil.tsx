"use client";

/**
 * FORMULARIO DE CONTACTOS DEL PERFIL — «Mi perfil».
 *
 * Qué añade sobre el formulario existente (que NO se toca):
 *   · WhatsApp, correo público de contacto y página web.
 *   · Cuatro interruptores INDEPENDIENTES de publicación.
 *
 * Reglas que respeta en la propia interfaz:
 *   · El correo de acceso a la cuenta se muestra solo como referencia y NO se puede publicar.
 *   · El teléfono privado de registro no se publica solo: depende de «Mostrar mi teléfono».
 *   · Desactivar un interruptor NO borra el dato: solo deja de mostrarse.
 *
 * La autorización real la aplica el servidor (lib/perfil-contactos.server.ts). Aquí solo se
 * recoge y se envía. Ningún dato se considera publicado sin pasar por allí.
 */

import { useState } from "react";

export type ContactosPerfilVista = {
  telefono: string | null;
  whatsapp: string | null;
  emailPublico: string | null;
  webPublica: string | null;
  mostrarTelefono: boolean;
  mostrarWhatsapp: boolean;
  mostrarEmail: boolean;
  mostrarWeb: boolean;
};

/* Iconos SVG propios, mismo lenguaje visual que el resto de Hestiat (sin emojis). */
const Ico = {
  tel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  wa: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2m4.52 13.99c-.25.12-1.47.72-1.68 1.18-.21.58-.21 1.07-.14 1.18.06.11.22.17.47.29.25.12 1.47.72 1.69.8.23.09.39.13.56-.12.16-.25.64-.81.79-.97.14-.17.29-.19.54-.06.25.12 1.05.39 2 1.23.74.66 1.24 1.47 1.38 1.72.15.25.02.39-.11.51-.11.11-.25.29-.37.43-.13.15-.17.25-.25.41-.08.17-.04.31.02.43.06.12.56 1.35.77 1.85.2.48.41.42.56.43h.48c.17 0 .43-.06.66-.31.23-.25.87-.85.87-2.07 0-1.22-.89-2.4-1.01-2.56-.12-.17-1.75-2.67-4.23-3.74-.59-.26-1.05-.41-1.41-.52-.59-.19-1.13-.16-1.56-.1-.48.07-1.47.6-1.68 1.18" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 6 9 6.5L21 6" />
    </svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M2.8 12h18.4M12 2.8c2.4 2.6 3.6 5.6 3.6 9.2s-1.2 6.6-3.6 9.2c-2.4-2.6-3.6-5.6-3.6-9.2s1.2-6.6 3.6-9.2z" />
    </svg>
  ),
};

export default function FormularioContactosPerfil({ inicial }: { inicial: ContactosPerfilVista }) {
  const [d, setD] = useState<ContactosPerfilVista>(inicial);
  const [estado, setEstado] = useState<"listo" | "guardando" | "guardado" | "error">("listo");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const cambia = (k: keyof ContactosPerfilVista, v: string | boolean) =>
    setD((prev) => ({ ...prev, [k]: v }));

  async function enviar() {
    setEstado("guardando");
    setErrores({});
    setAviso(null);
    try {
      const r = await fetch("/api/perfil/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: d.whatsapp,
          emailPublico: d.emailPublico,
          webPublica: d.webPublica,
          mostrarTelefono: d.mostrarTelefono,
          mostrarWhatsapp: d.mostrarWhatsapp,
          mostrarEmail: d.mostrarEmail,
          mostrarWeb: d.mostrarWeb,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        setErrores(j?.errores ?? { general: "No se pudieron guardar los cambios." });
        setEstado("error");
        return;
      }
      setEstado("guardado");
      setAviso("Cambios guardados. Los canales que hayas autorizado ya se muestran en tus alojamientos.");
    } catch {
      setErrores({ general: "No hubo conexión con el servidor." });
      setEstado("error");
    }
  }

  const Interruptor = ({
    etiqueta, campo, tieneDato, ayuda,
  }: { etiqueta: string; campo: keyof ContactosPerfilVista; tieneDato: boolean; ayuda?: string }) => (
    <label className={`ccp-sw ${tieneDato ? "" : "ccp-sw-off"}`}>
      <input
        type="checkbox"
        checked={Boolean(d[campo])}
        disabled={!tieneDato}
        onChange={(e) => cambia(campo, e.target.checked)}
      />
      <span className="ccp-sw-txt">
        <strong>{etiqueta}</strong>
        <em>{tieneDato ? (ayuda ?? "Se mostrará en tus alojamientos") : "Añade el dato para poder publicarlo"}</em>
      </span>
    </label>
  );

  return (
    <section className="ccp">
      <style>{`
        .ccp{margin-top:26px;border-top:1px solid var(--border);padding-top:22px}
        .ccp h2{font-size:17px;margin:0 0 6px}
        .ccp p.intro{margin:0 0 18px;font-size:14px;color:var(--muted-fg)}
        .ccp-campo{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
        .ccp-campo label{flex:0 0 190px;font-weight:600;font-size:14px}
        .ccp-campo .ico{flex:0 0 22px;width:22px;height:22px;display:block;
          color:var(--hestiat-primary-texto);stroke:currentColor;fill:none}
        .ccp-campo .ico.wa{fill:currentColor;stroke:none;color:#25D366}
        .ccp-campo input[type=text],.ccp-campo input[type=email],.ccp-campo input[type=url]{
          flex:1 1 260px;min-height:44px;padding:10px 14px;border:1px solid var(--border);
          border-radius:999px;background:var(--card);font:inherit;color:var(--ink)}
        .ccp-campo input:focus-visible{outline:3px solid var(--hestiat-primary);outline-offset:1px}
        .ccp-err{flex:1 1 100%;color:#B3261E;font-size:13px;margin-left:200px}
        .ccp-sw{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;margin-bottom:10px;
          background:var(--fucsia-soft);border:1px solid var(--hestiat-primary);border-radius:calc(var(--radio) + 2px);cursor:pointer}
        .ccp-sw-off{background:var(--card);border-style:dashed;cursor:not-allowed;opacity:.75}
        .ccp-sw input{margin-top:3px;width:18px;height:18px;accent-color:var(--hestiat-primary)}
        .ccp-sw-txt{display:flex;flex-direction:column;gap:2px}
        .ccp-sw-txt strong{font-size:14px}
        .ccp-sw-txt em{font-size:12.5px;color:var(--muted-fg);font-style:normal}
        .ccp-acciones{display:flex;gap:12px;align-items:center;margin-top:18px;flex-wrap:wrap}
        .ccp-btn{background:var(--hestiat-primary);color:var(--ink);border:0;border-radius:999px;
          padding:13px 26px;font:inherit;font-weight:700;cursor:pointer;min-height:46px}
        .ccp-btn:hover{background:var(--hestiat-primary-hover)}
        .ccp-btn[disabled]{opacity:.6;cursor:progress}
        .ccp-ok{font-size:14px;color:var(--hestiat-primary-texto);font-weight:600}
        .ccp-nota{font-size:12.5px;color:var(--muted-fg);margin-top:14px;line-height:1.5}
        @media (max-width:520px){
          .ccp-campo label{flex:1 1 100%}
          .ccp-err{margin-left:0}
          .ccp-btn{width:100%}
        }
      `}</style>

      <h2>Contacto público</h2>
      <p className="intro">
        Decide qué canales quieres que aparezcan en las fichas de <strong>tus</strong> alojamientos.
        Todo está desactivado hasta que lo actives, y puedes retirarlo cuando quieras sin perder el dato.
      </p>

      <div className="ccp-campo">
        <span className="ico wa">{Ico.wa}</span>
        <label htmlFor="ccp-wa">WhatsApp</label>
        <input id="ccp-wa" type="text" inputMode="tel" placeholder="+34 600 000 000"
               value={d.whatsapp ?? ""} onChange={(e) => cambia("whatsapp", e.target.value)} />
        {errores.whatsapp && <span className="ccp-err">{errores.whatsapp}</span>}
      </div>

      <div className="ccp-campo">
        <span className="ico">{Ico.mail}</span>
        <label htmlFor="ccp-mail">Correo de contacto</label>
        <input id="ccp-mail" type="email" placeholder="contacto@tualojamiento.com"
               value={d.emailPublico ?? ""} onChange={(e) => cambia("emailPublico", e.target.value)} />
        {errores.emailPublico && <span className="ccp-err">{errores.emailPublico}</span>}
      </div>

      <div className="ccp-campo">
        <span className="ico">{Ico.web}</span>
        <label htmlFor="ccp-web">Página web</label>
        <input id="ccp-web" type="url" placeholder="https://tualojamiento.com"
               value={d.webPublica ?? ""} onChange={(e) => cambia("webPublica", e.target.value)} />
        {errores.webPublica && <span className="ccp-err">{errores.webPublica}</span>}
      </div>

      <Interruptor etiqueta="Mostrar mi teléfono" campo="mostrarTelefono"
        tieneDato={Boolean(d.telefono)} ayuda={`Se mostrará ${d.telefono ?? ""}`} />
      <Interruptor etiqueta="Mostrar mi WhatsApp" campo="mostrarWhatsapp" tieneDato={Boolean(d.whatsapp)} />
      <Interruptor etiqueta="Mostrar mi correo de contacto" campo="mostrarEmail" tieneDato={Boolean(d.emailPublico)} />
      <Interruptor etiqueta="Mostrar mi página web" campo="mostrarWeb" tieneDato={Boolean(d.webPublica)} />

      <div className="ccp-acciones">
        <button className="ccp-btn" onClick={enviar} disabled={estado === "guardando"}>
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado === "guardado" && aviso && <span className="ccp-ok">{aviso}</span>}
        {errores.general && <span className="ccp-err" style={{ marginLeft: 0 }}>{errores.general}</span>}
      </div>

      <p className="ccp-nota">
        El correo con el que inicias sesión <strong>nunca</strong> se publica: es independiente de este.
        Publicar un dato no significa que Hestiat haya comprobado que funciona; lo mostramos como
        «publicado por el anfitrión».
      </p>
    </section>
  );
}
