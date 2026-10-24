import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailValido,
  validarPassword,
  validarFormularioUsuario,
  avisoAutoDegradacion,
  MINIMO_PASSWORD,
} from "../lib/validacion-usuario.ts";

/* --------------------------------------------------------------- correo -- */

test("acepta correos con formato correcto", () => {
  assert.equal(emailValido("jose@hestiat.com"), true);
  assert.equal(emailValido("  nombre.apellido+etiqueta@sub.dominio.es  "), true);
});

test("rechaza correos mal formados", () => {
  for (const malo of ["", "sin-arroba", "a@b", "a@b.c", "@dominio.com", "usuario@", "dos@arrobas@x.com", "espacio en@medio.com"]) {
    assert.equal(emailValido(malo), false, `debería rechazar: ${malo}`);
  }
});

/* ----------------------------------------------------------- contraseñas -- */

test("contraseña vacía en los dos campos: no es un error (no se cambia)", () => {
  assert.deepEqual(validarPassword("", ""), {});
});

test("contraseña corta: error, y con el mínimo en el mensaje", () => {
  const e = validarPassword("corta", "corta");
  assert.ok(e.password);
  assert.match(e.password, new RegExp(String(MINIMO_PASSWORD)));
});

test("contraseñas que no coinciden: error en el segundo campo", () => {
  const e = validarPassword("contrasena-larga", "otra-distinta");
  assert.equal(e.password, undefined, "la longitud es correcta, no debe quejarse de ella");
  assert.ok(e.password2);
});

test("contraseña válida y coincidente: sin errores", () => {
  assert.deepEqual(validarPassword("unaClaveSegura", "unaClaveSegura"), {});
});

/** Los límites suelen ser donde falla: 7 no pasa, 8 sí. */
test("el límite de longitud es exacto", () => {
  assert.ok(validarPassword("1234567", "1234567").password);
  assert.equal(validarPassword("12345678", "12345678").password, undefined);
});

/* ---------------------------------------------------- formulario completo -- */

test("formulario correcto: sin errores", () => {
  assert.deepEqual(
    validarFormularioUsuario({ email: "nuevo@hestiat.com", password: "", password2: "" }),
    {},
  );
});

test("acumula errores de correo y contraseña a la vez", () => {
  const e = validarFormularioUsuario({ email: "malo", password: "123", password2: "456" });
  assert.ok(e.email);
  assert.ok(e.password);
  assert.ok(e.password2);
});

test("correo vacío se señala como obligatorio", () => {
  const e = validarFormularioUsuario({ email: "" });
  assert.match(String(e.email), /obligatorio/i);
});

/* ------------------------------------------- salvaguarda de autodegradación -- */

test("un admin que se quita el rol a sí mismo recibe aviso", () => {
  assert.ok(avisoAutoDegradacion("huesped", true));
  assert.ok(avisoAutoDegradacion("anfitrion", true));
});

test("un admin que mantiene su rol no recibe aviso", () => {
  assert.equal(avisoAutoDegradacion("admin", true), null);
});

test("cambiar el rol de OTRA cuenta nunca dispara la salvaguarda", () => {
  assert.equal(avisoAutoDegradacion("huesped", false), null);
  assert.equal(avisoAutoDegradacion("anfitrion", false), null);
});
