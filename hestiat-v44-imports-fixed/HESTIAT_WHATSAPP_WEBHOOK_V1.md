# Hestiat WhatsApp Webhook V1

Endpoint: `POST /api/webhooks/whatsapp`

Verification: `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`

## Flujo
1. Meta envía el mensaje entrante.
2. Hestiat deduplica por `providerMessageId`.
3. Busca al huésped por teléfono y su reserva activa.
4. Guarda el mensaje en `HostMessage`.
5. Hestiat interpreta intención/urgencia.
6. Puede responder, abrir soporte o pedir intervención al anfitrión.
7. Registra `AIInteraction` y el evento de webhook.
8. Responde por WhatsApp solo si existe consentimiento transaccional; si no, deja notificación interna.

## Producción pendiente
- Validar firma `X-Hub-Signature-256` con el App Secret.
- Configurar webhook en Meta.
- Usar número E.164 normalizado de forma consistente.
- Configurar plantillas aprobadas cuando corresponda.
- Configurar expiración/reintentos y observabilidad.
- No almacenar más datos de WhatsApp de los necesarios.
