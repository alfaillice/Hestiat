import { getListingAvailability } from './unified';

export async function isListingAvailable(listingId: string, checkIn: Date, checkOut: Date) {
  const result = await getListingAvailability(listingId, checkIn, checkOut);
  return result.available;
}
