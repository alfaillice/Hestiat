function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[char] as string));
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  body: string;
  dedupeKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, error: 'Resend no configurado: RESEND_API_KEY/RESEND_FROM_EMAIL' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(input.dedupeKey ? { 'Idempotency-Key': input.dedupeKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:640px;margin:auto"><h2 style="font-weight:600">Hestiat</h2><p>${escapeHtml(input.body).replace(/\n/g, '<br>')}</p></div>`,
      text: input.body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false, error: `Resend ${response.status}: ${detail.slice(0, 500)}` };
  }
  const data = await response.json() as { id?: string };
  return { sent: true, providerMessageId: data.id ?? null };
}
