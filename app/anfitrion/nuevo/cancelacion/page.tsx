import Link from "next/link";
const policies = [
  ["Flexible","Reembolso completo hasta 1 día antes de la llegada.","Más reservas"],
  ["Moderada","Reembolso completo hasta 5 días antes de la llegada.","Equilibrio"],
  ["Firme","Reembolso completo hasta 30 días antes de la llegada.","Más protección"],
];
export default function CancelacionPage() {
  return <main className="host-onboarding">
    <header className="onboarding-header"><Link href="/anfitrion" className="brand">hestiat</Link><div className="save-status"><span/> Guardado automáticamente</div><Link href="/anfitrion/nuevo" className="exit">Guardar y salir</Link></header>
    <section className="form-shell cancellation-shell">
      <div className="form-heading"><p className="eyebrow">PASO 10 DE 11</p><h1>Elige tu política de cancelación</h1><p>Una política clara genera confianza y te permite decidir cuánto riesgo quieres asumir.</p></div>
      <div className="policy-list">{policies.map(([name,desc,tag],i)=><button className={`policy-card ${i===0?"selected":""}`} key={name}><div className="policy-radio">{i===0?"✓":""}</div><div className="policy-copy"><strong>{name}</strong><p>{desc}</p></div><span>{tag}</span></button>)}</div>
      <div className="cancellation-note"><span>ⓘ</span><p>La política seleccionada se mostrará antes de que el huésped confirme la reserva.</p></div>
      <div className="form-actions"><Link href="/anfitrion/nuevo/disponibilidad" className="secondary-btn">← Atrás</Link><Link href="/anfitrion/nuevo/vista-previa" className="primary-btn">Ver alojamiento <span>→</span></Link></div>
    </section>
  </main>;
}
