"use client";

/**
 * ENVOLTORIO DE FORMULARIO CON VALIDACIÓN EN CLIENTE.
 *
 * No sustituye al formulario existente: lo ENVUELVE. Los campos siguen siendo los mismos y se
 * envían igual (POST clásico, sin JavaScript obligatorio). Lo único que añade es que, si hay un
 * error evidente, se detiene el envío y se muestra el mensaje antes de llegar al servidor.
 *
 * IMPORTANTE: esto es comodidad, no seguridad. El servidor valida por su cuenta y es el que
 * decide. Si el JavaScript falla o está desactivado, el formulario funciona igual y la API
 * rechaza lo que tenga que rechazar.
 */

import { useRef, useState } from "react";
import type { FocusEvent, FormEvent, ReactNode } from "react";
import { validarFormularioUsuario, validarPassword, avisoAutoDegradacion } from "@/lib/validacion-usuario";

export default function FormularioValidado({
  action,
  children,
  rolActual,
  esUnoMismo = false,
}: {
  action: string;
  children: ReactNode;
  /** Rol que tiene ahora la cuenta, para detectar que un admin se quita el suyo. */
  rolActual?: string;
  /** true cuando el usuario editado es el que está usando el panel. */
  esUnoMismo?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  /**
   * VALIDACIÓN AL SALIR DEL CAMPO (onBlur), no solo al enviar.
   *
   * Se engancha en el formulario, no en cada input: React propaga el `blur` desde los hijos, así
   * que un solo manejador cubre todos los campos y no hay que tocar el JSX de los inputs.
   *
   * Solo valida el campo que se abandona: si alguien está escribiendo la contraseña, no se le
   * avisa del correo que aún no ha tocado. Y borra el error en cuanto el valor pasa a ser válido,
   * para que el mensaje no se quede pegado después de corregirlo.
   */
  function alSalirDelCampo(e: FocusEvent<HTMLFormElement>) {
    // El blur sube desde el campo hasta el formulario: el target real es el input, pero el tipo
    // del evento lo declara como el formulario. Se convierte por `unknown` porque TypeScript no
    // considera que ambos tipos se solapen.
    const objetivo = e.target as unknown as HTMLInputElement | HTMLSelectElement | null;
    const nombre = objetivo?.name;
    const form = formRef.current;
    if (!nombre || !form) return;

    const datos = new FormData(form);
    setErrores((previos) => {
      const siguientes = { ...previos };

      if (nombre === "email") {
        const r = validarFormularioUsuario({ email: String(datos.get("email") ?? "") });
        if (r.email) siguientes.email = r.email;
        else delete siguientes.email;
      }

      if (nombre === "password" || nombre === "password2") {
        const r = validarPassword(String(datos.get("password") ?? ""), String(datos.get("password2") ?? ""));
        for (const campo of ["password", "password2"] as const) {
          if (r[campo]) siguientes[campo] = r[campo];
          else delete siguientes[campo];
        }
      }

      if (nombre === "rol") {
        const aviso = avisoAutoDegradacion(
          String(datos.get("rol") ?? ""),
          esUnoMismo && String(rolActual ?? "") === "admin",
        );
        if (aviso) siguientes.rol = aviso;
        else delete siguientes.rol;
      }

      return siguientes;
    });
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    const form = formRef.current;
    if (!form) return;
    const datos = new FormData(form);

    const nuevos = validarFormularioUsuario({
      email: String(datos.get("email") ?? ""),
      password: String(datos.get("password") ?? ""),
      password2: String(datos.get("password2") ?? ""),
    });

    // Aviso de autodegradación: solo si la cuenta editada es la propia y el rol deja de ser admin.
    const aviso = avisoAutoDegradacion(
      String(datos.get("rol") ?? rolActual ?? ""),
      esUnoMismo && String(rolActual ?? "") === "admin",
    );
    if (aviso) nuevos.rol = aviso;

    if (Object.keys(nuevos).length > 0) {
      e.preventDefault();
      setErrores(nuevos);
      // Se lleva el foco al primer campo con error: en un formulario largo, el mensaje solo
      // no basta si el campo está fuera de la pantalla.
      const primero = Object.keys(nuevos)[0];
      const campo = form.querySelector<HTMLElement>(`[name="${primero}"]`);
      campo?.focus();
      return;
    }
    setErrores({});
  }

  const Error = ({ campo }: { campo: string }) =>
    errores[campo] ? (
      <p role="alert" style={{ color: "#B3261E", fontSize: 13, margin: "4px 0 8px" }}>
        {errores[campo]}
      </p>
    ) : null;

  return (
    <form
      ref={formRef}
      action={action}
      method="post"
      className="form-edicion"
      onSubmit={alEnviar}
      onBlur={alSalirDelCampo}
      noValidate
    >
      {children}
      <Error campo="email" />
      <Error campo="password" />
      <Error campo="password2" />
      <Error campo="rol" />
    </form>
  );
}
