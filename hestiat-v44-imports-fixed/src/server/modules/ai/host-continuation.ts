import { prisma } from '../../lib/prisma';
import { openai } from '../../lib/openai';
import { notify } from '../../lib/notifications';
import { updateAIConversation } from './conversation-state';

export async function continueGuestConversationAfterHostReply(hostMessageId: string) {
  const hostMessage = await prisma.hostMessage.findUnique({ where: { id: hostMessageId }, include: { booking: { include: { listing: true } }, guest: true } });
  if (!hostMessage || hostMessage.senderRole !== 'HOST') return { skipped: true, reason: 'not-host-message' };
  if (hostMessage.aiProcessedAt) return { skipped: true, reason: 'already-processed' };

  const conversation = await prisma.aIConversation.findUnique({ where: { bookingId_guestId: { bookingId: hostMessage.bookingId, guestId: hostMessage.guestId } } });
  if (!conversation || conversation.status !== 'WAITING_FOR_HOST') {
    await prisma.hostMessage.update({ where: { id: hostMessage.id }, data: { aiProcessedAt: new Date() } });
    return { skipped: true, reason: 'conversation-not-waiting' };
  }

  const history = await prisma.hostMessage.findMany({ where: { bookingId: hostMessage.bookingId }, orderBy: { createdAt: 'asc' }, take: 40, select: { senderRole: true, body: true, channel: true, createdAt: true } });
  const context = JSON.stringify({
    booking: { id: hostMessage.booking.id, status: hostMessage.booking.status, checkIn: hostMessage.booking.checkIn, checkOut: hostMessage.booking.checkOut, guests: hostMessage.booking.guests },
    listing: { title: hostMessage.booking.listing.title, city: hostMessage.booking.listing.city, address: hostMessage.booking.listing.address, rules: hostMessage.booking.listing.houseRules, checkInInstructions: hostMessage.booking.listing.checkInInstructions },
    conversation: { intent: conversation.intent, summary: conversation.lastSummary },
  });
  const transcript = history.map(m => `${m.senderRole}: ${m.body}`).join('\n');

  if (!openai) throw new Error('OpenAI no configurado para continuar la conversación');
  const decisionResponse = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions: 'Eres el motor interno de Hestiat. Determina si la última respuesta del anfitrión responde de forma suficiente a la pregunta pendiente del huésped. Devuelve SOLO JSON: {"resolved":true|false,"reason":"...","reply":"..."}. Si resolved=true, reply debe ser breve, cálida y fiel a lo confirmado por el anfitrión. Si false, reply debe ser una petición breve al anfitrión indicando qué dato falta. Nunca inventes.',
    input: `Contexto verificado:\n${context}\n\nHistorial:\n${transcript}`
  });
  const raw = decisionResponse.output_text?.trim() || '{}';
  let decision: { resolved?: boolean; reason?: string; reply?: string };
  try { decision = JSON.parse(raw); } catch { throw new Error('Respuesta inválida del evaluador de Hestiat IA'); }

  if (!decision.resolved) {
    await prisma.hostMessage.update({ where: { id: hostMessage.id }, data: { aiProcessedAt: new Date() } });
    await updateAIConversation(hostMessage.bookingId, hostMessage.guestId, { status: 'WAITING_FOR_HOST', lastAction: 'HOST_REPLY_NEEDS_CLARIFICATION', lastSummary: decision.reason?.slice(0, 500) || conversation.lastSummary || undefined });
    if (decision.reply) await notify({ userId: hostMessage.hostId, bookingId: hostMessage.bookingId, type: 'HOST_CLARIFICATION_NEEDED', title: 'Falta un dato para responder al huésped', body: decision.reply, channels: ['IN_APP'], dedupeKey: `host-clarification:${hostMessage.id}` });
    return { resolved: false };
  }

  const reply = decision.reply?.trim();
  if (!reply) throw new Error('Hestiat no recibió una respuesta final');
  const generated = await prisma.hostMessage.create({ data: { bookingId: hostMessage.bookingId, listingId: hostMessage.listingId, guestId: hostMessage.guestId, hostId: hostMessage.hostId, senderId: hostMessage.hostId, senderRole: 'HESTIAT', channel: 'WHATSAPP', body: reply, status: 'UNREAD' } });
  await prisma.aIInteraction.create({ data: { bookingId: hostMessage.bookingId, guestId: hostMessage.guestId, intent: conversation.intent || 'HOST_RESPONSE', confidence: 0.95, urgency: conversation.urgency || 'MEDIUM', autonomous: true, externalAIUsed: false, decision: 'ANSWER', response: reply } });
  const delivery = await notify({ userId: hostMessage.guestId, bookingId: hostMessage.bookingId, type: 'WHATSAPP_HOST_CONTINUATION', title: 'Respuesta de tu anfitrión', body: reply, channels: ['WHATSAPP'], dedupeKey: `host-continuation:${hostMessage.id}` });
  const delivered = delivery.some((r: any) => r.status === 'SENT');
  await prisma.hostMessage.update({ where: { id: hostMessage.id }, data: { aiProcessedAt: new Date() } });
  if (!delivered) {
    await notify({ userId: hostMessage.guestId, bookingId: hostMessage.bookingId, type: 'HOST_CONTINUATION_FALLBACK', title: 'Tu anfitrión ha respondido', body: reply, channels: ['IN_APP', 'EMAIL'], dedupeKey: `host-continuation-fallback:${hostMessage.id}` });
  }
  await updateAIConversation(hostMessage.bookingId, hostMessage.guestId, { status: delivered ? 'RESOLVED' : 'ACTION_REQUIRED', lastAction: delivered ? 'HOST_REPLY_DELIVERED' : 'HOST_REPLY_FALLBACK', lastSummary: reply.slice(0, 500), resolvedAt: delivered ? new Date() : null, waitingSince: delivered ? null : conversation.waitingSince });
  return { resolved: delivered, messageId: generated.id };
}
