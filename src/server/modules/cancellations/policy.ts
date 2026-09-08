import { CancellationPolicy } from '@prisma/client';

export type CancellationDecision = {
  refundableCents: number;
  percentage: number;
  label: string;
  reason: string;
};

/** V1 commercial policy. Keep these rules centralized so UX, checkout and refunds agree. */
export function cancellationDecision(policy: CancellationPolicy, totalCents: number, checkIn: Date, now = new Date()): CancellationDecision {
  const hours = (checkIn.getTime() - now.getTime()) / 3600000;
  const days = hours / 24;
  let percentage = 0;
  let label = 'Sin reembolso';
  let reason = 'La cancelación se realiza fuera del plazo reembolsable.';

  if (policy === 'FLEXIBLE') {
    if (hours >= 24) { percentage = 100; label = 'Reembolso total'; reason = 'Cancelación con al menos 24 horas antes de la entrada.'; }
  } else if (policy === 'MODERATE') {
    if (days >= 5) { percentage = 100; label = 'Reembolso total'; reason = 'Cancelación con al menos 5 días antes de la entrada.'; }
    else if (hours >= 24) { percentage = 50; label = 'Reembolso del 50%'; reason = 'Cancelación entre 24 horas y 5 días antes de la entrada.'; }
  } else {
    if (days >= 30) { percentage = 100; label = 'Reembolso total'; reason = 'Cancelación con al menos 30 días antes de la entrada.'; }
    else if (days >= 7) { percentage = 50; label = 'Reembolso del 50%'; reason = 'Cancelación entre 7 y 30 días antes de la entrada.'; }
  }

  return { refundableCents: Math.max(0, Math.min(totalCents, Math.round(totalCents * percentage / 100))), percentage, label, reason };
}
