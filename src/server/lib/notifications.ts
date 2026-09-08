import { prisma } from "./prisma";
import { sendTransactionalEmail } from "./email";
import { sendTransactionalWhatsApp } from "./whatsapp";

export type NotificationChannel = "IN_APP" | "EMAIL" | "WHATSAPP";

type NotifyInput = {
  userId: string;
  bookingId?: string;
  type: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  dedupeKey?: string;
};

async function deliverExternal(channel: NotificationChannel, user: { email: string; phone: string | null }, title: string, body: string, dedupeKey?: string) {
  if (channel === "EMAIL") {
    return sendTransactionalEmail({ to: user.email, subject: title, body, dedupeKey });
  }
  if (channel === "WHATSAPP") {
    if (!user.phone) return { sent: false, error: "Teléfono ausente" };
    return sendTransactionalWhatsApp({ to: user.phone, body: `${title}\n\n${body}`, dedupeKey });
  }
  return { sent: true };
}

export async function notify(input: NotifyInput) {
  const channels: NotificationChannel[] = input.channels?.length ? input.channels : ["IN_APP"];
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, phone: true, communicationPreferences: true } });
  if (!user) throw new Error("Usuario no encontrado");
  const results = [];
  for (const channel of channels) {
    const prefs = user.communicationPreferences;
    if (channel === "EMAIL" && prefs && !prefs.emailTransactional) continue;
    if (channel === "WHATSAPP" && (!prefs?.whatsappTransactional || !user.phone)) continue;
    const key = input.dedupeKey ? `${input.dedupeKey}:${channel}` : undefined;
    if (key) {
      const existing = await prisma.notification.findUnique({ where: { dedupeKey: key } });
      if (existing) { results.push(existing); continue; }
    }
    const created = await prisma.notification.create({ data: { userId: input.userId, bookingId: input.bookingId, channel, type: input.type, title: input.title, body: input.body, dedupeKey: key } });
    if (channel === "IN_APP") {
      const sent = await prisma.notification.update({ where: { id: created.id }, data: { status: "SENT", sentAt: new Date() } });
      results.push(sent);
      continue;
    }
    const delivery = await deliverExternal(channel, user, input.title, input.body, key);
    const updated = await prisma.notification.update({ where: { id: created.id }, data: { status: delivery.sent ? "SENT" : "FAILED", sentAt: delivery.sent ? new Date() : null, attempts: { increment: 1 }, lastError: delivery.error ?? null } });
    results.push(updated);
  }
  return results;
}
