import { prisma } from '../../lib/prisma';
import { processIncomingWhatsAppMessage } from '../../lib/whatsapp-inbound';
import { continueGuestConversationAfterHostReply } from '../ai/host-continuation';
import { notify } from '../../lib/notifications';
import { stripe } from '../../lib/stripe';
import { syncICalConnection, generateICal } from '../channels/ical';

export type EventPayload = Record<string, any>;

export async function dispatchEvent(type: string, payload: EventPayload) {
  switch (type) {
    case 'AI_HOST_REPLY_CONTINUATION':
      return continueGuestConversationAfterHostReply(String(payload.hostMessageId));
    case 'WHATSAPP_INBOUND_PROCESS':
      return processIncomingWhatsAppMessage({ messageId: String(payload.messageId), from: String(payload.from), body: String(payload.body), timestamp: payload.timestamp });
    case 'NOTIFICATION_DISPATCH':
      return notify({ userId: String(payload.userId), bookingId: payload.bookingId, type: String(payload.notificationType), title: String(payload.title), body: String(payload.body), channels: payload.channels, dedupeKey: payload.dedupeKey });
    case 'BOOKING_EXPIRE_PENDING':
      return expirePendingBookings();
    case 'CHANNEL_ICAL_SYNC_REQUESTED':
      return syncICalConnection(String(payload.connectionId));
    case 'CHANNEL_AVAILABILITY_PUSH_REQUESTED':
      return pushICalCalendar(String(payload.connectionId));
    default:
      throw new Error(`Evento no soportado: ${type}`);
  }
}

export async function expirePendingBookings() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 60_000);
  const candidates = await prisma.booking.findMany({
    where: { status: 'PENDING', OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lt: cutoff } }] },
    select: { id: true, paymentIntentId: true },
    take: 100,
  });
  let expired = 0;
  let confirmed = 0;
  for (const booking of candidates) {
    if (!booking.paymentIntentId || !stripe) {
      const r = await prisma.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      expired += r.count;
      continue;
    }
    const intent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
    if (intent.status === 'succeeded') {
      const r = await prisma.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'CONFIRMED', paidAt: new Date(), paymentFailureMessage: null } });
      confirmed += r.count;
      continue;
    }
    if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)) {
      await stripe.paymentIntents.cancel(intent.id).catch(() => null);
      const r = await prisma.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      expired += r.count;
    }
  }
  return { expired, confirmed };
}

export async function pushICalCalendar(connectionId: string) {
  const connection = await prisma.listingChannelConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.provider !== 'ICAL') throw new Error('Conexión iCal no válida.');
  return { feedUrl: `/api/calendario/ical/${connection.feedToken ?? ''}`, listingId: connection.listingId };
}
