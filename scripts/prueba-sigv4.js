#!/usr/bin/env node
/**
 * Hestiat — prueba del firmador SigV4 (Node, sin dependencias).
 *
 * Comprueba que la firma que generamos es CORRECTA sin depender del servidor:
 *
 *   1. VECTOR OFICIAL DE AWS: firma «get-vanilla» del juego de pruebas de AWS.
 *      Si coincidimos con la firma publicada, el algoritmo está bien implementado.
 *   2. COHERENCIA ESTRUCTURAL: petición canónica, cabeceras firmadas y ámbito.
 *   3. DETERMINISMO: la misma entrada da siempre la misma firma, y cambiar un byte la cambia.
 *   4. (opcional) CONTRA EL BUCKET REAL: si hay credenciales en el entorno, firma un GET
 *      a hestiat-backups e informa. Esa parte sí necesita red; el resto no.
 *
 * Uso:
 *   node scripts/prueba-sigv4.js
 *   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… node scripts/prueba-sigv4.js --en-vivo
 */

import { createHash, createHmac } from "node:crypto";
import process from "node:process";

/* ---------------------------------------------------------------- SigV4 -- */
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const hmac = (key, data, enc) => createHmac("sha256", key).update(data).digest(enc);

export function firmar({ metodo, host, ruta = "/", region = "auto", servicio = "s3", accessKey, secretKey, fecha, hashCuerpo, cabeceras = {}, conHashCuerpo = true }) {
  const amzDate = fecha ?? new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashCuerpo ?? sha256("");
  // conHashCuerpo=true es lo que exige S3/R2. El ejemplo clásico de AWS no lo incluye,
  // así que para comparar contra su vector hay que poder omitirlo.
  const todas = conHashCuerpo
    ? { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, ...cabeceras }
    : { host, "x-amz-date": amzDate, ...cabeceras };
  const nombres = Object.keys(todas).map((k) => k.toLowerCase()).sort();
  const canonCabeceras = nombres.map((n) => `${n}:${String(todas[Object.keys(todas).find((k) => k.toLowerCase() === n)]).trim()}\n`).join("");
  const signedHeaders = nombres.join(";");
  const peticionCanonica = [metodo, ruta, "", canonCabeceras, signedHeaders, payloadHash].join("\n");
  const ambito = `${dateStamp}/${region}/${servicio}/aws4_request`;
  const aFirmar = ["AWS4-HMAC-SHA256", amzDate, ambito, sha256(peticionCanonica)].join("\n");
  const kFecha = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kFecha, region);
  const kServicio = hmac(kRegion, servicio);
  const kFirma = hmac(kServicio, "aws4_request");
  const firma = hmac(kFirma, aFirmar, "hex");
  return {
    firma, amzDate, signedHeaders, peticionCanonica, aFirmar, ambito,
    cabecera: `AWS4-HMAC-SHA256 Credential=${accessKey}/${ambito}, SignedHeaders=${signedHeaders}, Signature=${firma}`,
  };
}

/* ----------------------------------------------------------- utilidades -- */
let fallos = 0;
const ok = (t) => console.log(`  [  OK  ] ${t}`);
const ko = (t) => { fallos++; console.log(`  [ FALLO] ${t}`); };
const info = (t) => console.log(`  [ info ] ${t}`);

console.log("=== Prueba del firmador SigV4 de Hestiat ===\n");

/* ---------------------------- 1. vector oficial de AWS ------------------- */
console.log("1) Vector oficial de AWS (get-vanilla)");
const VECTOR = {
  accessKey: "AKIDEXAMPLE",
  secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  host: "example.amazonaws.com",
  region: "us-east-1",
  servicio: "service",
  fecha: "20150830T123600Z",
  esperado: "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
};
const v = firmar({
  metodo: "GET", host: VECTOR.host, ruta: "/", region: VECTOR.region, servicio: VECTOR.servicio,
  accessKey: VECTOR.accessKey, secretKey: VECTOR.secretKey, fecha: VECTOR.fecha, hashCuerpo: sha256(""),
  conHashCuerpo: false,   // el vector de AWS firma solo host;x-amz-date
});
info(`ámbito: ${v.ambito}`);
info(`firma obtenida:  ${v.firma}`);
info(`firma esperada:  ${VECTOR.esperado}`);
if (v.firma === VECTOR.esperado) ok("la firma coincide con la publicada por AWS: el algoritmo es correcto");
else ko("la firma NO coincide con el vector: revisar el algoritmo antes de usarlo");

/* ---------------------------- 2. coherencia estructural ------------------ */
console.log("\n2) Coherencia estructural de la petición canónica");
const r2 = firmar({ metodo: "PUT", host: "cuenta.r2.cloudflarestorage.com", ruta: "/hestiat-backups/backups/x.sql.gz", region: "auto", servicio: "s3", accessKey: "AK", secretKey: "SK", hashCuerpo: sha256("hola") });
const lineas = r2.peticionCanonica.split("\n");
lineas[0] === "PUT" ? ok("línea 1: método") : ko("línea 1 incorrecta");
lineas[1] === "/hestiat-backups/backups/x.sql.gz" ? ok("línea 2: ruta tal cual") : ko("línea 2 incorrecta");
lineas[2] === "" ? ok("línea 3: consulta vacía") : ko("línea 3 incorrecta");
lineas[3].startsWith("host:cuenta.r2.cloudflarestorage.com") ? ok("cabeceras canónicas ordenadas, empezando por host") : ko("cabeceras canónicas mal formadas");
r2.signedHeaders === "host;x-amz-content-sha256;x-amz-date" ? ok("cabeceras firmadas correctas") : ko(`cabeceras firmadas: ${r2.signedHeaders}`);
r2.ambito.endsWith("/auto/s3/aws4_request") ? ok("ámbito con región auto y servicio s3 (lo que espera R2)") : ko(`ámbito: ${r2.ambito}`);
r2.cabecera.includes("AWS4-HMAC-SHA256 Credential=") && r2.cabecera.includes("SignedHeaders=") && r2.cabecera.includes("Signature=") ? ok("cabecera Authorization bien formada") : ko("cabecera Authorization mal formada");

/* ---------------------------- 3. determinismo ---------------------------- */
console.log("\n3) Determinismo y sensibilidad al cambio");
const a = firmar({ metodo: "PUT", host: "h", ruta: "/b/k", region: "auto", servicio: "s3", accessKey: "AK", secretKey: "SK", fecha: "20260101T000000Z", hashCuerpo: sha256("uno") });
const b = firmar({ metodo: "PUT", host: "h", ruta: "/b/k", region: "auto", servicio: "s3", accessKey: "AK", secretKey: "SK", fecha: "20260101T000000Z", hashCuerpo: sha256("uno") });
const c = firmar({ metodo: "PUT", host: "h", ruta: "/b/k", region: "auto", servicio: "s3", accessKey: "AK", secretKey: "SK", fecha: "20260101T000000Z", hashCuerpo: sha256("dos") });
a.firma === b.firma ? ok("misma entrada → misma firma") : ko("no es determinista");
a.firma !== c.firma ? ok("cambiar el cuerpo cambia la firma") : ko("el cuerpo no afecta a la firma");
const d = firmar({ metodo: "PUT", host: "h", ruta: "/b/k", region: "auto", servicio: "s3", accessKey: "AK", secretKey: "SK2", fecha: "20260101T000000Z", hashCuerpo: sha256("uno") });
a.firma !== d.firma ? ok("cambiar la clave secreta cambia la firma") : ko("la clave secreta no afecta: grave");

/* ---------------------------- 4. contra el bucket real (opcional) -------- */
console.log("\n4) Firma contra el bucket privado real (necesita red, opcional)");
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  info("sin credenciales en el entorno: se omite (no es un fallo)");
  info("para probarlo: R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… node scripts/prueba-sigv4.js --en-vivo");
} else {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const s = firmar({ metodo: "GET", host, ruta: "/hestiat-backups/", region: "auto", servicio: "s3", accessKey: R2_ACCESS_KEY_ID, secretKey: R2_SECRET_ACCESS_KEY, hashCuerpo: sha256("") });
  info(`firma generada para GET /hestiat-backups/ (${s.firma.slice(0, 16)}…)`);
  if (process.argv.includes("--en-vivo")) {
    const r = await fetch(`https://${host}/hestiat-backups/`, {
      method: "GET",
      headers: { Authorization: s.cabecera, "x-amz-content-sha256": sha256(""), "x-amz-date": s.amzDate },
    }).catch((e) => ({ status: 0, statusText: String(e) }));
    info(`respuesta en vivo: HTTP ${r.status} ${r.statusText}`);
    if (r.status === 200 || r.status === 403) ok("la firma es aceptada por el servicio (200 o 403 de permisos, no 400 de firma)");
    else ko(`respuesta ${r.status}: si es 400, la firma no encaja`);
  } else {
    info("añade --en-vivo para hacer la petición real");
  }
}

/* ------------------------------------------------------------ resumen -- */
console.log("\n==============================================");
if (fallos === 0) {
  console.log("  RESULTADO: firmador CORRECTO");
  console.log("  (incluye la coincidencia con el vector oficial de AWS)");
  console.log("==============================================");
  process.exit(0);
} else {
  console.log(`  RESULTADO: ${fallos} fallo(s). NO usar el firmador hasta corregirlo.`);
  console.log("==============================================");
  process.exit(1);
}
