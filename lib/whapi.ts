const BASE_URL      = process.env.WHAPI_BASE_URL        ?? 'https://gate.whapi.cloud';
const TOKEN         = process.env.WHAPI_TOKEN           ?? '';
const MAPBOX_TOKEN  = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const STORE_LNG     = process.env.STORE_LNG ?? '-97.503669';
const STORE_LAT     = process.env.STORE_LAT ?? '25.848049';

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

export async function sendImage({ to, imageUrl, caption }: {
  to: string;
  imageUrl: string;
  caption: string;
}): Promise<void> {
  const url = `${BASE_URL}/messages/image`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ to: toChatId(to), media: imageUrl, caption }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[whapi] sendImage error:', res.status, text);
    throw new Error(`whapi error ${res.status}: ${text}`);
  }
}

export function buildStoreMapUrl(): string {
  const lng = STORE_LNG;
  const lat = STORE_LAT;
  const pin = `pin-l+E63232(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${pin}/${lng},${lat},16,0/600x400?access_token=${MAPBOX_TOKEN}`;
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
