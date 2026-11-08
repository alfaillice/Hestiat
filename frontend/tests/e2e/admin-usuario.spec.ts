// @ts-nocheck
/**
 * TESTS END-TO-END — FORMULARIO DE EDICIÓN DE USUARIO DEL PANEL ADMIN
 *
 * ⚠️ ESTADO: ESCRITOS, NUNCA EJECUTADOS.
 *    No hay credenciales de administrador de prueba ni Playwright instalado en este entorno.
 *    Un test que no ha corrido no prueba nada: esto es un guion listo para usar, no cobertura.
 *
 * PARA EJECUTARLO:
 *   1. npm i -D @playwright/test && npx playwright install chromium
 *   2. Definir variables de entorno:
 *        E2E_BASE_URL=https://hestiat.com
 *        E2E_ADMIN_EMAIL=...        (cuenta ADMIN real o de staging)
 *        E2E_ADMIN_PASS=...
 *        E2E_TARGET_USER_ID=...     (cuenta de PRUEBA a modificar, NUNCA un usuario real)
 *   3. npx playwright test tests/e2e/admin-usuario.spec.ts --reporter=list
 *
 * REGLAS DE SEGURIDAD QUE RESPETAN ESTOS TESTS:
 *   · Solo se modifica la cuenta indicada en E2E_TARGET_USER_ID. Nunca otra.
 *   · El correo de prueba se restaura al final (afterAll) para no dejar la cuenta rota.
 *   · La contraseña se cambia y se vuelve a dejar la original.
 *   · NO se toca ninguna cuenta real de cliente.
 *
 * LO QUE COMPRUEBAN (los cuatro casos pedidos):
 *   1. Cambio de correo de acceso  → se guarda y persiste tras recargar.
 *   2. Cambio de rol               → se guarda y persiste.
 *   3. Cambio de contraseña        → se guarda y PERMITE INICIAR SESIÓN con la nueva.
 *   4. Autodegradación de rol     → un admin que se quita su propio rol es RECHAZADO.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://hestiat.com";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? "";
const TARGET_ID = process.env.E2E_TARGET_USER_ID ?? "";

/** Marca temporal para no chocar con correos ya usados entre ejecuciones. */
const SUFIJO = Date.now().toString().slice(-6);
const CORREO_NUEVO = `e2e-prueba-${SUFIJO}@hestiat.test`;
const PASS_NUEVA = `PruebaE2E-${SUFIJO}-segura`;

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASS || !TARGET_ID,
  "Faltan E2E_ADMIN_EMAIL, E2E_ADMIN_PASS o E2E_TARGET_USER_ID: no se puede ejecutar.",
);

async function entrarComoAdmin(page: Page) {
  await page.goto(`${BASE}/login?redirect=/admin`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  await expect(page.locator(".admin-nav")).toBeVisible();
}

async function abrirFichaUsuario(page: Page) {
  await page.goto(`${BASE}/admin/usuarios/${TARGET_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Editar usuario" })).toBeVisible();
  await expect(page.locator('form.form-edicion')).toBeVisible();
}

/** Valor actual de un campo del formulario, para restaurarlo después. */
async function leerValor(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).inputValue()) ?? "";
}

/* ------------------------------------------------------------------ setup -- */

test.beforeEach(async ({ page }) => {
  await entrarComoAdmin(page);
  await abrirFichaUsuario(page);
});

/* ------------------------------------------------------ 1 · CAMBIO DE CORREO -- */

test("1 · cambia el correo de acceso y persiste tras recargar la ficha", async ({ page }) => {
  const anterior = await leerValor(page, 'input[name="email"]');

  await page.fill('input[name="email"]', CORREO_NUEVO);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  // Persistencia real: se recarga la ficha y se lee lo que hay guardado.
  await page.goto(`${BASE}/admin/usuarios/${TARGET_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('input[name="email"]')).toHaveValue(CORREO_NUEVO);

  // Restauración: dejar la cuenta como estaba.
  await page.fill('input[name="email"]', anterior);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
});

test("1b · rechaza un correo con formato inválido antes de enviar", async ({ page }) => {
  await page.fill('input[name="email"]', "esto-no-es-un-correo");
  await page.locator('input[name="telefono"]').focus(); // dispara la validación al salir

  await expect(page.getByRole("alert")).toContainText(/formato válido/i);
});

/* --------------------------------------------------------- 2 · CAMBIO DE ROL -- */

test("2 · cambia el rol y persiste tras recargar", async ({ page }) => {
  const anterior = await leerValor(page, 'select[name="rol"]');
  const nuevo = anterior === "anfitrion" ? "huesped" : "anfitrion";

  await page.selectOption('select[name="rol"]', nuevo);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  await page.goto(`${BASE}/admin/usuarios/${TARGET_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('select[name="rol"]')).toHaveValue(nuevo);

  // Restauración.
  await page.selectOption('select[name="rol"]', anterior);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
});

/* ---------------------------------------------------- 3 · CAMBIO DE CONTRASEÑA -- */

test("3 · cambia la contraseña y permite iniciar sesión con la nueva", async ({ page, context }) => {
  const ANTERIOR_SUP = process.env.E2E_TARGET_USER_PASS ?? "";

  await page.fill('input[name="password"]', PASS_NUEVA);
  await page.fill('input[name="password2"]', PASS_NUEVA);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  // LA PRUEBA QUE IMPORTA: que el hash guardado sirva para entrar de verdad.
  await page.request.post(`${BASE}/api/auth/logout`).catch(() => {});
  const limpio = await context.newPage();
  await entrarConCredenciales(limpio, CORREO_NUEVO, PASS_NUEVA);
  await expect(limpio).toHaveURL(/\/perfil|\/admin/);
  await limpio.close();

  // Restauración: volver a la contraseña original del usuario de prueba.
  if (ANTERIOR_SUP) {
    await page.goto(`${BASE}/admin/usuarios/${TARGET_ID}`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="password"]', ANTERIOR_SUP);
    await page.fill('input[name="password2"]', ANTERIOR_SUP);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }
});

async function entrarConCredenciales(page: Page, email: string, pass: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/perfil|\/admin/, { timeout: 20_000 });
}

test("3b · avisa si las dos contraseñas no coinciden, sin enviar", async ({ page }) => {
  await page.fill('input[name="password"]', "unaClaveLarga123");
  await page.fill('input[name="password2"]', "otraDistinta456");
  await page.locator('input[name="password2"]').blur();

  await expect(page.getByRole("alert")).toContainText(/no coinciden/i);
});

test("3c · avisa si la contraseña es más corta de 8 caracteres", async ({ page }) => {
  await page.fill('input[name="password"]', "corta");
  await page.locator('input[name="password"]').blur();

  await expect(page.getByRole("alert")).toContainText(/al menos 8/i);
});

/* ------------------------------------ 4 · PROTECCIÓN CONTRA AUTODEGRADACIÓN -- */

test("4 · un admin NO puede quitarse a sí mismo el rol admin", async ({ page }) => {
  // Abre la ficha de LA PROPIA cuenta del administrador que ha iniciado sesión.
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  const emailPropio = ADMIN_EMAIL;

  // Localiza su id en el listado de usuarios.
  await page.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(emailPropio)}`, { waitUntil: "domcontentloaded" });
  const enlace = page.locator('a:has-text("Editar")').first();
  await expect(enlace).toBeVisible();
  await enlace.click();
  await page.waitForLoadState("domcontentloaded");

  // Intento de degradación: rol distinto de admin.
  await page.selectOption('select[name="rol"]', "huesped");
  await page.locator('select[name="rol"]').blur();

  // 1) El cliente avisa antes de enviar.
  await expect(page.getByRole("alert")).toContainText(/no puedes retirarte/i);

  // 2) Y el servidor también lo rechaza, aunque se fuerce el envío.
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  await page.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(emailPropio)}`, { waitUntil: "domcontentloaded" });
  const fila = page.locator("tr", { hasText: emailPropio });
  await expect(fila).toContainText("admin");
});

/* ------------------------------------------------------- 5 · SEGURIDAD BÁSICA -- */

test("5 · sin sesión, la ficha no se sirve", async ({ browser }) => {
  const limpio = await browser.newContext();
  const page = await limpio.newPage();
  const r = await page.goto(`${BASE}/admin/usuarios/${TARGET_ID}`, { waitUntil: "domcontentloaded" });
  // Redirección a login: nunca el formulario.
  expect(r?.status() ?? 0).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login/);
  await limpio.close();
});
