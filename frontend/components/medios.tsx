"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

export interface FotoMedio {
  id: number;
  url: string;
  alt: string | null;
  orden: number;
  ancho: number | null;
  alto: number | null;
}

/**
 * Gestor de medios — portado de `medios.tsx` de la aplicación antigua.
 *
 * Uno solo para el panel del anfitrión y para la administración: una única implementación, como
 * exige el proyecto. Sube fotos reales (multipart), permite reordenarlas y borrarlas, y tras cada
 * cambio refresca los datos del servidor para que la vista muestre lo que hay en la base.
 *
 * La autorización NO vive aquí: el componente solo llama a la API, y es el servidor el que
 * comprueba la sesión y la propiedad del alojamiento en cada petición.
 */
export default function Medios({
  alojamientoId,
  fotos,
  soloLectura = false,
}: {
  alojamientoId: number;
  fotos: FotoMedio[];
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const lista = [...fotos].sort((a, b) => a.orden - b.orden);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);

  /**
   * Subida con progreso real. `fetch` no informa del avance de una subida, así que aquí se usa
   * XMLHttpRequest a propósito: el anfitrión puede subir varias fotos y merece ver que avanza.
   */
  function subir(ficheros: FileList | null) {
    if (!ficheros || ficheros.length === 0) return;
    const datos = new FormData();
    datos.set("alojamientoId", String(alojamientoId));
    for (const f of Array.from(ficheros)) datos.append("fotos", f);

    setOcupado(true);
    setMensaje(null);
    setProgreso(0);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/medios");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgreso(null);
      setOcupado(false);
      let r: { ok?: boolean; guardadas?: unknown[]; errores?: string[]; error?: string } = {};
      try {
        r = JSON.parse(xhr.responseText);
      } catch {
        r = { ok: false, error: "Respuesta no válida del servidor." };
      }
      if (!r.ok) {
        setMensaje({ tipo: "error", texto: r.error ?? "No se han podido subir las fotos." });
        return;
      }
      const n = r.guardadas?.length ?? 0;
      setMensaje({
        tipo: r.errores?.length ? "error" : "ok",
        texto: `${n} ${n === 1 ? "foto subida" : "fotos subidas"}.${r.errores?.length ? ` Avisos: ${r.errores.join(" ")}` : ""}`,
      });
      if (entrada.current) entrada.current.value = "";
      startTransition(() => router.refresh());
    };
    xhr.onerror = () => {
      setProgreso(null);
      setOcupado(false);
      setMensaje({ tipo: "error", texto: "No se ha podido completar la subida." });
    };
    xhr.send(datos);
  }

  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/medios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alojamientoId, ...cuerpo }),
      });
      const r = (await res.json()) as { ok: boolean; error?: string };
      if (!r.ok) throw new Error(r.error ?? "La operación no se ha podido completar.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMensaje({ tipo: "error", texto: error instanceof Error ? error.message : "Error." });
    } finally {
      setOcupado(false);
    }
  }

  /** Reordena moviendo una foto de una posición a otra (lo usan las flechas y el arrastre). */
  function reordenarA(desde: number, hasta: number) {
    if (desde === hasta) return;
    const ids = lista.map((f) => f.id);
    const [movida] = ids.splice(desde, 1);
    ids.splice(hasta, 0, movida);
    void enviar({ accion: "reordenar", ids });
  }

  function mover(indice: number, salto: number) {
    const destino = indice + salto;
    if (destino < 0 || destino >= lista.length) return;
    reordenarA(indice, destino);
  }

  const trabajando = ocupado || pendiente;
  const principal = lista[0]?.id ?? null;

  return (
    <div className="medios">
      <div className="medios-cab">
        <h2>Fotografías</h2>
        <p className="m" style={{ color: "var(--muted-fg)" }}>
          {lista.length} {lista.length === 1 ? "imagen" : "imágenes"} · la primera es la que se ve en los resultados
        </p>
      </div>

      {mensaje && (
        <p className="aviso" style={mensaje.tipo === "error" ? { borderColor: "var(--destructive)", color: "var(--destructive)" } : undefined}>
          {mensaje.texto}
        </p>
      )}

      {!soloLectura && (
        <div className="medios-subir">
          <input
            ref={entrada}
            type="file"
            name="fotos"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => void subir(e.target.files)}
            disabled={trabajando}
          />
          <span className="m" style={{ color: "var(--muted-fg)" }}>
            JPG, PNG o WebP. Se optimizan solas y se guardan en el almacenamiento propio.
          </span>
          {progreso !== null && (
            <div className="medio-progreso" role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progreso}%` }} />
              <em>{progreso} %</em>
            </div>
          )}
        </div>
      )}

      {lista.length === 0 ? (
        <p className="aviso">Este alojamiento todavía no tiene fotografías.</p>
      ) : (
        <ul className="medios-rejilla">
          {lista.map((f, i) => (
            <li
              key={f.id}
              className={"medio" + (arrastrando === i ? " medio-arrastrando" : "")}
              draggable={!soloLectura && !trabajando}
              onDragStart={() => setArrastrando(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastrando !== null) reordenarA(arrastrando, i);
                setArrastrando(null);
              }}
              onDragEnd={() => setArrastrando(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.alt ?? ""} width={f.ancho ?? undefined} height={f.alto ?? undefined} />
              <span className="medio-orden">{i === 0 ? "Principal" : `#${i + 1}`}</span>
              {!soloLectura && (
                <span className="medio-acciones">
                  {f.id !== principal && (
                    <button
                      type="button"
                      className="medio-principal"
                      disabled={trabajando}
                      title="Usar como foto principal"
                      onClick={() => void enviar({ accion: "principal", fotoId: f.id })}
                    >
                      ★
                    </button>
                  )}
                  <button type="button" onClick={() => mover(i, -1)} disabled={trabajando || i === 0} title="Mover antes">
                    ↑
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={trabajando || i === lista.length - 1} title="Mover después">
                    ↓
                  </button>
                  <button
                    type="button"
                    className="medio-borrar"
                    disabled={trabajando}
                    title="Borrar"
                    onClick={() => {
                      if (confirm("¿Borrar esta fotografía? Se elimina del alojamiento y del almacenamiento.")) {
                        void enviar({ accion: "eliminar", fotoId: f.id });
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
