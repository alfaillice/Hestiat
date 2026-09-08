import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentUser } from "@/src/server/lib/auth";
import { prisma } from "@/src/server/lib/prisma";
import { r2 } from "@/src/server/lib/r2";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 12 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const owned = await prisma.listing.findFirst({ where: { id, hostId: user.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "Alojamiento no encontrado." }, { status: 404 });
    const { fileName, contentType, size } = await request.json();
    if (!fileName || !allowed.has(contentType) || !Number.isFinite(Number(size)) || Number(size) <= 0 || Number(size) > maxBytes) {
      return NextResponse.json({ error: "Imagen no válida o demasiado grande." }, { status: 400 });
    }
    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_BASE_URL;
    if (!bucket || !publicBase) return NextResponse.json({ error: "R2 no está configurado en el servidor." }, { status: 503 });
    const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
    const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const key = `listings/${id}/${crypto.randomUUID()}-${safe}.${ext}`;
    const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }), { expiresIn: 600 });
    return NextResponse.json({ uploadUrl, publicUrl: `${publicBase.replace(/\/$/, "")}/${key}`, key });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
  }
}
