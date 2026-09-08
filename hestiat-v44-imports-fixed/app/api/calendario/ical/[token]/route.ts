import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/lib/prisma';
import { generateICal } from '@/src/server/modules/channels/ical';
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const c=await prisma.listingChannelConnection.findUnique({where:{feedToken:token}});
 if(!c||c.provider!=='ICAL'||c.status==='DISCONNECTED') return new NextResponse('Not found',{status:404});
 const [bookings,blocks]=await Promise.all([
  prisma.booking.findMany({where:{listingId:c.listingId,status:{in:['PENDING','CONFIRMED']}},select:{id:true,checkIn:true,checkOut:true,status:true}}),
  prisma.availabilityDay.findMany({where:{listingId:c.listingId,status:'BLOCKED'},select:{date:true}})
 ]);
 const calendar=generateICal(c.listingId,bookings,blocks); const etag=`"${crypto.createHash('sha256').update(calendar).digest('hex')}"`;
 if(request.headers.get('if-none-match')===etag) return new NextResponse(null,{status:304,headers:{ETag:etag}});
 return new NextResponse(calendar,{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'no-cache, max-age=0, must-revalidate',ETag:etag}});
}
