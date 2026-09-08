import { calculateBookingPrice } from "../src/server/modules/bookings/pricing";

// Fast invariant checks that do not require Stripe/PostgreSQL credentials.
const pricing = calculateBookingPrice({
  nightlyPricesCents: [10000, 10000],
  cleaningCents: 2000,
  taxesCents: 0,
  platformFeeRate: 0.08,
  currency: "EUR",
});

if (pricing.subtotalCents !== 20000) throw new Error("V35 subtotal invariant failed");
if (pricing.platformFeeCents !== 1600) throw new Error("V35 platform fee invariant failed");
if (pricing.totalCents !== 23600) throw new Error("V35 total invariant failed");

console.log("V35 checkout invariants: OK");
