export async function sendTransactionalWhatsApp(input: {
  to: string;
  body: string;
  dedupeKey?: string;
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneNumberId) return { sent: false, error: 'WhatsApp Cloud API no configurada' };

  const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to.replace(/\s+/g, ''),
      type: 'text',
      text: { preview_url: false, body: input.body },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false, error: `WhatsApp ${response.status}: ${detail.slice(0, 500)}` };
  }
  const data = await response.json() as { messages?: Array<{ id?: string }> };
  return { sent: true, providerMessageId: data.messages?.[0]?.id ?? null };
}
