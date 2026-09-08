import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../src/server/lib/auth";
import { prisma } from "../../../../src/server/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const preferences = await prisma.communicationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const body = await request.json();
  const data: any = {};
  if (typeof body.emailTransactional === "boolean") data.emailTransactional = body.emailTransactional;
  if (typeof body.emailMarketing === "boolean") data.emailMarketing = body.emailMarketing;
  if (typeof body.whatsappMarketing === "boolean") data.whatsappMarketing = body.whatsappMarketing;
  if (typeof body.whatsappTransactional === "boolean") {
    if (body.whatsappTransactional) {
      if (!user.phone) return NextResponse.json({ error: "Añade un teléfono antes de activar WhatsApp." }, { status: 400 });
      data.whatsappTransactional = true;
      data.whatsappOptInAt = new Date();
      data.whatsappOptOutAt = null;
    } else {
      data.whatsappTransactional = false;
      data.whatsappOptOutAt = new Date();
    }
  }
  const preferences = await prisma.communicationPreference.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  return NextResponse.json({ preferences });
}
