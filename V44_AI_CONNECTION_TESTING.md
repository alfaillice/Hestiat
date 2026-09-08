# Hestiat V44 — IA conectada y preparada para pruebas

## Estado
Hestiat ya integra OpenAI mediante la Responses API. V44 añade un health endpoint y un gate estático para poder probar la conexión de forma controlada.

- Cliente: `src/server/lib/openai.ts`
- Motor/orquestador: `src/server/modules/ai/orchestrator.ts`
- IA del viaje: `app/api/auth/bookings/[id]/ia/route.ts`
- UI: `app/mi-viaje/[id]/page.tsx`
- Health: `GET /api/internal/ai/health`
- Gate: `npm run test:v44`

Modelo por defecto: `gpt-5.6-luna`. Puede cambiarse mediante `OPENAI_MODEL`.

## Prueba real en staging
1. Configurar `OPENAI_API_KEY` como secreto del servidor. Nunca exponerla al cliente.
2. Mantener `OPENAI_MODEL=gpt-5.6-luna` o seleccionar otro modelo disponible.
3. Arrancar la aplicación.
4. Consultar `/api/internal/ai/health`: debe devolver `configured`.
5. Entrar con un huésped autenticado en `/mi-viaje/[id]`.
6. Probar `¿Cómo hago el check-in?`.
7. Probar una pregunta libre sobre la reserva.
8. Probar una solicitud al anfitrión y verificar que se crea el mensaje real.
9. Probar una incidencia y verificar que se crea soporte.

## Seguridad
La clave OpenAI vive únicamente en servidor. La IA recibe contexto limitado de la reserva y debe usar herramientas para datos verificables. Las acciones sensibles no deben ejecutarse sin confirmación explícita.

## Limitación actual
El repositorio puede validarse estáticamente en este entorno, pero la llamada real al modelo requiere `OPENAI_API_KEY` y conectividad de red en staging. No se marca como prueba real hasta ejecutar esa llamada.
