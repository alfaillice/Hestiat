# Hestiat Notifications V1

Separates Operations (decision) from Notifications (delivery).

Channels: IN_APP, EMAIL, WHATSAPP.

Every notification is persisted, deduplicated, has delivery status/attempts and can be marked read. Email/WhatsApp adapters are intentionally provider-neutral until credentials/provider are configured.

Current automatic events:
- Guest contacts host -> host notification.
- Host replies -> guest notification.

Production TODO: real transactional email provider, approved WhatsApp Business templates/consent, retry worker with backoff, delivery webhooks, preferences, quiet hours and observability.
