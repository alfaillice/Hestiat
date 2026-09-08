"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { saveListingStep } from "../../../lib/host-draft";

type Photo = { id: string; url: string; name: string; isCover: boolean };

export default function FotosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    try {
      const raw = localStorage.getItem("hestiat_host_draft");
      const draft = raw ? JSON.parse(raw) : null;
      if (!draft?.id) throw new Error("No existe un borrador activo.");

      for (const file of Array.from(files)) {
        if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
          throw new Error("Solo JPG, PNG o WEBP.");
        }
        if (file.size > 12 * 1024 * 1024) throw new Error("Cada imagen debe pesar menos de 20 MB.");

        const presign = await fetch(`/api/anfitrion/alojamientos/${draft.id}/fotos/presign`, {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size })
        });
        const signed = await presign.json();
        if (!presign.ok) throw new Error(signed.error || "No se pudo preparar la subida.");

        const put = await fetch(signed.uploadUrl, {
          method: "PUT", headers: {"Content-Type": file.type}, body: file
        });
        if (!put.ok) throw new Error("La subida de una imagen ha fallado.");

        const save = await fetch(`/api/anfitrion/alojamientos/${draft.id}/fotos`, {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            url: signed.publicUrl,
            sortOrder: photos.length,
            isCover: photos.length === 0
          })
        });
        if (!save.ok) throw new Error("La imagen se ha subido pero no se pudo registrar.");

        setPhotos(p => [...p, { id: crypto.randomUUID(), url: signed.publicUrl, name: file.name, isCover: p.length === 0 }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron subir las imágenes.");
    } finally { setBusy(false); }
  }

  return <main className="host-onboarding">
    <header className="onboarding-header">
      <Link href="/anfitrion" className="brand">hestiat</Link>
      <div className="save-status"><span/> {busy ? "Subiendo…" : "Guardado automáticamente"}</div>
      <Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link>
    </header>
    <section className="form-shell photos-shell">
      <div className="form-heading"><p className="eyebrow">PASO 5 DE 11</p><h1>Haz que quieran entrar.</h1><p>Sube las mejores imágenes de tu alojamiento.</p></div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>upload(e.target.files)}/>
      <button className="upload-zone" onClick={()=>inputRef.current?.click()} disabled={busy}>
        <div className="upload-icon">↑</div><strong>{busy ? "Subiendo imágenes…" : "Selecciona tus fotos"}</strong>
        <span>JPG, PNG o WEBP · máximo 12 MB por imagen</span>
      </button>
      {error && <p className="draft-error">{error}</p>}
      {photos.length > 0 && <div className="photo-grid real-photo-grid">
        {photos.map((p,i)=><div className={`photo-item ${i===0?"cover":""}`} key={p.id}>
          <img src={p.url} alt={p.name}/>{p.isCover&&<span className="cover-badge">PORTADA</span>}
          <div className="photo-label">{p.name}</div>
        </div>)}
        <button className="add-photo-card" onClick={()=>inputRef.current?.click()}><span>+</span><strong>Añadir fotos</strong></button>
      </div>}
      <div className="photo-note"><span>✦</span><div><strong>Subida directa y optimizada</strong><p>Las imágenes se cargan directamente en almacenamiento compatible con Cloudflare R2 mediante una URL firmada; el servidor no necesita recibir el archivo.</p></div></div>
      <div className="form-actions"><Link href="/anfitrion/nuevo/servicios" className="secondary-btn">← Atrás</Link><Link href="/anfitrion/nuevo/descripcion" className="primary-btn">Continuar →</Link></div>
    </section>
  </main>;
}
