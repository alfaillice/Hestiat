import Link from "next/link";

const days = [
  ["1","available"],["2","available"],["3","available"],["4","available"],["5","available"],["6","available"],["7","blocked"],
  ["8","blocked"],["9","blocked"],["10","available"],["11","available"],["12","available"],["13","available"],["14","available"],
  ["15","blocked"],["16","blocked"],["17","available"],["18","available"],["19","available"],["20","available"],["21","available"],
  ["22","available"],["23","available"],["24","available"],["25","available"],["26","available"],["27","available"],["28","available"],
  ["29","available"],["30","available"]
];

export default function DisponibilidadPage() {
  return (
    <main className="host-onboarding">
      <header className="onboarding-header">
        <Link href="/anfitrion" className="brand">hestiat</Link>
        <div className="save-status"><span /> Guardado automáticamente</div>
        <Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link>
      </header>
      <section className="form-shell availability-shell">
        <div className="form-heading">
          <p className="eyebrow">PASO 9 DE 11</p>
          <h1>¿Cuándo quieres recibir huéspedes?</h1>
          <p>Marca las fechas en las que tu alojamiento estará disponible. Podrás cambiarlo en cualquier momento.</p>
        </div>
        <div className="availability-layout">
          <div className="calendar-card">
            <div className="calendar-header"><button>‹</button><strong>Septiembre 2026</strong><button>›</button></div>
            <div className="weekdays"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div className="calendar-grid"><div className='cal-week'><span className="cal-empty"></span><span className="cal-day available">1</span><span className="cal-day available">2</span><span className="cal-day available">3</span><span className="cal-day available">4</span><span className="cal-day available">5</span><span className="cal-day available">6</span></div><div className='cal-week'><span className="cal-day blocked">7</span><span className="cal-day blocked">8</span><span className="cal-day blocked">9</span><span className="cal-day available">10</span><span className="cal-day available">11</span><span className="cal-day available">12</span><span className="cal-day available">13</span></div><div className='cal-week'><span className="cal-day available">14</span><span className="cal-day blocked">15</span><span className="cal-day blocked">16</span><span className="cal-day available">17</span><span className="cal-day available">18</span><span className="cal-day available">19</span><span className="cal-day available">20</span></div><div className='cal-week'><span className="cal-day available">21</span><span className="cal-day available">22</span><span className="cal-day available">23</span><span className="cal-day available">24</span><span className="cal-day available">25</span><span className="cal-day available">26</span><span className="cal-day available">27</span></div><div className='cal-week'><span className="cal-day available">28</span><span className="cal-day available">29</span><span className="cal-day available">30</span><span className="cal-empty"></span><span className="cal-empty"></span><span className="cal-empty"></span><span className="cal-empty"></span></div></div>
            <div className="calendar-legend"><span><i className="legend-available" /> Disponible</span><span><i className="legend-blocked" /> Bloqueado</span></div>
          </div>
          <div className="availability-settings">
            <div className="setting-card"><span className="setting-eyebrow">ANTICIPACIÓN</span><strong>Aceptar reservas con</strong><div className="select-like">1 día de antelación <span>⌄</span></div></div>
            <div className="setting-card"><span className="setting-eyebrow">ESTANCIA</span><strong>Mínimo de noches</strong><div className="select-like">2 noches <span>⌄</span></div></div>
            <div className="setting-card"><span className="setting-eyebrow">CHECK-IN</span><strong>Horario habitual</strong><div className="time-row"><span>15:00</span><em>→</em><span>22:00</span></div></div>
          </div>
        </div>
        <div className="availability-note"><span>↻</span><div><strong>Tu calendario siempre estará sincronizado</strong><p>Cuando exista una reserva, esas noches quedarán bloqueadas automáticamente. Más adelante podremos añadir sincronización con otros calendarios.</p></div></div>
        <div className="form-actions"><Link href="/anfitrion/nuevo/precio" className="secondary-btn">← Atrás</Link><Link href="/anfitrion/nuevo/cancelacion" className="primary-btn">Continuar <span>→</span></Link></div>
      </section>
    </main>
  );
}
