# Hestiat IA — Orchestrator V1

## Principio
Hestiat IA es autónoma por defecto. La inteligencia externa se utiliza solo cuando aporta valor y nunca obtiene autoridad para ejecutar acciones.

## Flujo
Mensaje → clasificación Hestiat → herramientas/datos verificados → asesor externo si hace falta → validación Hestiat → respuesta/acción/escalado.

## Decisiones
- ANSWER: respuesta con contexto ya disponible.
- USE_TOOLS: consultar datos verificables.
- ASK_HOST: intervención del anfitrión.
- SUPPORT: crear incidencia Hestiat.
- EXTERNAL_ADVISOR: pedir una recomendación a un modelo externo.
- ESCALATE_HUMAN: temas sensibles o de alto impacto.

## Control
El asesor externo no puede acceder directamente a herramientas ni cambiar reservas, pagos, permisos o estados. Hestiat decide qué contexto enviar y valida la recomendación.

## Auditoría
Cada interacción registra intención, confianza, urgencia, decisión, uso de IA externa y respuesta final en `AIInteraction`.

## Producción
Pendiente: políticas de minimización de datos, límites/coste del asesor externo, redacción de PII, rate limiting, trazabilidad completa de tool calls y evaluación automática de respuestas.
