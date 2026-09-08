import { NextResponse } from "next/server";
import { ListingType } from "@prisma/client";
import { createDraftListing } from "@/src/server/modules/listings/repository";
import { getCurrentUser } from "@/src/server/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const type = body.type as ListingType;
    if (!type || !Object.values(ListingType).includes(type)) {
      return NextResponse.json({ error: "type es obligatorio." }, { status: 400 });
    }
    const listing = await createDraftListing({ hostId: user.id, type });
    return NextResponse.json({ id: listing.id, status: listing.status }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo crear el borrador." }, { status: 500 });
  }
}
