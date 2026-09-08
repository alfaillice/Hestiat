import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/src/server/lib/prisma";
import { sendTransactionalEmail } from "@/src/server/lib/email";

function recordTokenHash(value: string) { return value.slice(0, 32); }

export async function POST(request: Request) {
  const { email, name } = await request.json();
  const normalized=String(email||"").trim().toLowerCase();
  if(!normalized || !normalized.includes("@")) return NextResponse.json({error:"Introduce un email válido."},{status:400});

  const recentTokens = await prisma.authToken.count({
    where: { createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) }, user: { email: normalized } },
  });
  if (recentTokens >= 3) {
    return NextResponse.json({ error: "Has solicitado varios enlaces. Espera unos minutos e inténtalo de nuevo." }, { status: 429 });
  }

  const user=await prisma.user.upsert({
    where:{email:normalized},
    update:{name:name||undefined},
    create:{email:normalized,name:name||null,role:"GUEST"}
  });

  const raw=crypto.randomBytes(32).toString("hex");
  const tokenHash=crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.authToken.deleteMany({where:{userId:user.id,usedAt:null}});
  await prisma.authToken.create({
    data:{userId:user.id,tokenHash,expiresAt:new Date(Date.now()+15*60*1000)}
  });

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const url=`${baseUrl.replace(/\/$/, "")}/api/auth/verify?token=${raw}`;
  const emailResult = await sendTransactionalEmail({
    to: normalized,
    subject: "Tu enlace para entrar en Hestiat",
    body: `Hola${user.name ? ` ${user.name}` : ""}.\n\nPulsa este enlace para entrar en Hestiat:\n${url}\n\nEl enlace caduca en 15 minutos y solo puede utilizarse una vez.`,
    dedupeKey: `auth-magic-link:${recordTokenHash(tokenHash)}`,
  });

  if (!emailResult.sent && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No hemos podido enviar el enlace. Inténtalo de nuevo." }, { status: 503 });
  }

  return NextResponse.json({
    sent:true,
    message:"Te hemos enviado un enlace para continuar.",
    ...(process.env.NODE_ENV !== "production" ? {devUrl:url} : {})
  });
}
