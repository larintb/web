const BASE_URL = process.env.WHATSAPP_API_URL ?? 'https://wa.puntaje.online';
const API_KEY  = process.env.WHATSAPP_API_KEY ?? '';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const STORE_LNG    = process.env.STORE_LNG ?? '-97.503669';
const STORE_LAT    = process.env.STORE_LAT ?? '25.848049';

async function waRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `WhatsApp API error ${res.status}`);
  return data;
}

export async function sendText({ to, body }: { to: string; body: string }) {
  return waRequest('POST', '/api/send-text', { to, body });
}

export async function sendImage({
  to,
  imageUrl,
  caption,
}: {
  to: string;
  imageUrl: string;
  caption?: string;
}) {
  return waRequest('POST', '/api/send-image', { to, imageUrl, caption });
}

export async function sendDocument({
  to,
  documentUrl,
  filename,
  caption,
}: {
  to: string;
  documentUrl: string;
  filename: string;
  caption?: string;
}) {
  return waRequest('POST', '/api/send-document', { to, documentUrl, filename, caption });
}

export async function checkNumber(phone: string) {
  return waRequest('GET', `/api/check-number/${encodeURIComponent(phone)}`);
}

export async function getStatus() {
  return waRequest('GET', '/api/status');
}

/** Normaliza el número para logs/debug — el gateway acepta cualquier formato */
export function toChatId(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildStoreMapUrl(): string {
  const pin = `pin-l+E63232(${STORE_LNG},${STORE_LAT})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${pin}/${STORE_LNG},${STORE_LAT},16,0/600x400?access_token=${MAPBOX_TOKEN}`;
}

export function buildWelcomeMessage(appUrl: string): string {
  return (
    `¡Hola! 👋 Gracias por contactar a *Crispy Charles* 🍗\n\n` +
    `Estamos listos para atenderte. Aquí puedes ver nuestro menú completo y hacer tu pedido:\n\n` +
    `🔗 ${appUrl}\n\n` +
    `¡Que disfrutes tu orden! 🔥`
  );
}
