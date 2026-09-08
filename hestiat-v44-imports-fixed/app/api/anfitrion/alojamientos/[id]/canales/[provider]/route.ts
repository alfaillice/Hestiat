import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/lib/prisma';
import { getCurrentUser } from '@/src/server/lib/auth';
import { enqueueICalSync } from '@/src/server/modules/channels/events';
export async function POST(_:Request,{params}:{params:Promise<{id:string;provider:string}>}){
 const u=await getCurrentUser(); const {id,provider}=await params;
 if(!u||u.role!=='HOST') return NextResponse.json({error:'No autorizado'},{status:403});
 if(!(await prisma.listing.findFirst({where:{id,hostId:u.id},select:{id:true}}))) return NextResponse.json({error:'No encontrado'},{status:404});
 const p=provider.toUpperCase() as any; const c=await prisma.listingChannelConnection.findUnique({where:{listingId_provider:{listingId:id,provider:p}}});
 if(!c) return NextResponse.json({error:'Canal no conectado'},{status:404});
 if(p!=='ICAL') return NextResponse.json({error:'Sincronización directa pendiente de acceso de partner/API'},{status:409});
 const job=await enqueueICalSync(c.id); return NextResponse.json({queued:true,jobId:job.id});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string;provider:string}>}){
 const u=await getCurrentUser(); const {id,provider}=await params;
 if(!u||u.role!=='HOST') return NextResponse.json({error:'No autorizado'},{status:403});
 if(!(await prisma.listing.findFirst({where:{id,hostId:u.id},select:{id:true}}))) return NextResponse.json({error:'No encontrado'},{status:404});
 const p=provider.toUpperCase() as any; const c=await prisma.listingChannelConnection.findUnique({where:{listingId_provider:{listingId:id,provider:p}}});
 if(!c) return NextResponse.json({error:'Canal no conectado'},{status:404});
 await prisma.listingChannelConnection.update({where:{id:c.id},data:{status:'DISCONNECTED'}}); return NextResponse.json({disconnected:true});
}
