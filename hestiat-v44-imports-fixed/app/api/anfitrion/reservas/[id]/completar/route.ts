import { NextResponse } from "next/server";
import { prisma } from "@/src/server/lib/prisma";
import { getCurrentUser } from "@/src/server/lib/auth";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user || user.role !== "HOST") return NextResponse.json({error:"No autorizado."},{status:401});
  const {id}=await params;
  const booking=await prisma.booking.findFirst({where:{id,listing:{hostId:user.id},status:"CONFIRMED"}});
  if(!booking) return NextResponse.json({error:"Reserva no encontrada o no confirmada."},{status:404});
  if(new Date()<booking.checkOut) return NextResponse.json({error:"La estancia aún no ha terminado."},{status:409});
  await prisma.booking.update({where:{id},data:{status:"COMPLETED"}});
  return NextResponse.json({completed:true});
}
