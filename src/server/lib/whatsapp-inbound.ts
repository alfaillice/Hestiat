import { prisma } from './prisma';
import { openai } from './openai';
import { sendTransactionalWhatsApp } from './whatsapp';
import { askExternalAdvisor, classifyWithHestiat } from '../modules/ai/orchestrator';
import { notify } from './notifications';

function normalizePhone(value:string){ return value.replace(/[^\d+]/g,'').replace(/^00/,'+'); }
function minutesToTime(m:number){const h=Math.floor(m/60).toString().padStart(2,'0');const min=(m%60).toString().padStart(2,'0');return `${h}:${min}`;}

export async function processIncomingWhatsAppMessage(input:{messageId:string;from:string;body:string;timestamp?:string}){
  const existing=await prisma.whatsAppInboundEvent.findUnique({where:{providerMessageId:input.messageId}});
  if(existing) return {processed:false,reason:'duplicate'};
  const event=await prisma.whatsAppInboundEvent.create({data:{providerMessageId:input.messageId,fromPhone:normalizePhone(input.from),body:input.body,status:'PROCESSING'}});
  try{
    const phone=normalizePhone(input.from);
    const guest=await prisma.user.findFirst({where:{phone:{equals:phone}}});
    if(!guest){await prisma.whatsAppInboundEvent.update({where:{id:event.id},data:{status:'IGNORED',error:'Número no asociado a una cuenta Hestiat'}});return {processed:true,handled:false};}
    const booking=await prisma.booking.findFirst({where:{guestId:guest.id,status:{in:['CONFIRMED','PENDING']},checkOut:{gte:new Date()}},orderBy:{checkIn:'asc'},include:{listing:true}});
    if(!booking){await prisma.whatsAppInboundEvent.update({where:{id:event.id},data:{status:'IGNORED',error:'No hay reserva activa'}});return {processed:true,handled:false};}
    await prisma.hostMessage.create({data:{bookingId:booking.id,listingId:booking.listingId,guestId:guest.id,hostId:booking.listing.hostId,senderId:guest.id,senderRole:'GUEST',channel:'WHATSAPP',providerMessageId:input.messageId,body:input.body,status:'UNREAD'}});
    const context=JSON.stringify({booking:{id:booking.id,status:booking.status,checkIn:booking.checkIn,checkOut:booking.checkOut,guests:booking.guests},listing:{title:booking.listing.title,city:booking.listing.city,address:booking.listing.address,checkInFromMinutes:booking.listing.checkInFromMinutes,checkInToMinutes:booking.listing.checkInToMinutes,checkInInstructions:booking.listing.checkInInstructions,houseRules:booking.listing.houseRules,amenities:booking.listing.amenities}});
    const decision=await classifyWithHestiat(input.body,context);
    let answer=''; let externalAIUsed=false;
    if(decision.decision==='ASK_HOST'){
      await notify({userId:booking.listing.hostId,bookingId:booking.id,type:'HOST_MESSAGE',title:'Nuevo mensaje de WhatsApp',body:input.body,channels:['IN_APP','EMAIL','WHATSAPP'],dedupeKey:`wa-host:${input.messageId}`}).catch(()=>{});
      answer='He recibido tu mensaje y se lo he enviado a tu anfitrión. En cuanto tenga respuesta, te la comunicaré por aquí.';
      await prisma.aIConversation.upsert({where:{bookingId_guestId:{bookingId:booking.id,guestId:guest.id}},create:{bookingId:booking.id,guestId:guest.id,status:'WAITING_FOR_HOST',intent:decision.intent,urgency:decision.urgency,confidence:decision.confidence,lastSummary:input.body,lastAction:'ASK_HOST',waitingSince:new Date()},update:{status:'WAITING_FOR_HOST',intent:decision.intent,urgency:decision.urgency,confidence:decision.confidence,lastSummary:input.body,lastAction:'ASK_HOST',waitingSince:new Date()}});
    } else if(decision.decision==='SUPPORT' || decision.decision==='ESCALATE_HUMAN'){
      const category=/check.?in|llave|entrar|llegada/i.test(input.body)?'CHECK_IN':/pago|cargo|tarjeta/i.test(input.body)?'PAYMENT':/peligro|accidente|herid/i.test(input.body)?'SAFETY':'ACCOMMODATION';
      await prisma.supportRequest.create({data:{bookingId:booking.id,guestId:guest.id,category,message:input.body}});
      answer=decision.decision==='ESCALATE_HUMAN'?'Voy a escalar esta situación a nuestro equipo de soporte para que pueda ayudarte correctamente.':'He registrado la incidencia y voy a ayudarte a resolverla.';
    } else if(decision.intent==='CHECK_IN'){
      const l=booking.listing; const ci=l.checkInInstructions as any;
      answer=`Tu check-in está previsto entre ${minutesToTime(l.checkInFromMinutes)} y ${minutesToTime(l.checkInToMinutes)}.`;
      if(ci?.accessInstructions) answer+=` Acceso: ${ci.accessInstructions}`;
      else answer+=' No tengo todavía instrucciones de acceso adicionales confirmadas.';
    } else {
      if(decision.decision==='EXTERNAL_ADVISOR'){const advice=await askExternalAdvisor(input.body,context);externalAIUsed=!!advice;}
      if(openai){const response=await openai.responses.create({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions:'Eres Hestiat IA. Responde en español, breve y cálido. Usa solo hechos del contexto. No inventes. Si falta información, dilo. El canal es WhatsApp.',input:`Contexto verificado: ${context}\nMensaje del huésped: ${input.body}`});answer=response.output_text;} else answer='He recibido tu mensaje. Ahora mismo no puedo procesarlo automáticamente, pero ya lo he registrado.';
    }
    await prisma.aIInteraction.create({data:{bookingId:booking.id,guestId:guest.id,intent:decision.intent,confidence:decision.confidence,urgency:decision.urgency,autonomous:!externalAIUsed,externalAIUsed,decision:decision.decision,response:answer}});
    const prefs=await prisma.communicationPreference.findUnique({where:{userId:guest.id}});
    if(prefs?.whatsappTransactional && guest.phone) await sendTransactionalWhatsApp({to:guest.phone,body:answer,dedupeKey:`wa-reply:${input.messageId}`});
    else await prisma.notification.create({data:{userId:guest.id,bookingId:booking.id,channel:'IN_APP',type:'WHATSAPP_REPLY',title:'Respuesta de Hestiat IA',body:answer,dedupeKey:`wa-reply-app:${input.messageId}`,status:'SENT',sentAt:new Date()}});
    await prisma.whatsAppInboundEvent.update({where:{id:event.id},data:{status:'PROCESSED',bookingId:booking.id,guestId:guest.id,response:answer}});
    return {processed:true,handled:true,bookingId:booking.id,answer};
  }catch(error){await prisma.whatsAppInboundEvent.update({where:{id:event.id},data:{status:'FAILED',error:String(error).slice(0,500)}}).catch(()=>{});throw error;}
}
