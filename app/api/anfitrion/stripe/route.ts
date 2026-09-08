import { NextResponse } from "next/server";
import { prisma } from "../../../../src/server/lib/prisma";
import { stripe } from "../../../../src/server/lib/stripe";
import { getCurrentUser } from "../../../../src/server/lib/auth";

export async function POST(request: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });
    const { hostId } = await request.json();
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "HOST" || currentUser.id !== hostId) return NextResponse.json({error:"No autorizado."},{status:401});
    const host = await prisma.user.findUnique({ where: { id: hostId } });
    if (!host || host.role !== "HOST") return NextResponse.json({ error: "Anfitrión no encontrado." }, { status: 404 });

    let accountId = host.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: host.email,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await prisma.user.update({ where: { id: host.id }, data: { stripeAccountId: accountId } });
    }

    const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/anfitrion?stripe=refresh`,
      return_url: `${base}/anfitrion?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ accountId, url: link.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo iniciar Stripe Connect." }, { status: 500 });
  }
}
