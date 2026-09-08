# Hestiat IA — LLM V1

Hestiat IA pasa de respuestas hardcodeadas a un modelo LLM mediante OpenAI Responses API.

El servidor primero obtiene y autoriza la reserva del huésped y construye un contexto limitado:
- reserva;
- alojamiento;
- reglas;
- amenities;
- horario de check-in;
- ubicación;
- anfitrión (solo nombre).

El modelo recibe instrucciones de grounding:
- no inventar;
- reconocer datos ausentes;
- no revelar información privada;
- no ejecutar acciones en esta V1.

Modelo por defecto: `gpt-5.6-luna`, orientado a cargas de alto volumen y coste sensible. Puede cambiarse con `OPENAI_MODEL`.

Producción:
- añadir rate limiting;
- logging/observabilidad sin PII innecesaria;
- moderación/seguridad;
- herramientas explícitas para disponibilidad, mensajes y soporte;
- streaming de respuesta;
- fallback controlado.
