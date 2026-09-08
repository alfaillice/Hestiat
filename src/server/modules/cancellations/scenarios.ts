import { CancellationPolicy } from '@prisma/client';
import { cancellationDecision } from './policy';

export function cancellationScenario(policy: CancellationPolicy, totalCents: number, checkIn: Date, now = new Date()) {
  const decision = cancellationDecision(policy, totalCents, checkIn, now);
  return { policy, totalCents, ...decision };
}
