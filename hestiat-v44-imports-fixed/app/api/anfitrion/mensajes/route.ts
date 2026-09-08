import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/server/lib/auth";
import { prisma } from "@/src/server/lib/prisma";
import { openai } from "@/src/server/lib/openai";
import { getOrCreateAIConversation, updateAIConversation } from "@/src/server/modules/ai/conversation-state";
import { notify } from "@/src/server/lib/notifications";
import { enqueueEvent } from "@/src/server/modules/operations/events";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "HOST" && user.role !== "ADMIN")) return NextResponse.json({error:"No autorizado."},{status:401});
  const messages = await prisma.hostMessage.findMany({
    where:{hostId:user.id},
    include:{guest:{select:{name:true,email:true}},listing:{select:{title:true}},booking:{select:{id:true,checkIn:true,checkOut:true}}},
    orderBy:{createdAt:"desc"}, take:100
  });
  return NextResponse.json({messages});
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user || (user.role!=="HOST" && user.role!=="ADMIN")) return NextResponse.json({error:"No autorizado."},{status:401});
  const {bookingId,body}=await request.json();
  const text=String(body||"").trim();
  if(!bookingId||!text)return NextResponse.json({error:"Mensaje incompleto."},{status:400});
  const booking=await prisma.booking.findFirst({where:{id:bookingId,listing:{hostId:user.id}},include:{listing:true}});
  if(!booking)return NextResponse.json({error:"Reserva no autorizada."},{status:404});
  const msg=await prisma.hostMessage.create({data:{bookingId,listingId:booking.listingId,guestId:booking.guestId,hostId:user.id,senderId:user.id,senderRole:"HOST",channel:"WEB",body:text,status:"UNREAD"}});
  await enqueueEvent({type:"AI_HOST_REPLY_CONTINUATION",payload:{hostMessageId:msg.id},dedupeKey:`ai-host-continuation:${msg.id}`});
  await notify({userId:booking.guestId,bookingId,type:"HOST_REPLY_RECEIVED",title:"Tu anfitrión ha respondido",body:"Tu anfitrión ha respondido. Hestiat continuará la conversación automáticamente.",channels:["IN_APP"],dedupeKey:`host-reply-received:${msg.id}`}).catch(e=>console.error("notification failed",e));
  return NextResponse.json({message:msg,queued:true},{status:201});
}
