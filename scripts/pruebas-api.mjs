#!/usr/bin/env node
/**
 * Pruebas de integración de la API pública de Hestiat.
 *
 * Se ejecutan contra el servicio REAL (por defecto https://hestiat.com) y solo hacen peticiones que
 * el servidor debe rechazar: ninguna crea datos. En particular, la ruta de reservas se prueba
 * únicamente con datos inválidos a propósito, porque una reserva con datos válidos se guardaría de
 * verdad y sería un dato de prueba.
 *
 * Uso:
 *   node scripts/pruebas-api.mjs                      (contra producción)
 *   HESTIAT_BASE=http://localhost:3000 node scripts/pruebas-api.mjs
 *
 * Cubre los dos defectos corregidos (cuerpo malformado en reservas, tipo de catálogo equivocado) y
 * deja constancia de los cuatro casos que todavía devuelven 500 y están pendientes de autorización.
 */

const BASE = (process.env.HESTIAT_BASE ?? "https://hestiat.com").replace(/\/$/, "");

const JSON_HEADERS = { "content-type": "application/json" };
const FORM_HEADERS = { "content-type": "application/x-www-form-urlencoded" };

const casos = [
  // --- Reservas: lo corregido (antes: 500) ---
  { nombre: "reservas · cuerpo JSON (antes 500)", ruta: "/api/reservas", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{"nada":"útil"}', espera: [400] },
  { nombre: "reservas · formulario sin alojamiento", ruta: "/api/reservas", metodo: "POST", cabeceras: FORM_HEADERS, cuerpo: "slug=gemas-beach&desde=2027-01-10&hasta=2027-01-12", espera: [303], contiene: "error=Solicitud" },
  { nombre: "reservas · alojamiento no numérico", ruta: "/api/reservas", metodo: "POST", cabeceras: FORM_HEADERS, cuerpo: "slug=gemas-beach&accommodationId=abc", espera: [303], contiene: "error=Solicitud" },
  { nombre: "reservas · alojamiento cero", ruta: "/api/reservas", metodo: "POST", cabeceras: FORM_HEADERS, cuerpo: "slug=gemas-beach&accommodationId=0&desde=2027-01-10&hasta=2027-01-12", espera: [303] },
  { nombre: "reservas · formulario vacío", ruta: "/api/reservas", metodo: "POST", cabeceras: FORM_HEADERS, cuerpo: "", espera: [303] },

  // --- Catálogo: lo corregido (antes: cualquier valor devolvía experiencias) ---
  { nombre: "catálogo · tipo=service", ruta: "/api/catalogo/lista?tipo=service", espera: [200], json: (d) => d.ok === true && d.tipo === "service" && d.total > 1000 },
  { nombre: "catálogo · tipo=servicio (español)", ruta: "/api/catalogo/lista?tipo=servicio", espera: [200], json: (d) => d.ok === true && d.tipo === "service" && d.total > 1000 },
  { nombre: "catálogo · tipo=SERVICIO (mayúsculas)", ruta: "/api/catalogo/lista?tipo=SERVICIO", espera: [200], json: (d) => d.tipo === "service" },
  { nombre: "catálogo · tipo=experiencia (español)", ruta: "/api/catalogo/lista?tipo=experiencia", espera: [200], json: (d) => d.ok === true && d.tipo === "experience" && d.total > 1000 },
  { nombre: "catálogo · tipo=experience", ruta: "/api/catalogo/lista?tipo=experience", espera: [200], json: (d) => d.tipo === "experience" },
  { nombre: "catálogo · tipo=loquesea → error claro", ruta: "/api/catalogo/lista?tipo=loquesea", espera: [400], json: (d) => d.ok === false && typeof d.error === "string" },
  { nombre: "catálogo · tipo=alojamiento → error claro", ruta: "/api/catalogo/lista?tipo=alojamiento", espera: [400], json: (d) => d.ok === false },
  { nombre: "catálogo · sin tipo (compatibilidad)", ruta: "/api/catalogo/lista", espera: [200], json: (d) => d.tipo === "experience" },
  { nombre: "catálogo · límite respetado", ruta: "/api/catalogo/lista?tipo=servicio&limite=2", espera: [200], json: (d) => Array.isArray(d.items) && d.items.length <= 2 },

  // --- Guardias de sesión: negativa limpia, nunca 500 ---
  { nombre: "favoritos · sin sesión → 401", ruta: "/api/favoritos", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{"tipo":"alojamiento","itemId":14}', espera: [401] },
  { nombre: "perfil · sin sesión → redirección", ruta: "/api/perfil", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{"accion":"avatar"}', espera: [303, 307] },
  { nombre: "admin/catalogo · sin sesión → 403", ruta: "/api/admin/catalogo", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{"tipo":"experiencia","id":5}', espera: [403] },
  { nombre: "medios · sin sesión → negativa", ruta: "/api/medios", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{}', espera: [400, 401, 403] },
  { nombre: "host/calendario · sin sesión → redirección", ruta: "/api/host/calendario", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{}', espera: [303, 307] },
  { nombre: "alojamientos · sin sesión → redirección", ruta: "/api/alojamientos", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{}', espera: [303, 307] },
  { nombre: "solicitudes · cuerpo malformado → 400", ruta: "/api/solicitudes", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: '{}', espera: [400] },
  { nombre: "vitales · cuerpo malformado → 400", ruta: "/api/vitales", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: "no-es-json", espera: [400] },
  { nombre: "precio-preview · cuerpo malformado → 400", ruta: "/api/precio-preview", metodo: "POST", cabeceras: JSON_HEADERS, cuerpo: "no-es-json", espera: [400] },

  // --- Lecturas públicas ---
  { nombre: "buscar · responde", ruta: "/api/buscar?q=granada", espera: [200], json: (d) => d.ok === true && d.total > 0 },
  { nombre: "sugerencias · responde", ruta: "/api/sugerencias?q=madr", espera: [200], json: (d) => Array.isArray(d.sugerencias) },
  { nombre: "cerca · responde", ruta: "/api/cerca", espera: [200] },
  { nombre: "disponibilidad · alojamiento 0 → 400", ruta: "/api/alojamientos/0/disponibilidad", espera: [400] },
  { nombre: "disponibilidad · alojamiento no numérico → 400", ruta: "/api/alojamientos/abc/disponibilidad", espera: [400] },
];

/** Todavía devuelven 500 con un cuerpo malformado. Se informan, no se dan por buenos. */
const pendientes = [
  { nombre: "auth/login", ruta: "/api/auth/login" },
  { nombre: "auth/registro", ruta: "/api/auth/registro" },
  { nombre: "reclamar", ruta: "/api/reclamar" },
  { nombre: "host/reservas", ruta: "/api/host/reservas" },
];

const log = [];
function registra(nombre, ok, detalle) { log.push({ nombre, ok, detalle }); }

for (const c of casos) {
  const opciones = { method: c.metodo ?? "GET", headers: c.cabeceras, redirect: "manual" };
  if (c.cuerpo !== undefined) opciones.body = c.cuerpo;
  let estado = 0, texto = "", destino = "", json = null;
  try {
    const r = await fetch(BASE + c.ruta, opciones);
    estado = r.status;
    destino = r.headers.get("location") ?? "";
    // Se interpreta el cuerpo COMPLETO: trocearlo antes de leer el JSON lo invalida.
    const completo = await r.text();
    texto = completo.slice(0, 400);
    try { json = JSON.parse(completo); } catch { /* no es JSON, es correcto en redirecciones */ }
  } catch (e) {
    registra(c.nombre, false, "no se pudo llamar: " + String(e).slice(0, 60));
    continue;
  }
  const estadoOk = c.espera.includes(estado);
  const contieneOk = !c.contiene || destino.includes(c.contiene);
  const jsonOk = !c.json || (json !== null && c.json(json));
  registra(c.nombre, estadoOk && contieneOk && jsonOk,
    `código ${estado}${destino ? " → " + destino.slice(0, 46) : ""}${jsonOk ? "" : " · el cuerpo no cumple lo esperado"}`);
}

console.log(`\nPRUEBAS DE INTEGRACIÓN DE LA API — ${BASE}\n`);
let fallos = 0;
for (const r of log) {
  if (!r.ok) fallos++;
  console.log(`  ${r.ok ? "OK  " : "FALLO"}  ${r.nombre.padEnd(46)} ${r.detalle}`);
}

console.log(`\n  Resumen: ${log.length - fallos} correctas · ${fallos} fallidas de ${log.length}\n`);

console.log("  PENDIENTES CONOCIDOS (devuelven 500 con un cuerpo malformado y sin sesión;");
console.log("  detectados, informados y a la espera de autorización para corregirlos):");
for (const p of pendientes) {
  let estado = "sin respuesta";
  try {
    const r = await fetch(BASE + p.ruta, { method: "POST", headers: JSON_HEADERS, body: '{"no":"es un formulario"}', redirect: "manual" });
    estado = String(r.status);
  } catch (e) { estado = "error de red"; }
  console.log(`    · ${p.nombre.padEnd(18)} → ${estado}${estado === "500" ? "  ← pendiente" : "  (ya controlado)"}`);
}
console.log("");
process.exit(fallos === 0 ? 0 : 1);
