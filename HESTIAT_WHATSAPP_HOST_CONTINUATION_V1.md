# Hestiat V1 — WhatsApp Host Continuation

## Goal
When a host replies to a conversation waiting for host input, Hestiat automatically resumes the guest conversation.

## Flow
1. Host reply is stored as a message associated with booking/conversation.
2. The conversation moves from WAITING_FOR_HOST to OPEN/ACTION_REQUIRED.
3. Operations Orchestrator loads the full conversation plus verified booking/listing context.
4. AI classifies the host response and decides whether it is sufficient.
5. If sufficient, Hestiat drafts/sends the guest response through the same channel (WhatsApp when permitted).
6. If insufficient, the conversation remains WAITING_FOR_HOST and Hestiat does not invent missing facts.
7. Every transition and outbound message is idempotent and audited.

## Safety
- Never expose private host data beyond what is needed for the guest request.
- Never fabricate access codes, prices, availability, policy decisions, refunds or guarantees.
- Sensitive actions require explicit confirmation.
- WhatsApp consent and applicable messaging-window/template rules are checked by the notification layer.
- If delivery fails, keep the conversation state and create a retryable notification job.

## Recommended states
OPEN
WAITING_FOR_GUEST
WAITING_FOR_HOST
PROCESSING_HOST_REPLY
WAITING_FOR_EXTERNAL_AI
ACTION_REQUIRED
RESOLVED
ESCALATED

## Event
HOST_MESSAGE_RECEIVED
Payload:
- conversationId
- bookingId
- hostId
- messageId
- channel

The event is idempotent by messageId.

## Acceptance tests
- Host replies to a pending check-in question -> guest receives a grounded response.
- Host reply is ambiguous -> Hestiat asks host for clarification.
- No WhatsApp consent -> no WhatsApp send; use allowed fallback.
- Duplicate webhook/message -> exactly one processing path.
- Host message unrelated to guest request -> Hestiat does not leak it; it asks/filters based on relevance.
