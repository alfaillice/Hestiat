# Hestiat IA — Operations V1

## Objetivo
Hestiat IA mantiene conversaciones operativas con estado, no conversaciones aisladas.

## Estados
- OPEN: conversación activa.
- WAITING_FOR_GUEST: Hestiat necesita una aclaración del huésped.
- WAITING_FOR_HOST: Hestiat ha solicitado confirmación al anfitrión.
- WAITING_FOR_EXTERNAL_AI: Hestiat está consultando un asesor externo.
- ACTION_REQUIRED: existe una acción pendiente de soporte/Hestiat.
- RESOLVED: conversación resuelta.
- ESCALATED: requiere intervención humana.

## Regla de autonomía
Hestiat decide cuándo usar herramientas y cuándo consultar un modelo externo. El modelo externo no tiene autoridad para ejecutar acciones.

## Bucle anfitrión → huésped
Cuando el anfitrión responde, Hestiat interpreta la respuesta junto al historial y puede generar una respuesta al huésped basada exclusivamente en lo confirmado. La respuesta queda registrada como `HESTIAT` y la conversación pasa a `RESOLVED` cuando el contenido resuelve la consulta.

## Producción
Antes de producción: sesiones reales, autorización completa, rate limiting, auditoría, colas para notificaciones, plantillas WhatsApp, email, consentimiento, manejo de errores/reintentos y revisión humana para categorías sensibles.
