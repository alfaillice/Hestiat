// Componente «Contactar con el establecimiento» para fichas de DIRECTORIO.
//
// Regla central: solo se muestra un canal si existe de verdad. No hay botón vacío,
// no hay enlace a un intermediario y el contacto va SIEMPRE al establecimiento,
// nunca a Hestiat ni al administrador.
//
// Reutiliza los botones ya existentes (components/botones-contacto.tsx) en lugar de
// duplicar la lógica de WhatsApp / llamada / correo / web. El filtro de qué es
// publicable lo aplica ese componente con publicables(), no este.

import BotonesContacto from "@/components/botones-contacto";
import type { ContactoPublicacion } from "@/lib/contacto.server";

export type CanalDirectorio = {
  web?: string | null;
  telefono?: string | null;
  email?: string | null;
  whatsapp?: string | null;
};

export type FichaDirectorioVista = {
  nombre: string;
  localidad?: string | null;
  provincia?: string | null;
  canales: CanalDirectorio;
  fuenteOrigen?: string | null;
  fechaComprobacion?: string | null;
  estadoValidacion?: string | null;
  estadoReclamacion?: string | null;
  urlPublica?: string | null;
};

/** Traduce la ficha de directorio al contrato plano de ContactoPublicacion. */
export function contactoDesdeDirectorio(c: CanalDirectorio): ContactoPublicacion {
  const limpio = (v?: string | null) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  return {
    nombre: null,
    telefono: limpio(c.telefono),
    whatsapp: limpio(c.whatsapp),
    email: limpio(c.email),
    web: limpio(c.web),
    direccion: null,
    enlace: null,
    // El piloto comprobó técnicamente estas webs y canales antes de crear el borrador,
    // así que el contacto entra como verificado. Un canal sin comprobar no se publica.
    estado: "verified",
    confianza: "high",
    verificadoEn: null,
    nota: null,
  };
}

export function ContactarEstablecimiento({ ficha }: { ficha: FichaDirectorioVista }) {
  const canales = ficha.canales;
  const hayAlgunCanal = Boolean(canales.web || canales.telefono || canales.email || canales.whatsapp);

  return (
    <section className="ficha-directorio-contacto" aria-labelledby="contacto-establecimiento">
      <h2 id="contacto-establecimiento">Contactar con el establecimiento</h2>

      {/* Transparencia: el visitante debe saber qué está viendo. */}
      <p className="ficha-directorio-aviso">
        Ficha informativa de directorio. El contacto va directamente al establecimiento.
        El establecimiento no gestiona necesariamente esta publicación.
        {ficha.fuenteOrigen ? <> Fuente: {ficha.fuenteOrigen}.</> : null}
        {ficha.fechaComprobacion ? <> Datos comprobados el {ficha.fechaComprobacion}.</> : null}
      </p>

      {hayAlgunCanal ? (
        <BotonesContacto
          contacto={contactoDesdeDirectorio(canales)}
          nombre={ficha.nombre}
          urlPublica={ficha.urlPublica ?? "https://hestiat.com"}
        />
      ) : (
        <p className="ficha-directorio-sin-canal">
          Este establecimiento no tiene ningún canal de contacto disponible en este momento.
        </p>
      )}

      {/* Reclamación: el propietario legítimo puede tomar el control de la ficha. */}
      {ficha.estadoReclamacion !== "reclamada" && (
        <p className="ficha-directorio-reclamar">
          ¿Eres el propietario o responsable?{" "}
          <a href={`/reclamar?nombre=${encodeURIComponent(ficha.nombre)}`}>
            Reclama esta ficha
          </a>{" "}
          para gestionarla, corregirla o solicitar su retirada.
        </p>
      )}
    </section>
  );
}
