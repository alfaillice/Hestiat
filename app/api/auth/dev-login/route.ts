import { NextResponse } from "next/server";
import { prisma } from "../../../../src/server/lib/prisma";
import { createSession } from "../../../../src/server/lib/auth";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({error:"Dev login deshabilitado."},{status:404});
  const {email,name,role}=await request.json();
  if(!email) return NextResponse.json({error:"Email requerido."},{status:400});
  const normalized=String(email).trim().toLowerCase();
  const user=await prisma.user.upsert({
    where:{email:normalized},
    update:{name:name||undefined,role:role==="HOST"?"HOST":"GUEST"},
    create:{email:normalized,name:name||null,role:role==="HOST"?"HOST":"GUEST"}
  });
  await createSession(user.id);
  return NextResponse.json({id:user.id,email:user.email,role:user.role});
}
