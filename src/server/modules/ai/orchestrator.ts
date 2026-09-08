import { openai } from "../../lib/openai";

type Decision = {
  intent: string;
  confidence: number;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  decision: "ANSWER" | "USE_TOOLS" | "ASK_HOST" | "SUPPORT" | "ESCALATE_HUMAN" | "EXTERNAL_ADVISOR";
  reason: string;
};

const COMPLEX_PATTERNS = [
  /reclam|indemniz|compens|denunc|abogado|legal/i,
  /estafa|fraude|cargo.*no reconozco|tarjeta/i,
  /accidente|herid|ambulancia|polic[ií]a|peligro/i,
  /discrimin|acoso|amenaz/i,
];

export function heuristicDecision(question: string): Decision {
  const q = question.trim();
  if (COMPLEX_PATTERNS.some((r) => r.test(q))) {
    return { intent: "COMPLEX_OR_SENSITIVE", confidence: 0.93, urgency: /accidente|herid|peligro|amenaz/i.test(q) ? "CRITICAL" : "HIGH", decision: "ESCALATE_HUMAN", reason: "Tema sensible o de alto impacto." };
  }
  if (/anfitri[oó]n|propietari|host/i.test(q)) return { intent: "HOST_CONTACT", confidence: 0.91, urgency: "MEDIUM", decision: "ASK_HOST", reason: "El huésped solicita intervención del anfitrión." };
  if (/entrar|llave|c[oó]digo|check.?in|llegamos|llegada/i.test(q)) return { intent: "CHECK_IN", confidence: 0.88, urgency: "MEDIUM", decision: "USE_TOOLS", reason: "La pregunta puede resolverse con datos de check-in." };
  if (/reserva|fecha|hu[eé]spedes|precio|pago|cancel/i.test(q)) return { intent: "BOOKING", confidence: 0.82, urgency: "MEDIUM", decision: "USE_TOOLS", reason: "Necesita datos verificables de la reserva." };
  if (/problema|no funciona|aver[ií]a|roto|sucio|ruido/i.test(q)) return { intent: "ACCOMMODATION_ISSUE", confidence: 0.86, urgency: "HIGH", decision: "SUPPORT", reason: "Existe una posible incidencia de alojamiento." };
  return { intent: "GENERAL", confidence: 0.55, urgency: "LOW", decision: "EXTERNAL_ADVISOR", reason: "La intención no es suficientemente específica para resolverla con reglas locales." };
}

export async function classifyWithHestiat(question: string, context: string): Promise<Decision> {
  const heuristic = heuristicDecision(question);
  if (!openai || heuristic.confidence >= 0.85 || heuristic.decision === "ESCALATE_HUMAN") return heuristic;
  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_ORCHESTRATOR_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions: `Eres el motor de decisión interno de Hestiat. Clasifica la conversación, no respondas al huésped. Hestiat mantiene el control. Devuelve SOLO JSON válido con: intent, confidence (0-1), urgency (LOW/MEDIUM/HIGH/CRITICAL), decision (ANSWER/USE_TOOLS/ASK_HOST/SUPPORT/ESCALATE_HUMAN/EXTERNAL_ADVISOR), reason. Nunca autorices cambios sensibles ni inventes datos. Contexto: ${context}`,
      input: question,
    });
    const parsed = JSON.parse(response.output_text);
    return { ...heuristic, ...parsed } as Decision;
  } catch {
    return heuristic;
  }
}

export async function askExternalAdvisor(question: string, context: string) {
  if (!openai) return null;
  const response = await openai.responses.create({
    model: process.env.OPENAI_ADVISOR_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions: `Actúa como asesor externo de Hestiat. No eres Hestiat ni tienes autoridad para ejecutar acciones. Ayuda a razonar sobre la conversación. No inventes hechos. Si falta información, indícalo. Devuelve una recomendación breve para el motor de Hestiat, no un mensaje al huésped. Contexto verificado: ${context}`,
    input: question,
  });
  return response.output_text;
}
