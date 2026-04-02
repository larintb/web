const BASE_URL = process.env.WHAPI_BASE_URL ?? 'https://gate.whapi.cloud';
const TOKEN    = process.env.WHAPI_TOKEN    ?? '';

// Normaliza el número de teléfono al formato whapi (chat_id)
// Input: "+52 868 347 2565" | "5286834725655" | "5286834725655@s.whatsapp.net"
export function toChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.includes('@') ? phone : `${digits}@s.whatsapp.net`;
}

interface SendTextOptions {
  to: string;      // número con o sin @s.whatsapp.net
  body: string;
}

export async function sendText({ to, body }: SendTextOptions): Promise<void> {
  // El Bearer token en whapi.cloud ya identifica el canal — no va en la URL
  const url = `${BASE_URL}/messages/text`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ to: toChatId(to), body }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[whapi] sendText error:', res.status, text);
    throw new Error(`whapi error ${res.status}: ${text}`);
  }
}

// Construye el mensaje de bienvenida con el link del menú
export function buildWelcomeMessage(appUrl: string): string {
  return (
    `¡Hola! 👋 Gracias por contactar a *Crispy Charles* 🍗\n\n` +
    `Estamos listos para atenderte. Aquí puedes ver nuestro menú completo y hacer tu pedido:\n\n` +
    `🔗 ${appUrl}\n\n` +
    `¡Que disfrutes tu orden! 🔥`
  );
}
