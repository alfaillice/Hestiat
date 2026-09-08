import { ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export async function createDraftListing(input: {
  hostId: string;
  type: Prisma.ListingCreateInput["type"];
}) {
  return prisma.listing.create({
    data: {
      host: { connect: { id: input.hostId } },
      type: input.type,
      status: ListingStatus.DRAFT,
    },
  });
}

export async function publishListing(id: string) {
  return prisma.listing.update({
    where: { id },
    data: { status: ListingStatus.PUBLISHED },
  });
}

export async function getPublishedListings() {
  return prisma.listing.findMany({
    where: { status: ListingStatus.PUBLISHED },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}
