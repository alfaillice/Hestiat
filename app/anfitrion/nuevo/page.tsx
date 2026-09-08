import Link from "next/link";

const steps = [
  ["01", "Tipo de alojamiento", "Casa, apartamento, villa, habitación…"],
  ["02", "Ubicación", "Dónde está y cómo encontrarlo"],
  ["03", "Capacidad", "Huéspedes, habitaciones y camas"],
  ["04", "Servicios", "Todo lo que ofrece el alojamiento"],
  ["05", "Fotos", "Las imágenes que harán que destaque"],
  ["06", "Descripción", "Cuenta qué hace especial tu espacio"],
  ["07", "Reglas", "Condiciones para los huéspedes"],
  ["08", "Precio", "Tu tarifa y posibles extras"],
  ["09", "Disponibilidad", "Cuándo quieres recibir reservas"],
  ["10", "Cancelación", "Elige tu política"],
  ["11", "Vista previa", "Comprueba cómo lo verán los viajeros"],
];

export default function NuevoAlojamientoPage() {
  return (
    <main className="host-onboarding">
      <header className="onboarding-header">
        <Link href="/anfitrion" className="brand">hestiat</Link>
        <div className="save-status"><span /> Guardado automáticamente</div>
        <Link href="/anfitrion" className="exit">Salir</Link>
      </header>

      <section className="onboarding-shell">
        <aside className="onboarding-side">
          <p className="eyebrow">NUEVO ALOJAMIENTO</p>
          <h1>Publica un lugar que la gente quiera llamar hogar.</h1>
          <p className="side-copy">
            Te guiaremos paso a paso. Puedes guardar el borrador y continuar
            cuando quieras.
          </p>

          <div className="progress-card">
            <div className="progress-top">
              <span>Progreso</span><strong>0%</strong>
            </div>
            <div className="progress-track"><div /></div>
            <small>Comenzaremos por lo esencial.</small>
          </div>

          <div className="trust-note">
            <div className="trust-icon">⌂</div>
            <div>
              <strong>Tu alojamiento, bajo tu control</strong>
              <p>Tú decides precios, disponibilidad, reglas y cuándo aceptar reservas.</p>
            </div>
          </div>
        </aside>

        <section className="onboarding-main">
          <div className="main-intro">
            <div>
              <p className="eyebrow">GUÍA DE PUBLICACIÓN</p>
              <h2>Vamos a preparar tu alojamiento</h2>
              <p>Solo necesitas unos minutos para empezar. Los detalles pueden completarse después.</p>
            </div>
            <div className="time-pill">Aproximadamente 10–15 min</div>
          </div>

          <div className="steps-grid">
            {steps.map(([num, title, desc], i) => (
              <Link
                key={num}
                href={i === 0 ? "/anfitrion/nuevo/tipo" : "#"}
                className={`step-card ${i === 0 ? "active" : "locked"}`}
                aria-disabled={i !== 0}
              >
                <span className="step-number">{num}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
                <span className="step-arrow">{i === 0 ? "→" : "•"}</span>
              </Link>
            ))}
          </div>

          <div className="onboarding-footer">
            <span>Podrás revisar todo antes de publicar.</span>
            <Link href="/anfitrion/nuevo/tipo" className="primary-btn">
              Empezar <span>→</span>
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
