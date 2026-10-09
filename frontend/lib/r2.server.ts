/**
 * Cliente mínimo de Cloudflare R2 (API compatible con S3) — SOLO servidor.
 *
 * Implementa la firma **AWS Signature V4** a mano con `node:crypto`, sin añadir
 * dependencias: el bucket no necesita SDK ni CLI, solo el endpoint S3 de R2.
 *
 * Credenciales SIEMPRE desde el entorno (nunca en el código ni en el repositorio):
 *   R2_ACCOUNT_ID          identificador de la cuenta de Cloudflare
 *   R2_ACCESS_KEY_ID       Access Key ID del token de R2
 *   R2_SECRET_ACCESS_KEY   Secret Access Key del token
 *   R2_BUCKET              nombre del bucket
 *   R2_PUBLIC_BASE         URL pública (subdominio *.r2.dev o dominio propio)
 *
 * Ver `docs/ALMACENAMIENTO-MEDIOS.md` para la decisión de almacenamiento.
 */
import { createHash, createHmac } from "node:crypto";

export const SERVICIO_R2 = "s3";
export const REGION_R2 = "auto"; // R2 usa la región "auto"

/**
 * Longitud que exige R2 para el Access Key ID. No es una suposición: es lo que responde su
 * propia API cuando recibe una clave de otra longitud
 * («Credential access key has length 13, should be 32»). Sirve para detectar un valor de
 * plantilla o incompleto sin gastar una petición.
 */
export const LARGO_ACCESS_KEY_R2 = 32;

export type ConfigR2 = {
  cuenta: string;
  accessKeyId: string;
  secreto: string;
  bucket: string;
  basePublica: string;
};

const limpio = (nombre: string): string => (process.env[nombre] ?? "").trim();

/** Configuración de R2, o `null` si falta cualquiera de los cinco valores. */
export function configR2(): ConfigR2 | null {
  const cuenta = limpio("R2_ACCOUNT_ID");
  const accessKeyId = limpio("R2_ACCESS_KEY_ID");
  const secreto = limpio("R2_SECRET_ACCESS_KEY");
  const bucket = limpio("R2_BUCKET");
  const basePublica = limpio("R2_PUBLIC_BASE");
  if (!cuenta || !accessKeyId || !secreto || !bucket || !basePublica) return null;
  return { cuenta, accessKeyId, secreto, bucket, basePublica };
}

export function r2Configurado(): boolean {
  return configR2() !== null;
}

/** Endpoint S3 de la cuenta: https://<cuenta>.r2.cloudflarestorage.com */
export function endpointR2(cfg: ConfigR2): string {
  return `https://${cfg.cuenta}.r2.cloudflarestorage.com`;
}

/** URL pública con la que el navegador sirve el objeto. */
export function urlPublica(cfg: ConfigR2, clave: string): string {
  return `${cfg.basePublica.replace(/\/+$/, "")}/${clave.replace(/^\/+/, "")}`;
}

const sha256Hex = (datos: string | Uint8Array): string => createHash("sha256").update(datos).digest("hex");
const hmac = (clave: string | Uint8Array, datos: string): Buffer => createHmac("sha256", clave).update(datos, "utf8").digest();

/** Codifica una ruta al estilo S3: cada segmento una vez, conservando las barras. */
export function codificarRuta(ruta: string): string {
  return ruta
    .split("/")
    .map((segmento) => encodeURIComponent(segmento).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function codificarConsulta(pares: Array<[string, string]>): string {
  return pares
    .map(([k, v]) => [k, v].map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");
}

export type EntradaFirma = {
  metodo: string;
  ruta: string;
  consulta?: string;
  cabeceras: Record<string, string>;
  carga: Uint8Array;
  region: string;
  servicio: string;
  accessKeyId: string;
  secreto: string;
  /** Formato 20150830T123600Z */
  fecha: string;
};

export type ResultadoFirma = {
  authorization: string;
  canonicalRequest: string;
  canonicalRequestHash: string;
  stringToSign: string;
  firma: string;
  signedHeaders: string;
  scope: string;
};

/**
 * Firma SigV4 genérica (probada contra el vector oficial de AWS en `r2.test.ts`).
 * Devuelve también las piezas intermedias para poder depurar una firma rechazada.
 */
export function firmaV4(entrada: EntradaFirma): ResultadoFirma {
  const cabeceras = Object.fromEntries(
    Object.entries(entrada.cabeceras).map(([k, v]) => [k.toLowerCase(), String(v).trim()]),
  );
  cabeceras["host"] = cabeceras["host"] ?? "";

  const nombres = Object.keys(cabeceras).sort();
  const signedHeaders = nombres.join(";");
  const cabecerasCanonicas = nombres.map((n) => `${n}:${cabeceras[n]}\n`).join("");
  const cargaHash = sha256Hex(entrada.carga);

  const canonicalRequest = [
    entrada.metodo.toUpperCase(),
    codificarRuta(entrada.ruta),
    entrada.consulta ?? "",
    cabecerasCanonicas,
    signedHeaders,
    cargaHash,
  ].join("\n");

  const dia = entrada.fecha.slice(0, 8);
  const scope = `${dia}/${entrada.region}/${entrada.servicio}/aws4_request`;
  const canonicalRequestHash = sha256Hex(canonicalRequest);
  const stringToSign = ["AWS4-HMAC-SHA256", entrada.fecha, scope, canonicalRequestHash].join("\n");

  const kFecha = hmac(`AWS4${entrada.secreto}`, dia);
  const kRegion = hmac(kFecha, entrada.region);
  const kServicio = hmac(kRegion, entrada.servicio);
  const kFirma = hmac(kServicio, "aws4_request");
  const firma = createHmac("sha256", kFirma).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${entrada.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${firma}`;

  return { authorization, canonicalRequest, canonicalRequestHash, stringToSign, firma, signedHeaders, scope };
}

/** Fecha en el formato que exige SigV4 (UTC). */
export function fechaAmz(cuando: Date = new Date()): string {
  return cuando.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Cabeceras firmadas para una petición a R2. */
export function cabecerasFirmadas(
  cfg: ConfigR2,
  metodo: string,
  clave: string,
  carga: Uint8Array,
  extra: Record<string, string> = {},
): { url: string; headers: Record<string, string> } {
  const host = `${cfg.cuenta}.r2.cloudflarestorage.com`;
  const fecha = fechaAmz();
  const ruta = `/${cfg.bucket}/${clave.replace(/^\/+/, "")}`;
  const cargaHash = sha256Hex(carga);
  const cabeceras: Record<string, string> = {
    host,
    "x-amz-content-sha256": cargaHash,
    "x-amz-date": fecha,
    ...extra,
  };
  const r = firmaV4({
    metodo,
    ruta,
    cabeceras,
    carga,
    region: REGION_R2,
    servicio: SERVICIO_R2,
    accessKeyId: cfg.accessKeyId,
    secreto: cfg.secreto,
    fecha,
  });
  return {
    url: `${endpointR2(cfg)}${codificarRuta(ruta)}`,
    headers: { ...cabeceras, authorization: r.authorization },
  };
}

/** Clave del objeto a partir del contenido: deduplica y permite caché inmutable. */
export function clavePorContenido(datos: Uint8Array, extension: string): string {
  return `${sha256Hex(datos).slice(0, 32)}.${extension.replace(/^\./, "")}`;
}

export type ObjetoR2 = { clave: string; bytes: number; modificado: string };

/** Deshace el escapado XML mínimo que R2 aplica a claves y token de continuación. */
function desescaparXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Lista los objetos del bucket, paginado (API S3 `ListObjectsV2`).
 *
 * Firma un `GET` con la consulta canónica (ordenada y codificada igual que en la firma), que es
 * donde más fácil se rompe una firma SigV4. Devuelve también el token de continuación.
 */
export async function listarObjetos(opciones: { prefijo?: string; continuacion?: string; max?: number } = {}): Promise<{
  objetos: ObjetoR2[];
  truncado: boolean;
  continuacion: string | null;
}> {
  const cfg = exigirConfigValida();
  const pares: Array<[string, string]> = [["list-type", "2"], ["max-keys", String(opciones.max ?? 1000)]];
  if (opciones.prefijo) pares.push(["prefix", opciones.prefijo]);
  if (opciones.continuacion) pares.push(["continuation-token", opciones.continuacion]);
  const consulta = codificarConsulta(pares);

  const host = `${cfg.cuenta}.r2.cloudflarestorage.com`;
  const ruta = `/${cfg.bucket}`;
  const fecha = fechaAmz();
  const carga = new Uint8Array(0);
  const cabeceras: Record<string, string> = {
    host,
    "x-amz-content-sha256": sha256Hex(carga),
    "x-amz-date": fecha,
  };
  const r = firmaV4({
    metodo: "GET",
    ruta,
    consulta,
    cabeceras,
    carga,
    region: REGION_R2,
    servicio: SERVICIO_R2,
    accessKeyId: cfg.accessKeyId,
    secreto: cfg.secreto,
    fecha,
  });

  const res = await fetch(`${endpointR2(cfg)}${codificarRuta(ruta)}?${consulta}`, {
    headers: { ...cabeceras, authorization: r.authorization },
  });
  if (!res.ok) {
    const detalle = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`R2 rechazó el listado (${res.status}): ${detalle}`);
  }
  const xml = await res.text();
  const objetos: ObjetoR2[] = [];
  for (const bloque of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
    const clave = /<Key>([\s\S]*?)<\/Key>/.exec(bloque)?.[1];
    if (!clave) continue;
    objetos.push({
      clave: desescaparXml(clave),
      bytes: Number(/<Size>(\d+)<\/Size>/.exec(bloque)?.[1] ?? 0),
      modificado: /<LastModified>([\s\S]*?)<\/LastModified>/.exec(bloque)?.[1] ?? "",
    });
  }
  const truncado = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const continuacion = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
  return { objetos, truncado, continuacion: continuacion ? desescaparXml(continuacion) : null };
}

/**
 * Comprueba que hay configuración y que la clave tiene la forma que R2 exige, antes de
 * gastar una petición: así un valor de plantilla se detecta al instante y con un mensaje
 * claro, en vez de con un error opaco de R2.
 */
export function exigirConfigValida(): ConfigR2 {
  const cfg = configR2();
  if (!cfg) {
    throw new Error(
      "R2 no está configurado: faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET o R2_PUBLIC_BASE.",
    );
  }
  if (cfg.accessKeyId.length !== LARGO_ACCESS_KEY_R2) {
    throw new Error(
      `R2_ACCESS_KEY_ID tiene ${cfg.accessKeyId.length} caracteres y R2 espera ${LARGO_ACCESS_KEY_R2}: ` +
        "parece un marcador de plantilla o está incompleto. R2 lo rechazaría con «Credential access key has length ...».",
    );
  }
  return cfg;
}

/** Sube un objeto y devuelve su URL pública. Sin configuración válida, lanza un error legible. */
export async function subirObjeto(clave: string, datos: Uint8Array, tipoContenido: string) {
  const cfg = exigirConfigValida();
  /**
   * CACHÉ DE LAS IMÁGENES PÚBLICAS.
   *
   * Comprobado en producción: los objetos de R2 se servían SIN ninguna cabecera `Cache-Control`,
   * solo con su ETag. El navegador tenía que preguntar por cada foto en cada visita.
   *
   * La clave del objeto es el hash de su contenido (`clavePorContenido`): si el contenido cambia,
   * cambia la URL. Por eso la caché puede ser de un año e `immutable` sin ningún riesgo de servir
   * una foto vieja: nunca hay dos ficheros distintos en la misma dirección.
   */
  const { url, headers } = cabecerasFirmadas(cfg, "PUT", clave, datos, {
    "content-type": tipoContenido,
    "cache-control": "public, max-age=31536000, immutable",
  });
  // `datos` son los bytes exactos del objeto: se envían sin transformar. El tipo se ajusta
  // porque los tipos de `fetch` de esta versión no aceptan `Uint8Array` genérico, pero el
  // cuerpo es válido en tiempo de ejecución (y la firma V4 se calcula sobre esos mismos bytes).
  const res = await fetch(url, { method: "PUT", headers, body: datos as unknown as BodyInit });
  if (!res.ok) {
    const detalle = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`R2 rechazó la subida (${res.status}): ${detalle}`);
  }
  return { clave, url: urlPublica(cfg, clave), bytes: datos.byteLength, etag: res.headers.get("etag") };
}

/** Borra un objeto. Devuelve `true` si se borró (o ya no estaba). */
export async function borrarObjeto(clave: string): Promise<boolean> {
  const cfg = exigirConfigValida();
  const { url, headers } = cabecerasFirmadas(cfg, "DELETE", clave, new Uint8Array(0));
  const res = await fetch(url, { method: "DELETE", headers });
  return res.ok || res.status === 404;
}

/** Estado del almacenamiento, sin exponer secretos. */
export function estadoAlmacenamiento() {
  const cfg = configR2();
  return {
    proveedor: "Cloudflare R2 (API S3)",
    configurado: cfg !== null,
    endpoint: cfg ? endpointR2(cfg) : null,
    bucket: cfg?.bucket ?? null,
    basePublica: cfg?.basePublica ?? null,
    faltan: cfg
      ? []
      : ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE"].filter((n) => !limpio(n)),
    // Las variables pueden estar presentes y ser inservibles (un marcador de plantilla, por
    // ejemplo). Esto lo delata sin exponer el valor.
    avisoAccessKey:
      cfg && cfg.accessKeyId.length !== LARGO_ACCESS_KEY_R2
        ? `R2_ACCESS_KEY_ID tiene ${cfg.accessKeyId.length} caracteres y R2 espera ${LARGO_ACCESS_KEY_R2}.`
        : null,
  };
}
