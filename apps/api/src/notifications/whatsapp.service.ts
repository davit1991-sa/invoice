type SendWhatsAppTextParams = {
  toPhone: string; // international format, e.g. 9955xxxxxxx
  text: string;
};

export class WhatsAppService {
  async sendText(params: SendWhatsAppTextParams) {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';

    // If not configured, mock log (still "ok" for development)
    if (!token || !phoneNumberId) {
      console.log('[WhatsAppService] Not configured. Would send:', params);
      return { mock: true };
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.toPhone,
        type: 'text',
        text: { body: params.text, preview_url: true },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `WhatsApp send failed: ${res.status}`);
    }
    return data;
  }
}
