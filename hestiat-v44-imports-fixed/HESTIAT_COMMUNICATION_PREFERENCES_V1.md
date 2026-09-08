# Hestiat Communication Preferences V1

Hestiat keeps in-app notifications always available and separates transactional communication from marketing consent.

- Email transactional: enabled by default for service notifications, user can disable it.
- WhatsApp transactional: disabled by default; requires a phone and explicit opt-in.
- Email marketing: disabled by default.
- WhatsApp marketing: disabled by default and requires a phone.
- Opt-in/out timestamps are stored for WhatsApp transactional consent.
- Notification delivery checks preferences before attempting external delivery.

Production TODO: validate phone ownership, provider delivery webhooks, template management for WhatsApp, consent audit log, privacy/terms links, rate limiting and localization.
