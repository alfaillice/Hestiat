import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../../src/server/lib/auth";
import {prisma} from "../../../../src/server/lib/prisma";

export async function GET(){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({error:"No autenticado."},{status:401});
 const bookings=await prisma.booking.findMany({
  where:{guestId:user.id},
  include:{listing:{select:{id:true,title:true,city:true,country:true,photos:{where:{isCover:true},take:1}}}},
  orderBy:{checkIn:"desc"}
 });
 return NextResponse.json({bookings});
}
