/**
 * REGLAS DE VALIDACIÓN DEL FORMULARIO DE USUARIO (administración).
 *
 * Viven aquí, sin React y sin acceso a datos, por una razón concreta: así se pueden PROBAR.
 * El componente de cliente las usa para avisar antes de enviar, y el servidor aplica las suyas
 * de forma independiente — la validación de cliente es comodidad, nunca la que protege.
 *
 * Lo que NO se valida aquí: el rol contra la lista blanca ni la salvaguarda de autodegradación.
 * Eso depende de la sesión y lo decide el servidor; aquí solo se replican las reglas que el
 * visitante puede comprobar por sí mismo antes de enviar.
 */

export type ErroresValidacion = Record<string, string>;

const MIN_PASSWORD = 8;

/** Formato de correo: suficiente para detectar erratas, sin rechazar direcciones válidas raras. */
export function emailValido(email: string): boolean {
  const s = String(email ?? "").trim();
  if (s.length < 6 || s.length > 191) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s);
}

/**
 * Contraseña: opcional. Si se deja vacía no se cambia nada y no hay error.
 * Si se escribe, exige longitud mínima y que las dos coincidan.
 */
export function validarPassword(password: string, password2: string): ErroresValidacion {
  const p = String(password ?? "");
  const p2 = String(password2 ?? "");
  const errores: ErroresValidacion = {};
  if (p === "" && p2 === "") return errores; // no se cambia: correcto
  if (p.length < MIN_PASSWORD) {
    errores.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (p !== p2) {
    errores.password2 = "Las dos contraseñas no coinciden.";
  }
  return errores;
}

/** Validación completa de los campos nuevos, tal como los envía el formulario. */
export function validarFormularioUsuario(datos: {
  email?: string | null;
  password?: string;
  password2?: string;
}): ErroresValidacion {
  const errores: ErroresValidacion = {};
  const email = String(datos.email ?? "").trim();
  if (email === "") errores.email = "El correo de acceso es obligatorio.";
  else if (!emailValido(email)) errores.email = "El correo de acceso no tiene un formato válido.";
  return { ...errores, ...validarPassword(String(datos.password ?? ""), String(datos.password2 ?? "")) };
}

/**
 * Salvaguarda de autodegradación. El servidor la aplica de verdad; aquí solo se usa para avisar
 * antes de enviar. Un administrador que se quita a sí mismo el rol admin se queda sin acceso al
 * panel y sin forma de volver por la interfaz.
 */
export function avisoAutoDegradacion(rolNuevo: string | null | undefined, esUnoMismo: boolean): string | null {
  if (!esUnoMismo) return null;
  if (String(rolNuevo ?? "") === "admin") return null;
  return "No puedes retirarte a ti mismo el rol de administrador: perderías el acceso al panel.";
}

export const MINIMO_PASSWORD = MIN_PASSWORD;
