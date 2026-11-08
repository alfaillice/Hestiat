/**
 * NOTA DE PENDIENTE PARA LAS PÁGINAS LEGALES.
 *
 * Si falta un dato legal obligatorio, NO se inventa y NO se esconde: se marca aquí, en la propia
 * página y a la vista, para que no se publique como si estuviera cerrado. Cuando se complete, se
 * quita la nota y queda la página definitiva.
 */
export default function NotaLegal({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="aviso"
      style={{
        borderColor: "var(--hestiat-primary)",
        background: "color-mix(in srgb, var(--hestiat-primary) 12%, white)",
        marginTop: 22,
      }}
    >
      <b>⚠ Pendiente de completar.</b> {children}
    </div>
  );
}
