import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../../src/server/lib/auth";
import { prisma } from "../../../../../../../src/server/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const conversation = await prisma.aIConversation.findFirst({ where: { bookingId: id, guestId: user.id } });
  if (!conversation) return NextResponse.json({ status: "OPEN", exists: false });
  return NextResponse.json({ exists: true, conversation });
}
