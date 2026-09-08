import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../../../src/server/lib/auth";
import {prisma} from "../../../../../src/server/lib/prisma";

export async function GET(){
 const user=await getCurrentUser();
 if(!user||user.role!=="HOST")return NextResponse.json({error:"No autorizado."},{status:401});
 const listings=await prisma.listing.findMany({
  where:{hostId:user.id},
  include:{photos:{where:{isCover:true},take:1},_count:{select:{bookings:true}}},
  orderBy:{updatedAt:"desc"}
 });
 return NextResponse.json({listings});
}
