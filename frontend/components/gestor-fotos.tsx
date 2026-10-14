"use client";

import { useEffect, useRef, useState } from "react";

/**
 * GESTOR DE FOTOGRAFÍAS — UN COMPONENTE PARA LOS TRES TIPOS.
 *
 * ── POR QUÉ NO SE LLAMA «GALERÍA» ───────────────────────────────────────────────────────────────
 * `galeria.tsx` y `galeria-alojamientos.tsx` son componentes de VISUALIZACIÓN pública (lightbox de
 * ficha, scroll infinito del listado). Este es de GESTIÓN: subir, ordenar, marcar principal y
 * borrar. Nombrarlo distinto evita que parezca —y que acabe siendo— un sistema paralelo.
 *
 * ── AUTOCONTENIDO ───────────────────────────────────────────────────────────────────────────────
 * Solo necesita `tipo` e `itemId`. No sabe nada de alojamientos, experiencias ni servicios por
 * dentro: por eso el mismo componente sirve para los tres formularios sin adaptarlo.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────────────────────────
 * No decide nada por su cuenta: todo pasa por la ruta de administración, que valida en el servidor
 * (permisos, bytes del archivo, tamaño) y es la que manda. Aquí solo se muestra el resultado.
 */
type Tipo = "alojamiento" | "experiencia" | "servicio";

interface Foto {
  id: number;
  url: string;
  orden: number;
  principal: boolean;
  alt: string | null;
}

export default function GestorFotos({ tipo, itemId }: { tipo: Tipo; itemId: number }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const [previsualizaciones, setPrevisualizaciones] = useState<string[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/admin/fotos?tipo=${tipo}&item=${itemId}`, { cache: "no-store" });
      const d = await r.json();
      setFotos(Array.isArray(d?.fotos) ? d.fotos : []);
    } catch {
      setAviso({ texto: "No se han podido cargar las fotografías.", ok: false });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, itemId]);

  /** SUBIR: una o varias a la vez, con previsualización inmediata y error claro si alguna falla. */
  async function subir(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;
    setTrabajando(true);
    setAviso(null);
    const lista = Array.from(archivos);

    const urls = lista.map((a) => URL.createObjectURL(a));
    setPrevisualizaciones(urls);

    let hechas = 0;
    let fallos: string[] = [];
    for (const archivo of lista) {
      const cuerpo = new FormData();
      cuerpo.set("tipo", tipo);
      cuerpo.set("item", String(itemId));
      cuerpo.set("archivo", archivo);
      try {
        const r = await fetch("/api/admin/fotos", { method: "POST", body: cuerpo });
        const d = await r.json();
        if (d?.ok) hechas++;
        else fallos.push(`${archivo.name}: ${d?.error ?? "error"}`);
      } catch {
        fallos.push(`${archivo.name}: no ha llegado al servidor`);
      }
    }

    urls.forEach((u) => URL.revokeObjectURL(u));
    setPrevisualizaciones([]);
    if (entrada.current) entrada.current.value = "";
    await cargar();
    setTrabajando(false);
    setAviso(
      fallos.length === 0
        ? { texto: hechas === 1 ? "Fotografía añadida." : `${hechas} fotografías añadidas.`, ok: true }
        : { texto: `Añadidas ${hechas}. Con problemas: ${fallos.join(" · ")}`, ok: false },
    );
  }

  /** ELIMINAR: siempre con confirmación, y avisando si el archivo compartido no se ha borrado. */
  async function eliminar(f: Foto) {
    if (!window.confirm(`¿Eliminar esta fotografía?\n\nSolo se quita de esta publicación. Si la imagen la usan otras, el archivo NO se borra del almacén.`)) return;
    setTrabajando(true);
    try {
      const r = await fetch("/api/admin/fotos", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, item: itemId, foto: f.id }),
      });
      const d = await r.json();
      if (d?.ok) {
        setFotos(Array.isArray(d.fotos) ? d.fotos : []);
        setAviso({
          texto: d.archivoBorrado
            ? "Fotografía eliminada."
            : "Fotografía quitada de esta publicación. El archivo se ha conservado porque lo usan otras.",
          ok: true,
        });
      } else {
        setAviso({ texto: d?.error ?? "No se ha podido eliminar.", ok: false });
      }
    } catch {
      setAviso({ texto: "No se ha podido eliminar la fotografía.", ok: false });
    } finally {
      setTrabajando(false);
    }
  }

  async function accion(cuerpo: Record<string, unknown>, textoOk: string) {
    setTrabajando(true);
    try {
      const r = await fetch("/api/admin/fotos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, item: itemId, ...cuerpo }),
      });
      const d = await r.json();
      if (d?.ok) {
        setFotos(Array.isArray(d.fotos) ? d.fotos : fotos);
        setAviso({ texto: textoOk, ok: true });
      } else {
        setAviso({ texto: d?.error ?? "No se ha podido guardar el cambio.", ok: false });
      }
    } catch {
      setAviso({ texto: "No se ha podido guardar el cambio.", ok: false });
    } finally {
      setTrabajando(false);
    }
  }

  /** Reordenar: se mueve en la lista y se guarda el orden nuevo. */
  function mover(indice: number, salto: -1 | 1) {
    const destino = indice + salto;
    if (destino < 0 || destino >= fotos.length) return;
    const copia = [...fotos];
    const [m] = copia.splice(indice, 1);
    copia.splice(destino, 0, m);
    setFotos(copia);
    void accion({ accion: "orden", ids: copia.map((f) => f.id) }, "Orden guardado.");
  }

  const estiloBoton = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radio-pill)",
    padding: "8px 14px",
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  return (
    <section aria-label="Fotografías" style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: "clamp(18px,2.2vw,22px)", marginBottom: 6 }}>
        Fotografías {fotos.length > 0 ? `(${fotos.length})` : ""}
      </h2>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 12 }}>
        La primera es la que se muestra como principal. Puedes subir varias a la vez.
      </p>

      {aviso ? (
        <p className="aviso" role="status" style={{ marginBottom: 10, fontWeight: 600 }}>
          {aviso.texto}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => void subir(e.target.files)}
          aria-label="Añadir fotografías"
        />
        {trabajando ? <span className="m">Guardando…</span> : null}
      </div>

      {previsualizaciones.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }} aria-live="polite">
          {previsualizaciones.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="Previsualización de la fotografía que se está subiendo" width={110} height={82} style={{ borderRadius: 8, objectFit: "cover", opacity: 0.7 }} />
          ))}
        </div>
      ) : null}

      {cargando ? (
        <p className="m">Cargando fotografías…</p>
      ) : fotos.length === 0 ? (
        <div>
          {/* El mismo diseño previsto para publicaciones sin imágenes: nada de inventar una foto. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/sin-foto.webp" alt="Sin foto disponible" width={210} height={158} style={{ borderRadius: 8 }} />
          <p className="m" style={{ marginTop: 8 }}>
            Esta publicación todavía no tiene fotografías.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {fotos.map((f, i) => (
            <li key={f.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.alt ?? "Fotografía de la publicación"} width={140} height={105} style={{ width: "100%", height: 105, objectFit: "cover", borderRadius: 6 }} />
              {f.principal ? (
                <p className="m" style={{ margin: "6px 0 4px", fontWeight: 700 }}>
                  Principal
                </p>
              ) : (
                <p className="m" style={{ margin: "6px 0 4px" }}>
                  &nbsp;
                </p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {!f.principal ? (
                  <button type="button" style={estiloBoton} disabled={trabajando} onClick={() => void accion({ accion: "principal", foto: f.id }, "Imagen principal cambiada.")}>
                    Hacer principal
                  </button>
                ) : null}
                <button type="button" style={estiloBoton} disabled={trabajando || i === 0} onClick={() => mover(i, -1)} aria-label={`Mover antes la fotografía ${i + 1}`}>
                  ↑
                </button>
                <button type="button" style={estiloBoton} disabled={trabajando || i === fotos.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover después la fotografía ${i + 1}`}>
                  ↓
                </button>
                <button type="button" style={{ ...estiloBoton, color: "#a01b1b" }} disabled={trabajando} onClick={() => void eliminar(f)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
