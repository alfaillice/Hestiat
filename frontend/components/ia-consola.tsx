"use client";

import { useState } from "react";

interface Paso {
  tipo: string;
  detalle: string;
  herramienta?: string;
  ok?: boolean;
}

interface Mensaje {
  papel: "usuario" | "asistente" | "error";
  texto: string;
  pasos?: Paso[];
  coste?: number;
  modelo?: string;
}

/**
 * Consola del AI Manager (solo administración: la página que la contiene ya está cerrada).
 *
 * Muestra las respuestas, los pasos y los errores TAL CUAL. Si el modelo no está configurado, lo
 * dice con sus palabras: no se inventa una respuesta ni se simula una conversación.
 */
export default function IaConsola({ configurada, probada, modeloEconomico, modeloPotente }: {
  configurada: boolean;
  probada: boolean;
  modeloEconomico: string;
  modeloPotente: string;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [conversacionId, setConversacionId] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [potente, setPotente] = useState(false);
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [prueba, setPrueba] = useState<string | null>(null);

  const llamar = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch("/api/admin/ia", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return r.json();
  };

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || ocupado) return;
    setOcupado(true);
    setEntrada("");
    setMensajes((m) => [...m, { papel: "usuario", texto }]);
    try {
      const r = await llamar({ accion: "chat", mensaje: texto, conversacionId, potente, autorizadoPor: autorizadoPor || undefined });
      if (r.conversacionId) setConversacionId(r.conversacionId);
      if (r.respuesta) {
        setMensajes((m) => [...m, { papel: "asistente", texto: r.respuesta, pasos: r.pasos, coste: r.coste_estimado, modelo: r.modelo }]);
      } else {
        setMensajes((m) => [...m, { papel: "error", texto: r.error ?? "No se ha podido obtener respuesta.", pasos: r.pasos }]);
      }
    } catch (e) {
      setMensajes((m) => [...m, { papel: "error", texto: e instanceof Error ? e.message : "Error de red." }]);
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    setOcupado(true);
    setPrueba("Probando…");
    try {
      const r = await llamar({ accion: "probar" });
      setPrueba(r.ok ? `Conexión correcta: ${r.resultado}` : `Sin conexión: ${r.resultado ?? r.error}`);
    } catch (e) {
      setPrueba(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="admin-bloque">
      <h2>Consola</h2>

      <div className="ia-fila">
        <button type="button" className="f-aplicar" onClick={probar} disabled={ocupado}>
          Probar conexión con el modelo
        </button>
        <span style={{ fontSize: 13, color: "var(--muted-fg)" }}>
          {prueba ?? (configurada ? (probada ? "La última prueba fue correcta." : "Configurada pero sin probar todavía.") : "Sin clave configurada: la prueba lo dirá.")}
        </span>
      </div>

      <div className="ia-fila" style={{ marginTop: 10 }}>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={potente} onChange={(e) => setPotente(e.target.checked)} /> Usar el modelo potente
          {" "}({potente ? modeloPotente : modeloEconomico})
        </label>
        <label style={{ fontSize: 13 }}>
          Autoriza (para acciones sensibles):{" "}
          <input
            type="text"
            value={autorizadoPor}
            onChange={(e) => setAutorizadoPor(e.target.value)}
            placeholder="tu correo"
            style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          />
        </label>
      </div>

      <div className="ia-chat">
        {mensajes.length === 0 ? (
          <p style={{ color: "var(--muted-fg)", fontSize: 13.5 }}>
            {configurada
              ? "Pregúntale algo. Por ejemplo: «¿cuántos alojamientos hay publicados en Alicante?» o «¿qué dice la web sobre publicar gratis?»."
              : "Sin clave del modelo, la consola no puede conversar. El envío fallará y lo explicará."}
          </p>
        ) : (
          mensajes.map((m, i) => (
            <div key={i} className={`ia-msg ia-${m.papel}`}>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.texto}</p>
              {m.pasos && m.pasos.length > 0 ? (
                <ul className="ia-pasos">
                  {m.pasos.map((p, j) => (
                    <li key={j}>
                      {p.tipo === "herramienta" ? `herramienta ${p.herramienta}: ${p.detalle}` : `${p.tipo}: ${p.detalle}`}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.papel === "asistente" && m.coste !== undefined ? (
                <p style={{ fontSize: 11.5, color: "var(--muted-fg)" }}>
                  modelo {m.modelo} · coste estimado {Number(m.coste).toFixed(5)} USD
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="ia-fila" style={{ marginTop: 10 }}>
        <input
          type="text"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
          placeholder="Escribe al AI Manager…"
          style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}
          disabled={ocupado}
        />
        <button type="button" className="f-aplicar" onClick={() => void enviar()} disabled={ocupado || !entrada.trim()}>
          {ocupado ? "…" : "Enviar"}
        </button>
      </div>
    </section>
  );
}
