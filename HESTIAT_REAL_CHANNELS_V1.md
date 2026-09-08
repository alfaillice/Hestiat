# Hestiat — Real Communication Channels V1

## Email: Resend
Hestiat now has a real transactional-email adapter using the Resend REST API.

Required environment variables:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

The notification layer still controls consent, deduplication and authorization. Resend is only the delivery provider.

Resend supports an idempotency key on email requests; Hestiat passes its notification dedupe key when available.

Before production:
1. Verify `hestiat.com` (or the chosen sending domain) in Resend.
2. Configure SPF/DKIM as instructed by the provider.
3. Add webhooks for delivery/bounce/complaint events and map them to Notification status.

## WhatsApp Business Cloud API
Hestiat now has a direct adapter for the WhatsApp Cloud API.

Required:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- optional `WHATSAPP_API_VERSION` (default `v21.0` in this V1 adapter)

The adapter sends text messages through `/{phone-number-id}/messages`.

Important production rule: WhatsApp messaging policy determines when free-form text is allowed. Business-initiated messages outside the customer-service window generally need an approved template. Therefore this V1 adapter must not be considered a complete WhatsApp production implementation until templates, inbound webhooks and the service-window state are implemented.

## Architecture
`notify()` -> preference/consent checks -> dedupe -> provider adapter -> Notification audit record.

Providers never decide whether Hestiat is allowed to communicate. Hestiat decides first.
