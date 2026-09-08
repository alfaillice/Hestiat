import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueEvent } from '@/src/server/modules/operations/events';

function validSignature(rawBody:string, signature:string|null){
  const secret=process.env.WHATSAPP_APP_SECRET;
  if(!secret) return process.env.NODE_ENV !== 'production';
  if(!signature?.startsWith('sha256=')) return false;
  const expected='sha256='+crypto.createHmac('sha256',secret).update(rawBody).digest('hex');
  const a=Buffer.from(expected); const b=Buffer.from(signature);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

export async function GET(request: Request){
  const url=new URL(request.url);
  const mode=url.searchParams.get('hub.mode');
  const token=url.searchParams.get('hub.verify_token');
  const challenge=url.searchParams.get('hub.challenge');
  if(mode==='subscribe' && token && token===process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) return new NextResponse(challenge,{status:200});
  return NextResponse.json({error:'Webhook no verificado.'},{status:403});
}

export async function POST(request: Request){
  const rawBody=await request.text();
  if(!validSignature(rawBody,request.headers.get('x-hub-signature-256'))) return NextResponse.json({error:'Firma inválida.'},{status:401});
  try{
    const payload=JSON.parse(rawBody);
    const changes=payload?.entry?.flatMap((e:any)=>e.changes||[])||[];
    const results=[];
    for(const change of changes){
      const messages=change.value?.messages||[];
      for(const message of messages){
        if(message.type!=='text' || !message.id || !message.from) continue;
        results.push(await enqueueEvent({type:'WHATSAPP_INBOUND_PROCESS',payload:{messageId:message.id,from:message.from,body:message.text?.body||'',timestamp:message.timestamp},dedupeKey:`whatsapp-inbound:${message.id}`}));
      }
    }
    return NextResponse.json({ok:true,results});
  }catch(error){
    console.error('WhatsApp webhook error',error);
    return NextResponse.json({ok:false},{status:500});
  }
}
