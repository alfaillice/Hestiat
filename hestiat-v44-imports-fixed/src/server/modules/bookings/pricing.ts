export type PriceBreakdown = {
  nights: number;
  subtotalCents: number;
  cleaningCents: number;
  taxesCents: number;
  platformFeeCents: number;
  totalCents: number;
  currency: string;
};

export function calculateBookingPrice(input: {
  nightlyPricesCents: number[];
  cleaningCents?: number;
  platformFeeRate?: number;
  taxRate?: number;
  currency?: string;
}): PriceBreakdown {
  const nights = input.nightlyPricesCents.length;
  const subtotalCents = input.nightlyPricesCents.reduce((sum, value) => sum + value, 0);
  const cleaningCents = input.cleaningCents ?? 0;
  const platformFeeCents = Math.round((subtotalCents + cleaningCents) * (input.platformFeeRate ?? 0.08));
  const taxesCents = Math.round((subtotalCents + cleaningCents + platformFeeCents) * (input.taxRate ?? 0));
  return {
    nights,
    subtotalCents,
    cleaningCents,
    taxesCents,
    platformFeeCents,
    totalCents: subtotalCents + cleaningCents + taxesCents + platformFeeCents,
    currency: input.currency ?? "EUR",
  };
}
