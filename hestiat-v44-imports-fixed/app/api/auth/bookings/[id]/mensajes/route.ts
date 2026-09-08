import {NextResponse} from "next/server";
import {getCurrentUser} from "@/src/server/lib/auth";
import {prisma} from "@/src/server/lib/prisma";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"No autenticado."},{status:401});
 const {id}=await params;
 const booking=await prisma.booking.findFirst({where:{id,guestId:user.id},select:{id:true}});
 if(!booking)return NextResponse.json({error:"Viaje no encontrado."},{status:404});
 const messages=await prisma.hostMessage.findMany({where:{bookingId:id},orderBy:{createdAt:"asc"},select:{id:true,senderRole:true,body:true,status:true,createdAt:true}});
 await prisma.hostMessage.updateMany({where:{bookingId:id,guestId:user.id,status:"UNREAD",senderRole:"HOST"},data:{status:"READ"}});
 return NextResponse.json({messages});
}
