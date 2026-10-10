"use client";

import { useRef, useState } from "react";

/**
 * FOTO DE PERFIL, CON VISTA PREVIA.
 *
 * La vista previa se hace en el navegador con `URL.createObjectURL`: se ve la imagen elegida antes de
 * guardarla, sin subirla. Al enviar el formulario, el servidor comprueba el formato real, el tamaño y
 * que la cuenta sea la tuya. Si algo falla, la foto anterior se queda como estaba.
 *
 * Dos formularios separados (subir y quitar) porque un formulario dentro de otro no es válido.
 */
export default function AvatarPerfil({
  actual,
  inicial,
  nombre,
}: {
  actual: string | null;
  inicial: string;
  nombre: string;
}) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [elegido, setElegido] = useState("");
  const entrada = useRef<HTMLInputElement | null>(null);

  const alElegir = (f: File | null) => {
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(f ? URL.createObjectURL(f) : null);
    setElegido(f ? f.name : "");
  };

  const ver = previa ?? actual;

  return (
    <section id="mifoto" className="ficha-seccion" style={{ marginTop: 8 }}>
      <h2 style={{ fontSize: 19, margin: "8px 0 10px" }}>Mi foto de perfil</h2>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        {ver ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ver} alt={nombre} className="anfitrion-foto anfitrion-foto-grande" />
        ) : (
          <span
            className="anfitrion-inicial"
            aria-hidden="true"
            style={{ width: 72, height: 72, fontSize: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            {inicial}
          </span>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <form action="/api/perfil" method="post" encType="multipart/form-data" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="accion" value="avatar" />
            <input
              ref={entrada}
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => alElegir(e.target.files?.[0] ?? null)}
              aria-label="Elegir una imagen para tu foto de perfil"
            />
            <button className="f-aplicar" type="submit" disabled={!previa}>
              {actual ? "Sustituir mi foto" : "Guardar mi foto"}
            </button>
          </form>

          {previa ? (
            <p style={{ color: "var(--muted-fg)", fontSize: 13, margin: 0 }}>
              Vista previa de «{elegido}». Todavía no se ha guardado: pulsa el botón para guardarla.
            </p>
          ) : null}

          {actual ? (
            <form action="/api/perfil" method="post" style={{ margin: 0 }}>
              <input type="hidden" name="accion" value="avatar-quitar" />
              <button className="f-limpiar" type="submit">
                Quitar mi foto
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p style={{ color: "var(--muted-fg)", fontSize: 13, marginTop: 10, maxWidth: "70ch" }}>
        JPG, PNG o WebP, hasta 8 MB. Es tu foto de cuenta y se ve en tu perfil público y en tus fichas
        como anfitrión. No tiene nada que ver con las fotografías de tus alojamientos.
      </p>
    </section>
  );
}
