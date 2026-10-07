"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Medios, { type FotoMedio } from "@/components/medios";
import Calendarios, { type EstadoCanalVista } from "@/components/calendarios";
import CalendarioEditor from "@/components/calendario-editor";
import MapaEditor from "@/components/mapa-editor";
import type { AlojamientoEditable, ServicioDiccionario } from "@/lib/editor.server";

/**
 * Centro de gestión del alojamiento: UN editor para anfitriones y administradores.
 *
 * No existe ningún otro editor. Lo que cambia según el rol son los permisos —y se aplican en el
 * servidor, no ocultando botones— más la pestaña de administración, que solo ve un administrador.
 *
 * Cada sección es un formulario POST normal: funciona sin JavaScript y el servidor responde
 * redirigiendo a la misma pestaña con el resultado. Encima hay dos comodidades que no cambian la
 * lógica: el aviso de cambios sin guardar (para no perderlos al navegar) y el estado «Guardando…».
 */
const TIPOS = ["Hotel", "Apartamento", "Casa", "Villa", "Chalet", "Habitación", "Casa rural", "Otros"];

export interface EstadoInfo {
  id: string;
  etiqueta: string;
  explicacion: string;
  soloAdmin: boolean;
}

export interface PropietarioOpcion {
  id: number;
  nombre: string;
  rol: string;
}

type Pestana = "general" | "fotos" | "precios" | "caracteristicas" | "disponibilidad" | "calendarios" | "reglas" | "publicacion";

/** Formulario de una sección: aviso de cambios sin guardar y estado de guardado. */
function FormularioSeccion({
  accion,
  seccion,
  children,
  textoBoton,
  onSucio,
}: {
  accion: string;
  seccion: string;
  children: React.ReactNode;
  textoBoton: string;
  onSucio?: (sucio: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    onSucio?.(sucio);
  }, [sucio, onSucio]);

  return (
    <form
      action={accion}
      method="post"
      className="editor-seccion"
      onChange={() => setSucio(true)}
      onSubmit={() => {
        setSucio(false);
        setEnviando(true);
      }}
    >
      <input type="hidden" name="seccion" value={seccion} />
      {children}
      <div className="f-acciones">
        <button className="f-aplicar" type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : textoBoton}
        </button>
        {enviando ? (
          <span className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>Guardando…</span>
        ) : sucio ? (
          <span className="m" style={{ fontSize: 13, color: "var(--accent-fg)" }}>
            Tienes cambios sin guardar. Pulsa el botón para guardarlos.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export default function EditorAlojamiento({
  alojamiento: a,
  servicios,
  fotos,
  canales,
  esAdmin,
  estado,
  estados,
  propietarios,
  propietarioActual,
  pestanaInicial,
  mensaje,
  datos,
}: {
  alojamiento: AlojamientoEditable;
  servicios: ServicioDiccionario[];
  fotos: FotoMedio[];
  canales: EstadoCanalVista[];
  esAdmin: boolean;
  estado: string;
  estados: EstadoInfo[];
  propietarios: PropietarioOpcion[];
  propietarioActual: { id: number; nombre: string } | null;
  pestanaInicial: Pestana;
  mensaje: { tipo: "ok" | "error"; texto: string } | null;
  datos: { reservas: number; nochesBloqueadas: number; nochesImportadas: number };
}) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [aviso, setAviso] = useState(mensaje);

  useEffect(() => setAviso(mensaje), [mensaje]);

  /*
   * Aquí había un aviso del navegador («¿quieres abandonar la página?») cuando quedaba algo sin
   * guardar. Se quita: saltaba también al guardar y al eliminar, porque el formulario ya estaba
   * marcado como modificado mientras el servidor respondía con la redirección. Molestaba más de lo
   * que ayudaba, y las acciones destructivas ya tienen su propia confirmación.
   *
   * Lo que se conserva es el aviso EN LA PÁGINA («Tienes cambios sin guardar»), que informa sin
   * interrumpir.
   */

  // Vista previa del precio: la calcula el SERVIDOR con la misma función que la reserva.
  const [noches, setNoches] = useState(3);
  const [huespedes, setHuespedes] = useState(Math.min(2, Math.max(1, a.capacidad || 2)));
  const [desglose, setDesglose] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      setCalculando(true);
      try {
        const r = await fetch("/api/precio-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ legacyId: a.legacyId, noches, huespedes, valores: {} }),
        });
        const d = await r.json();
        if (vigente && d?.ok) setDesglose(d.desglose);
      } catch {
        if (vigente) setDesglose(null);
      } finally {
        if (vigente) setCalculando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [a.legacyId, noches, huespedes, pestana]);

  const url = `/api/alojamientos/${a.legacyId}`;

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: "general", texto: "General" },
    { id: "fotos", texto: `Fotos (${fotos.length})` },
    { id: "precios", texto: "Precio" },
    { id: "caracteristicas", texto: "Características" },
    { id: "disponibilidad", texto: "Disponibilidad" },
    { id: "calendarios", texto: `Calendarios (${canales.filter((c) => c.conectado).length})` },
    { id: "reglas", texto: "Reglas" },
    { id: "publicacion", texto: "Publicación" },
  ];

  return (
    <div className="editor">
      {aviso && (
        <p
          className="aviso"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: aviso.tipo === "error" ? "var(--destructive)" : "var(--primary)",
            color: aviso.tipo === "error" ? "var(--destructive)" : "var(--foreground)",
          }}
        >
          {aviso.texto}
        </p>
      )}

      <nav className="editor-pestanas" aria-label="Secciones del editor">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            className={"editor-pestana" + (pestana === p.id ? " editor-pestana-activa" : "")}
            aria-current={pestana === p.id}
            onClick={() => setPestana(p.id)}
          >
            {p.texto}
          </button>
        ))}
      </nav>

      {/* ------------------------------------------------------------- general -- */}
      {pestana === "general" && (
        <FormularioSeccion accion={url} seccion="general" textoBoton="Guardar información general">
          <h2>Información general</h2>

          <label className="f-campo">
            <span className="etq">Nombre del alojamiento</span>
            <input name="titulo" defaultValue={a.titulo} maxLength={255} required />
          </label>

          <div className="fila-2">
            <label className="f-campo">
              <span className="etq">Tipo de alojamiento</span>
              <select name="tipo" defaultValue={a.tipo}>
                <option value="">Sin especificar</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="f-campo">
              <span className="etq">Categoría (texto del catálogo)</span>
              <input name="categoria" defaultValue={a.categoria} maxLength={80} />
            </label>
          </div>

          <label className="f-campo">
            <span className="etq">Descripción corta</span>
            <input name="descripcionCorta" defaultValue={a.descripcionCorta} maxLength={300} />
          </label>

          <label className="f-campo">
            <span className="etq">Descripción</span>
            <textarea name="descripcion" defaultValue={a.descripcion} rows={8} maxLength={20000} />
          </label>

          <h3>Ubicación</h3>
          <div className="fila-2">
            <label className="f-campo">
              <span className="etq">Dirección</span>
              <input name="direccion" defaultValue={a.direccion} maxLength={255} />
            </label>
            <label className="f-campo">
              <span className="etq">Código postal</span>
              <input name="codigoPostal" defaultValue={a.codigoPostal} maxLength={16} />
            </label>
          </div>
          <div className="fila-2">
            <label className="f-campo">
              <span className="etq">Ciudad</span>
              <input name="ciudad" defaultValue={a.ciudad} maxLength={120} />
            </label>
            <label className="f-campo">
              <span className="etq">Provincia</span>
              <input name="provincia" defaultValue={a.provincia} maxLength={120} />
            </label>
          </div>
          <div className="fila-2">
            <label className="f-campo">
              <span className="etq">País (dos letras)</span>
              <input name="pais" defaultValue={a.pais} maxLength={2} />
            </label>
            <label className="f-campo">
              <span className="etq">Privacidad de la ubicación</span>
              <select name="ubicacionPrivacidad" defaultValue={a.ubicacionPrivacidad}>
                <option value="exacta">Ubicación exacta</option>
                <option value="aproximada">Ubicación aproximada (zona, no la dirección)</option>
              </select>
            </label>
          </div>

          <MapaEditor latInicial={a.lat} lngInicial={a.lng} direccion={a.direccion} ciudad={a.ciudad} provincia={a.provincia} />

          <h3>Capacidad y distribución</h3>
          <div className="fila-4">
            <label className="f-campo"><span className="etq">Huéspedes</span><input name="capacidad" type="number" min="0" defaultValue={a.capacidad || ""} /></label>
            <label className="f-campo"><span className="etq">Habitaciones</span><input name="habitaciones" type="number" min="0" defaultValue={a.habitaciones || ""} /></label>
            <label className="f-campo"><span className="etq">Camas</span><input name="camas" type="number" min="0" defaultValue={a.camas || ""} /></label>
            <label className="f-campo"><span className="etq">Baños</span><input name="banos" type="number" min="0" defaultValue={a.banos || ""} /></label>
          </div>
        </FormularioSeccion>
      )}

      {/* ---------------------------------------------------------------- fotos -- */}
      {pestana === "fotos" && (
        <div className="editor-seccion">
          <h2>Fotografías</h2>
          <p className="editor-nota">
            Las que subas aquí son las que ve el huésped: se guardan en el almacenamiento propio y se
            reflejan a la vez en el panel y en la ficha pública. La primera es la imagen principal.
          </p>
          <Medios alojamientoId={a.legacyId} fotos={fotos} />
        </div>
      )}

      {/* -------------------------------------------------------------- precios -- */}
      {pestana === "precios" && (
        <FormularioSeccion accion={url} seccion="precios" textoBoton="Guardar precios">
          <h2>Precio</h2>
          <p className="editor-nota">
            Hestiat no cobra comisión. Lo que sumes aquí (limpieza, tasas, impuestos) es del anfitrión y
            solo se aplica si lo defines. Mientras esté vacío, el total es exactamente noches × precio.
          </p>

          <div className="fila-2">
            <label className="f-campo"><span className="etq">Precio por noche (€)</span><input name="precioNoche" type="number" min="0" step="1" defaultValue={a.precioNoche ?? ""} /></label>
            <label className="f-campo"><span className="etq">Precio orientativo (€)</span><input name="precioOrientativo" type="number" min="0" step="1" defaultValue={a.precioOrientativo ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Precio mínimo (€)</span><input name="precioMinimo" type="number" min="0" step="1" defaultValue={a.precioMinimo ?? ""} /></label>
            <label className="f-campo"><span className="etq">Precio máximo (€)</span><input name="precioMaximo" type="number" min="0" step="1" defaultValue={a.precioMaximo ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Limpieza por estancia (€)</span><input name="limpieza" type="number" min="0" step="1" defaultValue={a.limpieza ?? ""} /></label>
            <label className="f-campo"><span className="etq">Tasas por estancia (€)</span><input name="tasas" type="number" min="0" step="1" defaultValue={a.tasas ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Impuestos (%)</span><input name="impuestosPct" type="number" min="0" max="40" step="0.1" defaultValue={a.impuestosPct ?? ""} /></label>
            <label className="f-campo"><span className="etq">Huésped adicional (€ / noche)</span><input name="precioHuespedExtra" type="number" min="0" step="1" defaultValue={a.precioHuespedExtra ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Descuento semanal (%)</span><input name="descuentoSemanal" type="number" min="0" max="90" step="0.1" defaultValue={a.descuentoSemanal ?? ""} /></label>
            <label className="f-campo"><span className="etq">Descuento mensual (%)</span><input name="descuentoMensual" type="number" min="0" max="90" step="0.1" defaultValue={a.descuentoMensual ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Moneda</span><input name="moneda" defaultValue={a.moneda} maxLength={3} /></label>
            <label className="f-chip" style={{ alignSelf: "flex-end", marginBottom: 10 }}>
              <input type="checkbox" name="reservaInmediata" value="1" defaultChecked={a.reservaInmediata} />
              <span>Reserva inmediata</span>
            </label>
          </div>

          <div className="editor-preview">
            <p className="editor-preview-titulo">Vista previa del precio (con lo guardado)</p>
            <div className="fila-2">
              <label className="f-campo"><span className="etq">Noches</span><input type="number" min="1" max="365" value={noches} onChange={(e) => setNoches(Math.max(1, Number(e.target.value) || 1))} /></label>
              <label className="f-campo"><span className="etq">Huéspedes</span><input type="number" min="1" max={Math.max(1, a.capacidad || 30)} value={huespedes} onChange={(e) => setHuespedes(Math.max(1, Number(e.target.value) || 1))} /></label>
            </div>
            {desglose ? (
              <ul className="editor-preview-lista">
                <li><span>Precio por noche</span><span>{Number(desglose.precioNoche).toLocaleString("es-ES")} {desglose.moneda}</span></li>
                <li><span>{desglose.noches} {desglose.noches === 1 ? "noche" : "noches"}</span><span>{Number(desglose.base).toLocaleString("es-ES")} {desglose.moneda}</span></li>
                {Number(desglose.limpieza) > 0 && <li><span>Limpieza</span><span>{Number(desglose.limpieza).toLocaleString("es-ES")} {desglose.moneda}</span></li>}
                {Number(desglose.tasas) > 0 && <li><span>Tasas</span><span>{Number(desglose.tasas).toLocaleString("es-ES")} {desglose.moneda}</span></li>}
                {Number(desglose.importeHuespedesExtra) > 0 && <li><span>Huéspedes adicionales</span><span>{Number(desglose.importeHuespedesExtra).toLocaleString("es-ES")} {desglose.moneda}</span></li>}
                {Number(desglose.importeDescuento) > 0 && <li><span>Descuento {desglose.descuentoPct} %</span><span>−{Number(desglose.importeDescuento).toLocaleString("es-ES")} {desglose.moneda}</span></li>}
                {Number(desglose.impuestos) > 0 && <li><span>Impuestos {desglose.impuestosPct} %</span><span>{Number(desglose.impuestos).toLocaleString("es-ES")} {desglose.moneda}</span></li>}
                <li className="editor-preview-total"><span>Total</span><span>{Number(desglose.total).toLocaleString("es-ES")} {desglose.moneda}</span></li>
              </ul>
            ) : (
              <p className="m" style={{ color: "var(--muted-fg)", fontSize: 13 }}>{calculando ? "Calculando…" : "Sin precio definido."}</p>
            )}
            <p className="m" style={{ fontSize: 12, color: "var(--muted-fg)" }}>
              Calculado por el servidor con los datos guardados y la misma función que usa la reserva.
            </p>
            {desglose?.avisos?.length > 0 && <p className="m" style={{ fontSize: 13, color: "var(--accent-fg)" }}>{desglose.avisos.join(" ")}</p>}
          </div>
        </FormularioSeccion>
      )}

      {/* ------------------------------------------------------- caracteristicas -- */}
      {pestana === "caracteristicas" && (
        <FormularioSeccion accion={url} seccion="caracteristicas" textoBoton="Guardar características">
          <h2>Características</h2>
          <p className="editor-nota">
            Estas casillas son exactamente lo que muestra la ficha pública. El catálogo es ampliable:
            añadir una característica nueva es añadir una fila al diccionario, sin tocar el código.
          </p>
          <div className="editor-servicios">
            {servicios.map((s) => (
              <label key={s.id} className="f-chip editor-servicio">
                <input type="checkbox" name="servicios" value={s.id} defaultChecked={s.activo} />
                <span>{s.nombre}</span>
              </label>
            ))}
          </div>
        </FormularioSeccion>
      )}

      {/* -------------------------------------------------------- disponibilidad -- */}
      {pestana === "disponibilidad" && (
        <div className="editor-seccion">
          <h2>Disponibilidad</h2>
          <p className="editor-nota">
            {datos.nochesBloqueadas} {datos.nochesBloqueadas === 1 ? "noche bloqueada" : "noches bloqueadas"} en total ·{" "}
            {datos.nochesImportadas} procedentes de calendarios externos · {datos.reservas}{" "}
            {datos.reservas === 1 ? "reserva" : "reservas"} registradas. La disponibilidad combina las tres cosas:
            reservas de Hestiat, bloqueos manuales y calendarios externos.
          </p>
          <CalendarioEditor alojamientoId={a.legacyId} />
        </div>
      )}

      {/* ----------------------------------------------------------- calendarios -- */}
      {pestana === "calendarios" && (
        <div className="editor-seccion">
          <h2>Calendarios externos</h2>
          <p className="editor-nota">
            Conexión por iCalendar (el mecanismo que Airbnb, Booking, Vrbo y Google Calendar ofrecen sin
            contrato de partner). La sincronización de cada calendario se puede pausar y reanudar, y las
            noches importadas se distinguen de las reservas de Hestiat en la pestaña de Disponibilidad.
          </p>
          <Calendarios alojamientoId={a.legacyId} canales={canales} />
        </div>
      )}

      {/* --------------------------------------------------------------- reglas -- */}
      {pestana === "reglas" && (
        <FormularioSeccion accion={url} seccion="reglas" textoBoton="Guardar reglas">
          <h2>Reglas del alojamiento</h2>
          <p className="editor-nota">
            Lo que se deja en blanco no se muestra en la ficha: no se inventa ninguna norma.
          </p>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Entrada (check-in)</span><input name="check_in" placeholder="16:00" maxLength={5} defaultValue={a.checkIn ?? ""} /></label>
            <label className="f-campo"><span className="etq">Salida (check-out)</span><input name="check_out" placeholder="11:00" maxLength={5} defaultValue={a.checkOut ?? ""} /></label>
          </div>
          <div className="fila-2">
            <label className="f-campo"><span className="etq">Estancia mínima (noches)</span><input name="estancia_minima" type="number" min="0" defaultValue={a.estanciaMinima ?? ""} /></label>
            <label className="f-campo"><span className="etq">Estancia máxima (noches)</span><input name="estancia_maxima" type="number" min="0" defaultValue={a.estanciaMaxima ?? ""} /></label>
          </div>
          <div className="fila-3">
            <label className="f-campo">
              <span className="etq">¿Se admiten mascotas?</span>
              <select name="admite_mascotas" defaultValue={a.admiteMascotas === null ? "" : a.admiteMascotas ? "1" : "0"}>
                <option value="">Sin especificar</option>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </label>
            <label className="f-campo">
              <span className="etq">¿Se puede fumar?</span>
              <select name="admite_fumadores" defaultValue={a.admiteFumadores === null ? "" : a.admiteFumadores ? "1" : "0"}>
                <option value="">Sin especificar</option>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </label>
            <label className="f-campo">
              <span className="etq">¿Se permiten fiestas o eventos?</span>
              <select name="admite_fiestas" defaultValue={a.admiteFiestas === null ? "" : a.admiteFiestas ? "1" : "0"}>
                <option value="">Sin especificar</option>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </label>
          </div>
          <label className="f-campo">
            <span className="etq">Edad mínima del huésped principal</span>
            <input name="edad_minima" type="number" min="0" max="100" defaultValue={a.edadMinima ?? ""} />
          </label>
          <p className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>
            El número máximo de huéspedes se define en la pestaña General (capacidad).
          </p>
          <label className="f-campo">
            <span className="etq">Otras reglas</span>
            <textarea name="reglas_extra" rows={4} maxLength={1000} defaultValue={a.reglasExtra ?? ""} placeholder="Por ejemplo: no se admiten grupos de despedidas." />
          </label>
        </FormularioSeccion>
      )}

      {/* ----------------------------------------------------------- publicacion -- */}
      {pestana === "publicacion" && (
        <>
          <FormularioSeccion accion={url} seccion="publicacion" textoBoton="Guardar estado">
            <h2>Publicación</h2>
            <p className="editor-nota">
              Estado actual: <strong>{estados.find((e) => e.id === estado)?.etiqueta ?? estado}</strong>.{" "}
              {estados.find((e) => e.id === estado)?.explicacion ?? ""}
            </p>
            <label className="f-campo">
              <span className="etq">Cambiar a</span>
              <select name="estado" defaultValue={estado}>
                {estados
                  .filter((e) => esAdmin || !e.soloAdmin)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.etiqueta} · {e.explicacion}</option>
                  ))}
              </select>
            </label>
            {!esAdmin && (
              <p className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>
                El estado «Bloqueado» solo lo puede poner la administración.
              </p>
            )}
          </FormularioSeccion>

          <div className="editor-seccion" style={{ marginTop: 16 }}>
            <h2>Anfitrión del alojamiento</h2>
            <ul className="editor-datos">
              <li>
                <span>Propietario actual</span>
                <span>{propietarioActual ? propietarioActual.nombre : "sin asignar"}</span>
              </li>
            </ul>
            {esAdmin ? (
              <FormularioSeccion accion={url} seccion="propietario" textoBoton="Cambiar propietario">
                <p className="editor-nota">
                  Solo la administración puede cambiar el propietario de un alojamiento. La relación es la
                  real de la base de datos: no se copian datos del anfitrión dentro del alojamiento.
                </p>
                <label className="f-campo">
                  <span className="etq">Nuevo propietario</span>
                  <select name="usuario_id" defaultValue={propietarioActual?.id ?? ""}>
                    <option value="">— elegir —</option>
                    {propietarios.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} · {p.rol}</option>
                    ))}
                  </select>
                </label>
              </FormularioSeccion>
            ) : (
              <p className="m" style={{ fontSize: 13, color: "var(--muted-fg)" }}>
                Un anfitrión no puede transferir la propiedad de su alojamiento.
              </p>
            )}
          </div>

          {esAdmin && (
            <>
              <div className="editor-seccion" style={{ marginTop: 16 }}>
                <h2>Información administrativa</h2>
                <ul className="editor-datos">
                  <li><span>Identificador interno</span><span>#{a.legacyId}</span></li>
                  <li><span>Identificador en el catálogo público</span><span>{a.nuevoId ?? "sin fila en el catálogo"}</span></li>
                  <li><span>Estado en el catálogo</span><span>{a.estadoPublico}</span></li>
                  <li><span>Tipo de precio</span><span>{a.priceType || "no definido"}</span></li>
                  <li><span>Fotografías</span><span>{fotos.length}</span></li>
                  <li><span>Reservas</span><span>{datos.reservas}</span></li>
                </ul>
              </div>

              <div className="editor-seccion editor-peligro" style={{ marginTop: 16 }}>
                <h2>Eliminar el alojamiento</h2>
                <p className="editor-nota">
                  Esta acción no se puede deshacer: borra el alojamiento, sus fotografías, sus servicios,
                  su disponibilidad y sus calendarios. No se elimina si tiene reservas asociadas —en ese
                  caso lo correcto es desactivarlo—.
                </p>
                <FormularioSeccion accion={url} seccion="eliminar" textoBoton="Eliminar definitivamente">
                  <label className="f-campo">
                    <span className="etq">Escribe el nombre del alojamiento para confirmar</span>
                    <input name="confirmacion" placeholder={a.titulo} maxLength={255} />
                  </label>
                </FormularioSeccion>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
