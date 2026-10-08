import Link from "next/link";

/**
 * FORMULARIO DE ALTA PARA PROVEEDORES (experiencias y servicios).
 *
 * Es un formulario normal con `method="post"`: funciona sin JavaScript y no depende de nada del
 * navegador. Lo que se envía NO va directo al catálogo: entra en una cola de solicitudes que
 * administración revisa y aprueba, así que el catálogo no se ensucia con altas sin comprobar.
 *
 * Lleva un campo trampa invisible para los bots: si llega relleno, la solicitud se descarta sin
 * guardarla.
 */
export interface CategoriaOpcion {
  id: number;
  nombre: string;
}

export default function FormularioAlta({
  tipo,
  categorias,
  aviso,
}: {
  tipo: "experiencia" | "servicio";
  categorias: CategoriaOpcion[];
  aviso?: { ok: boolean; texto: string } | null;
}) {
  const esExperiencia = tipo === "experiencia";
  const nombre = esExperiencia ? "experiencia" : "servicio";

  if (aviso?.ok) {
    return (
      <div className="aviso" style={{ borderColor: "var(--hestiat-primary)" }}>
        <b>Recibido.</b> {aviso.texto} Te escribiremos al correo que nos has dejado en cuanto se
        revise. Si quieres añadir algo, respóndenos a ese mismo correo o escríbenos a{" "}
        <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>.
      </div>
    );
  }

  return (
    <>
      {aviso && !aviso.ok ? (
        <p className="aviso" style={{ borderColor: "var(--destructive)" }}>
          {aviso.texto}
        </p>
      ) : null}

      <form method="post" action="/api/solicitudes" className="filtros" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", maxWidth: 760 }}>
        <input type="hidden" name="tipo" value={tipo} />
        {/* Campo trampa: invisible para las personas, irresistible para los bots. */}
        <label style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
          No rellenar
          <input name="web_extra" tabIndex={-1} autoComplete="off" />
        </label>

        <label className="f-campo">
          <span className="etq">Nombre de la {nombre} *</span>
          <input name="nombre" required maxLength={255} placeholder={esExperiencia ? "Visita guiada al casco antiguo" : "Peluquería Central"} />
        </label>

        <label className="f-campo">
          <span className="etq">Categoría</span>
          <select name="categoria" defaultValue="">
            <option value="">Sin especificar</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="f-campo">
          <span className="etq">Descripción</span>
          <textarea name="descripcion" rows={5} maxLength={4000} placeholder="Qué se ofrece, a quién va dirigido y qué incluye." />
        </label>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="f-campo" style={{ flex: "1 1 220px" }}>
            <span className="etq">Municipio *</span>
            <input name="municipio" required maxLength={128} />
          </label>
          <label className="f-campo" style={{ flex: "1 1 220px" }}>
            <span className="etq">Provincia *</span>
            <input name="provincia" required maxLength={128} />
          </label>
        </div>

        <label className="f-campo">
          <span className="etq">Dirección</span>
          <input name="direccion" maxLength={255} placeholder="Calle, número y código postal" />
        </label>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="f-campo" style={{ flex: "1 1 220px" }}>
            <span className="etq">Web oficial</span>
            <input name="web" maxLength={512} placeholder="https://…" />
          </label>
          <label className="f-campo" style={{ flex: "1 1 180px" }}>
            <span className="etq">Teléfono</span>
            <input name="telefono" maxLength={40} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="f-campo" style={{ flex: "1 1 220px" }}>
            <span className="etq">Correo de contacto *</span>
            <input name="email" type="email" required maxLength={191} />
          </label>
          <label className="f-campo" style={{ flex: "1 1 160px" }}>
            <span className="etq">Precio (si lo publicas)</span>
            <input name="precio" inputMode="decimal" placeholder="Por ejemplo 15" />
          </label>
        </div>

        <label className="f-campo">
          <span className="etq">Quién lo organiza o presta</span>
          <input name="organizador" maxLength={255} placeholder="Nombre del negocio o entidad" />
        </label>

        <p className="m" style={{ color: "var(--muted-fg)", fontSize: 12.5 }}>
          * Obligatorios. Lo que envíes se revisa antes de publicarse: no entra directo al catálogo. Tus
          datos se tratan según la <Link href="/privacidad">política de privacidad</Link>.
        </p>

        <div className="f-acciones">
          <button className="f-aplicar" type="submit">
            Enviar para revisión
          </button>
        </div>
      </form>
    </>
  );
}
