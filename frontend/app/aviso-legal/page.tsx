import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Aviso legal — Hestiat",
  descripcion:
    "Datos identificativos del titular de Hestiat, condiciones de acceso y uso del sitio, propiedad intelectual y responsabilidad sobre los contenidos publicados.",
  ruta: "/aviso-legal",
});

/**
 * AVISO LEGAL (Ley 34/2002, de servicios de la sociedad de la información).
 * Solo se dice lo que consta: los datos que faltan van marcados, no inventados.
 */
export default function AvisoLegal() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Aviso legal</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Última actualización: 8 de octubre de 2026.
      </p>

      <section className="seccion-home">
        <h2>1. Titular del sitio</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Titular:</b> JM TRIVINO
          </li>
          <li>
            <b>NIF/CIF:</b> 22009686C
          </li>
          <li>
            <b>Domicilio:</b> Partida Carrus P1-137, Alicante (España)
          </li>
          <li>
            <b>Correo de contacto:</b> <a href="mailto:hola@hestiat.com">hola@hestiat.com</a>
          </li>
          <li>
            <b>Nombre del sitio y dominio:</b> Hestiat — https://hestiat.com
          </li>
          <li>
            <b>Actividad:</b> plataforma de publicación y consulta de alojamientos, experiencias y
            servicios turísticos en España.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>2. Condiciones de acceso y uso</h2>
        <p style={{ lineHeight: 1.7 }}>
          El acceso a este sitio es libre y gratuito. El uso del sitio atribuye la condición de usuario
          e implica la aceptación de este aviso legal, de las{" "}
          <Link href="/condiciones-uso">condiciones de uso</Link>, de la{" "}
          <Link href="/privacidad">política de privacidad</Link> y de la{" "}
          <Link href="/cookies">política de cookies</Link>.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          El usuario se compromete a hacer un uso conforme a la ley, a la buena fe y a este aviso, y a
          no emplear el sitio para actividades ilícitas o que puedan dañar su funcionamiento o el de
          terceros.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Contenidos del catálogo</h2>
        <p style={{ lineHeight: 1.7 }}>
          Buena parte de las fichas de alojamientos, experiencias y servicios procede de{" "}
          <b>fuentes públicas</b> (OpenStreetMap y otras) y figura con la autoría de su origen. Otra
          parte la publican los propios anfitriones desde su panel.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Las <b>fotografías</b> del catálogo son, en su mayoría, imágenes de referencia del entorno, y
          así se indica en cada ficha; cuando se muestra la imagen oficial del propio sitio, se rotula
          como tal. Los <b>precios</b> solo se muestran cuando están publicados, se señalan como
          orientativos cuando lo son, y cuando no hay ninguno la ficha indica «Consultar».
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Si eres el titular de un negocio o alojamiento y quieres completar, corregir o retirar su
          ficha, puedes hacerlo desde <Link href="/reclamar">reclamar una ficha</Link> o escribiendo al
          correo de contacto.
        </p>
      </section>

      <section className="seccion-home">
        <h2>4. Propiedad intelectual e industrial</h2>
        <p style={{ lineHeight: 1.7 }}>
          La marca, el diseño, los textos propios y el código de Hestiat pertenecen a su titular. Los
          datos y las imágenes procedentes de fuentes públicas pertenecen a sus autores y se muestran
          con su atribución. No se permite reproducir el contenido propio del sitio con fines
          comerciales sin autorización.
        </p>
      </section>

      <section className="seccion-home">
        <h2>5. Responsabilidad</h2>
        <p style={{ lineHeight: 1.7 }}>
          El titular no garantiza que el sitio esté libre de interrupciones ni que los datos de todas
          las fichas estén siempre actualizados, precisamente porque una parte procede de fuentes
          externas. Trabaja para corregir cualquier error que se le comunique. Las relaciones derivadas
          de una reserva se establecen entre el huésped y el anfitrión: Hestiat no forma parte de ese
          acuerdo ni interviene en el pago.
        </p>
      </section>

      <section className="seccion-home">
        <h2>6. Legislación aplicable</h2>
        <p style={{ lineHeight: 1.7 }}>
          Este aviso se rige por la legislación española. Para cualquier controversia, y cuando la ley
          no disponga otra cosa en protección de los consumidores, las partes se someten a los juzgados
          y tribunales que correspondan conforme a derecho.
        </p>
      </section>

      <NotaLegal>
        Faltan dos datos que no constan y que no se inventan: (1) los <b>datos de inscripción en el
        Registro Mercantil</b>, que solo proceden si el titular es una sociedad y no una persona física;
        y (2) el <b>lugar concreto de resolución de conflictos</b>, si quieres fijarlo expresamente.
        Dime los valores y los dejo escritos.
      </NotaLegal>
    </main>
  );
}
