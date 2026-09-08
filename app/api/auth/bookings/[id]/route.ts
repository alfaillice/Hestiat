import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../../../src/server/lib/auth";
import {prisma} from "../../../../../src/server/lib/prisma";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"No autenticado."},{status:401});
 const {id}=await params;
 const booking=await prisma.booking.findFirst({
  where:{id,guestId:user.id},
  include:{listing:{include:{photos:{orderBy:{sortOrder:"asc"}},host:{select:{name:true,email:true,phone:true}}}}}
 });
 if(!booking)return NextResponse.json({error:"Viaje no encontrado."},{status:404});
 return NextResponse.json({booking});
}
