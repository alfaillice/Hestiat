import assert from 'node:assert/strict';
import { cancellationDecision } from '../src/server/modules/cancellations/policy';

const base = new Date('2030-06-20T12:00:00Z');
const at = (days: number) => new Date(base.getTime() + days * 86400000);
const total = 10000;
assert.equal(cancellationDecision('FLEXIBLE', total, at(2), base).refundableCents, 10000);
assert.equal(cancellationDecision('FLEXIBLE', total, at(1), base).refundableCents, 10000);
assert.equal(cancellationDecision('FLEXIBLE', total, new Date(base.getTime()+23*3600000), base).refundableCents, 0);
assert.equal(cancellationDecision('MODERATE', total, at(6), base).refundableCents, 10000);
assert.equal(cancellationDecision('MODERATE', total, at(3), base).refundableCents, 5000);
assert.equal(cancellationDecision('MODERATE', total, new Date(base.getTime()+23*3600000), base).refundableCents, 0);
assert.equal(cancellationDecision('FIRM', total, at(31), base).refundableCents, 10000);
assert.equal(cancellationDecision('FIRM', total, at(10), base).refundableCents, 5000);
assert.equal(cancellationDecision('FIRM', total, at(6), base).refundableCents, 0);
console.log('V27 policy tests passed');
