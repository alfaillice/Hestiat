import { NextResponse } from "next/server";
import { prisma } from "@/src/server/lib/prisma";
import { getCurrentUser } from "@/src/server/lib/auth";
import { stripe } from "@/src/server/lib/stripe";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user=await getCurrentUser(); if(!user || user.role!=="HOST") return NextResponse.json({error:"No autorizado."},{status:401});
  if(!stripe) return NextResponse.json({error:"Stripe no está configurado."},{status:503});
  const {id}=await params;
  const booking=await prisma.booking.findFirst({where:{id,listing:{hostId:user.id}},include:{payment:true,listing:true}});
  if(!booking || booking.status!=="COMPLETED") return NextResponse.json({error:"La reserva debe estar completada."},{status:409});
  if(booking.status!=="COMPLETED") return NextResponse.json({error:"La reserva debe estar completada."},{status:409});
  if(!booking.payment || !["SUCCEEDED","PARTIALLY_REFUNDED"].includes(booking.payment.status)) return NextResponse.json({error:"No existe un pago liquidado."},{status:409});
  if(booking.payment.hostAmountCents<=0) return NextResponse.json({error:"Importe para anfitrión inválido."},{status:409});
  if(!user.stripeAccountId) return NextResponse.json({error:"Completa primero Stripe Connect."},{status:409});
  const existing=await prisma.hostPayout.findUnique({where:{bookingId:id}});
  if(existing?.status==="PAID") return NextResponse.json({paid:true,transferId:existing.stripeTransferId});
  const availableAt=new Date(booking.checkOut.getTime()+24*60*60*1000);
  if(new Date()<availableAt) return NextResponse.json({error:"El pago estará disponible 24 horas después de la salida.",availableAt},{status:409});
  const refundRatio = booking.payment.amountCents > 0 ? booking.payment.refundedCents / booking.payment.amountCents : 0;
  const payoutAmount = Math.max(0, Math.round(booking.payment.hostAmountCents * (1 - refundRatio)));
  if (payoutAmount <= 0) return NextResponse.json({error:"No queda importe liquidable para el anfitrión."},{status:409});
  const transfer=await stripe.transfers.create({amount:payoutAmount,currency:booking.currency.toLowerCase(),destination:user.stripeAccountId,metadata:{bookingId:id,listingId:booking.listingId}}, {idempotencyKey:`host-payout:${id}`});
  await prisma.hostPayout.upsert({where:{bookingId:id},create:{bookingId:id,hostId:user.id,amountCents:payoutAmount,currency:booking.currency,availableAt,stripeTransferId:transfer.id,status:"PAID",paidAt:new Date()},update:{stripeTransferId:transfer.id,status:"PAID",paidAt:new Date(),failureMessage:null}});
  return NextResponse.json({paid:true,transferId:transfer.id,amountCents:payoutAmount});
}
