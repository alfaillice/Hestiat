import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';
import { cancellationDecision } from './policy';
import { lockListing } from '../availability/unified';

export async function cancelGuestBooking(bookingId: string, guestId: string) {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, guestId }, include: { payment: true, listing: true, payout: true } });
    if (!booking) throw new Error('BOOKING_NOT_FOUND');
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw new Error('BOOKING_NOT_CANCELLABLE');
    await lockListing(tx, booking.listingId);

    if (booking.status === 'PENDING') {
      if (booking.paymentIntentId && stripe) await stripe.paymentIntents.cancel(booking.paymentIntentId).catch(() => null);
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
      return { cancelled: true, refundedCents: 0, percentage: 0, reason: 'Reserva pendiente cancelada.' };
    }

    if (!booking.payment || booking.payment.status !== 'SUCCEEDED' || !booking.paymentIntentId || !stripe) {
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
      return { cancelled: true, refundedCents: 0, percentage: 0, reason: 'Reserva cancelada sin pago liquidado.' };
    }

    const decision = cancellationDecision(booking.listing.cancellationPolicy, booking.totalCents, booking.checkIn);
    const alreadyRefunded = booking.payment.refundedCents;
    const targetRefund = Math.max(0, decision.refundableCents - alreadyRefunded);
    let refundId = booking.payment.stripeRefundId ?? null;
    let refundAmount = 0;
    if (targetRefund > 0) {
      const refund = await stripe.refunds.create({ payment_intent: booking.paymentIntentId, amount: targetRefund }, { idempotencyKey: `booking-refund:${booking.id}:${targetRefund}` });
      refundId = refund.id;
      refundAmount = refund.amount;
      await tx.refundRecord.create({ data: { paymentId: booking.payment.id, bookingId, stripeRefundId: refund.id, amountCents: refund.amount, reason: `GUEST_CANCELLATION:${booking.listing.cancellationPolicy}` } });
    }
    const totalRefunded = alreadyRefunded + refundAmount;
    await tx.paymentRecord.update({ where: { id: booking.payment.id }, data: { refundedCents: totalRefunded, stripeRefundId: refundId, status: totalRefunded >= booking.payment.amountCents ? 'REFUNDED' : totalRefunded > 0 ? 'PARTIALLY_REFUNDED' : 'SUCCEEDED' } });
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    return { cancelled: true, refundedCents: refundAmount, totalRefundedCents: totalRefunded, percentage: decision.percentage, label: decision.label, reason: decision.reason };
  });
}

export async function cancelHostBooking(bookingId: string, hostId: string) {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, listing: { hostId }, status: { in: ['PENDING', 'CONFIRMED'] } }, include: { payment: true, listing: true, payout: true } });
    if (!booking) throw new Error('BOOKING_NOT_FOUND');
    await lockListing(tx, booking.listingId);
    if (booking.status === 'PENDING') {
      if (booking.paymentIntentId && stripe) await stripe.paymentIntents.cancel(booking.paymentIntentId).catch(() => null);
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
      return { cancelled: true, refundedCents: 0 };
    }
    if (!booking.payment || booking.payment.status !== 'SUCCEEDED' || !booking.paymentIntentId || !stripe) throw new Error('PAID_BOOKING_UNAVAILABLE');
    const remaining = Math.max(0, booking.payment.amountCents - booking.payment.refundedCents);
    let refunded = 0;
    if (remaining > 0) {
      const refund = await stripe.refunds.create({ payment_intent: booking.paymentIntentId, amount: remaining }, { idempotencyKey: `host-cancellation-refund:${booking.id}` });
      refunded = refund.amount;
      await tx.refundRecord.create({ data: { paymentId: booking.payment.id, bookingId, stripeRefundId: refund.id, amountCents: refund.amount, reason: 'HOST_CANCELLATION' } });
      await tx.paymentRecord.update({ where: { id: booking.payment.id }, data: { refundedCents: booking.payment.refundedCents + refunded, stripeRefundId: refund.id, status: 'REFUNDED' } });
    }
    if (booking.payout?.status === 'PAID' && booking.payout.stripeTransferId && booking.payment) {
      // Transfer reversal is intentionally not automatic here: Stripe Connect funds may have moved.
      // The payout is marked for manual reconciliation rather than silently creating a negative balance.
      await tx.hostPayout.update({ where: { id: booking.payout.id }, data: { status: 'FAILED', failureMessage: 'HOST_CANCELLATION_AFTER_PAYOUT_REQUIRES_RECONCILIATION' } });
    }
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    return { cancelled: true, refundedCents: refunded, hostPayoutRequiresReconciliation: Boolean(booking.payout?.status === 'PAID') };
  });
}
