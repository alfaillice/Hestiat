import { strict as assert } from "node:assert";
import { calculateBookingPrice } from "../src/server/modules/bookings/pricing";

const quote = calculateBookingPrice({ nightlyPricesCents: [12000, 14000, 14000], currency: "EUR" });
assert.equal(quote.nights, 3);
assert.equal(quote.subtotalCents, 40000);
assert.equal(quote.cleaningCents, 0);
assert.equal(quote.platformFeeCents, 3200);
assert.equal(quote.taxesCents, 0);
assert.equal(quote.totalCents, 43200);
assert.equal(quote.currency, "EUR");
console.log("V32 pricing invariants: OK");
