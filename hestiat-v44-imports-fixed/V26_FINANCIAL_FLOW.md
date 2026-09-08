# Hestiat V26 — Financial Flow

- Platform charge: guest pays the Booking total to Hestiat's Stripe account.
- Platform fee is retained by Hestiat; host amount is total minus platform fee.
- No destination transfer is created at checkout.
- `PaymentRecord` is the idempotent internal financial ledger linked 1:1 to Booking.
- Repeated Stripe webhooks are ignored by `StripeWebhookEvent` and payment records are upserted.
- Guest cancellation of a paid booking creates a Stripe refund with an idempotency key and marks the booking/payment refunded.
- Host payout requires a completed stay, a successful payment, Connect onboarding and a 24-hour post-checkout availability window.
- Transfer creation uses `host-payout:{bookingId}` idempotency and is persisted in `HostPayout`.
- This is a V1 marketplace money flow. Production legal/tax rules, partial refunds, disputes, reserves and reconciliation still require explicit policy/configuration.
