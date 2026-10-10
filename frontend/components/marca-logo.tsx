/**
 * LA MARCA, EN GRÁFICO.
 *
 * Donde antes iba la palabra «hestiat» escrita como texto, va el logotipo. Es el mismo archivo que
 * usa la cabecera, así que la marca está en un solo sitio y no hay dos versiones que se puedan
 * desincronizar. El texto alternativo nombra la imagen; el tamaño se ajusta con la clase, no con
 * estilos sueltos.
 */
export default function MarcaLogo({ className = "marca-logo-mini" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/marca/logotipo-web.svg" alt="Hestiat" className={className} width="64" height="24" />
  );
}
