import { prisma } from "../../lib/prisma";
import type { AIConversationStatus } from "@prisma/client";

export async function getOrCreateAIConversation(bookingId: string, guestId: string) {
  return prisma.aIConversation.upsert({
    where: { bookingId_guestId: { bookingId, guestId } },
    create: { bookingId, guestId },
    update: {},
  });
}

export async function updateAIConversation(bookingId: string, guestId: string, data: {
  status?: AIConversationStatus; intent?: string; urgency?: string; confidence?: number;
  lastSummary?: string; lastAction?: string; waitingSince?: Date | null; resolvedAt?: Date | null;
}) {
  return prisma.aIConversation.update({ where: { bookingId_guestId: { bookingId, guestId } }, data });
}
