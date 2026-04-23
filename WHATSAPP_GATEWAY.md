# WhatsApp Gateway — Documentación para Agentes IA

Este documento describe cómo usar el WhatsApp API Gateway desde cualquier aplicación o agente IA.
El gateway es un servicio HTTP independiente que permite enviar y recibir mensajes de WhatsApp.

---

## Configuración base

El agente necesita dos variables de entorno para operar:

```
WHATSAPP_API_URL=https://wa-pedidos.tudominio.com   # URL del gateway (o http://localhost:3001 en desarrollo)
WHATSAPP_API_KEY=<api-key-del-gateway>
```

Todas las requests deben incluir el header:
```
X-API-Key: <WHATSAPP_API_KEY>
Content-Type: application/json
```

---

## Verificar estado antes de enviar

Antes de enviar mensajes, verificar que la sesión esté activa.

```
GET /api/status
```

Respuesta esperada cuando está listo:
```json
{
  "status": "ready",
  "phone": "5218683472565",
  "uptime": 3600,
  "reconnectAttempts": 0,
  "queue": {
    "pending": 0,
    "processing": 0,
    "totalProcessed": 47,
    "rateLimits": {
      "minute": { "used": 2, "limit": 15 },
      "hour":   { "used": 12, "limit": 100 },
      "day":    { "used": 47, "limit": 500 }
    }
  }
}
```

**Si `status` no es `"ready"`, no intentar enviar mensajes.**
Posibles valores: `"initializing"`, `"qr_pending"`, `"authenticated"`, `"ready"`, `"disconnected"`.

---

## Enviar mensaje de texto

```
POST /api/send-text
```

```json
{
  "to": "+52 868 830 2741",
  "body": "Hola, tu pedido #1234 está listo para recoger."
}
```

El campo `"to"` acepta cualquier formato:
- `"+52 868 830 2741"` — con espacios y código de país
- `"+528688302741"` — sin espacios
- `"8688302741"` — sin código de país (usa el default configurado, típicamente 52 para México)
- `"528688302741"` — dígitos puros con código de país

Respuesta exitosa:
```json
{
  "success": true,
  "messageId": "true_528688302741@c.us_3EB0ABC123...",
  "to": "528688302741@c.us",
  "timestamp": 1713200000
}
```

Errores posibles:
- `400` — número inválido o body vacío
- `404` — número no registrado en WhatsApp
- `500` — sesión no lista o error interno (revisar `status` primero)

---

## Enviar imagen

```
POST /api/send-image
```

Con URL pública:
```json
{
  "to": "+52 868 830 2741",
  "imageUrl": "https://ejemplo.com/foto-producto.jpg",
  "caption": "Así quedó tu pedido"
}
```

Con base64:
```json
{
  "to": "+52 868 830 2741",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
  "caption": "Comprobante de pago"
}
```

`caption` es opcional en ambos casos.

---

## Enviar documento / archivo

```
POST /api/send-document
```

```json
{
  "to": "+52 868 830 2741",
  "documentUrl": "https://ejemplo.com/factura-1234.pdf",
  "filename": "Factura-1234.pdf",
  "caption": "Tu factura del mes"
}
```

`filename` es **obligatorio** — es el nombre que verá el receptor.
Formatos soportados: PDF, DOCX, XLSX, ZIP, y cualquier MIME type.

---

## Enviar ubicación

```
POST /api/send-location
```

```json
{
  "to": "+52 868 830 2741",
  "lat": 25.6714,
  "lng": -100.3090,
  "name": "Sucursal Monterrey",
  "address": "Av. Constitución 123, Monterrey, NL"
}
```

`name` y `address` son opcionales.

---

## Enviar audio

```
POST /api/send-audio
```

```json
{
  "to": "+52 868 830 2741",
  "audioUrl": "https://ejemplo.com/mensaje.mp3",
  "asVoiceNote": false
}
```

- `asVoiceNote: true` → se muestra como nota de voz (burbuja con forma de onda)
- `asVoiceNote: false` → se muestra como archivo de audio adjunto

---

## Verificar si un número existe en WhatsApp

Útil antes de enviar a un número nuevo para evitar errores.

```
GET /api/check-number/{phone}
```

Ejemplo:
```
GET /api/check-number/+52%20868%20830%202741
```

Respuesta:
```json
{
  "phone": "+52 868 830 2741",
  "normalized": "528688302741",
  "exists": true,
  "waId": "528688302741@c.us"
}
```

Si `exists` es `false`, no enviar mensajes a ese número (serán ignorados por WhatsApp).

---

## Webhooks — recibir mensajes entrantes

Cuando alguien escribe al número conectado, el gateway hace POST a las URLs configuradas.

### Payload de mensaje entrante

```json
{
  "event": "message",
  "timestamp": 1713200000,
  "data": {
    "id": "false_528688302741@c.us_3A7C9D41B09EB12B4C50",
    "from": "528688302741@c.us",
    "fromNumber": "+528688302741",
    "fromName": "Juan García",
    "to": "5218683472565@c.us",
    "body": "Hola, quiero hacer un pedido",
    "type": "chat",
    "hasMedia": false,
    "media": null,
    "location": null,
    "isForwarded": false,
    "quotedMsg": null,
    "timestamp": 1713200000
  }
}
```

### Tipos de mensaje (`type`)

| Valor | Descripción |
|-------|-------------|
| `"chat"` | Texto plano |
| `"image"` | Imagen (media descargada en `data.media`) |
| `"document"` | Documento/archivo |
| `"audio"` | Audio o nota de voz |
| `"ptt"` | Push-to-talk (nota de voz) |
| `"location"` | Ubicación (coordenadas en `data.location`) |
| `"sticker"` | Sticker |
| `"video"` | Video |

### Payload cuando hay media

Si `hasMedia: true`, el campo `media` contiene:
```json
{
  "mimetype": "image/jpeg",
  "data": "<base64 de la imagen>",
  "filename": null
}
```

### Payload de confirmación de entrega/lectura

```json
{
  "event": "message_ack",
  "timestamp": 1713200000,
  "data": {
    "messageId": "true_528688302741@c.us_3EB0ABC123...",
    "to": "528688302741@c.us",
    "ack": 3,
    "ackLabel": "read"
  }
}
```

Valores de `ack`:
- `1` = `"sent"` — mensaje enviado desde el teléfono
- `2` = `"delivered"` — entregado al teléfono del receptor
- `3` = `"read"` — receptor abrió el chat
- `4` = `"played"` — audio reproducido

### Verificar firma del webhook

Cada request del gateway incluye el header:
```
X-Webhook-Signature: sha256=<hmac-sha256-del-body>
```

Verificar con:
```javascript
const crypto = require('crypto');
function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}
```

---

## Gestión de webhooks en tiempo real

```
POST /api/webhook/register
```
```json
{
  "url": "https://mi-app.com/api/wa/incoming",
  "events": ["message", "message_ack", "disconnected"]
}
```
Eventos válidos: `"message"`, `"message_ack"`, `"disconnected"`, `"ready"`, `"*"` (todos).

```
GET /api/webhook/list
DELETE /api/webhook/{id}
```

**Nota:** Los webhooks registrados por API se pierden al reiniciar. Para persistencia usar `WEBHOOK_URLS` en el `.env`.

---

## Rate limits

El gateway tiene rate limiting interno para evitar ban de WhatsApp:

| Límite | Default |
|--------|---------|
| Por minuto | 15 mensajes |
| Por hora | 100 mensajes |
| Por día | 500 mensajes |

Si se excede un límite, la API devuelve:
```json
{ "error": "Rate limit excedido: máximo 15 mensajes/minuto" }
```

El agente debe respetar estos límites y manejar el error con un retry delay.

---

## Cliente TypeScript recomendado

Copiar este archivo en cualquier proyecto para usar el gateway:

```typescript
// lib/whatsapp.ts

const BASE_URL = process.env.WHATSAPP_API_URL!;
const API_KEY  = process.env.WHATSAPP_API_KEY!;

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

export async function sendText(to: string, body: string) {
  return waRequest('POST', '/api/send-text', { to, body });
}

export async function sendImage(to: string, imageUrl: string, caption?: string) {
  return waRequest('POST', '/api/send-image', { to, imageUrl, caption });
}

export async function sendDocument(to: string, documentUrl: string, filename: string, caption?: string) {
  return waRequest('POST', '/api/send-document', { to, documentUrl, filename, caption });
}

export async function sendLocation(to: string, lat: number, lng: number, name?: string, address?: string) {
  return waRequest('POST', '/api/send-location', { to, lat, lng, name, address });
}

export async function sendAudio(to: string, audioUrl: string, asVoiceNote = false) {
  return waRequest('POST', '/api/send-audio', { to, audioUrl, asVoiceNote });
}

export async function checkNumber(phone: string) {
  return waRequest('GET', `/api/check-number/${encodeURIComponent(phone)}`);
}

export async function getStatus() {
  return waRequest('GET', '/api/status');
}
```

Uso en cualquier archivo:
```typescript
import { sendText, sendImage } from '@/lib/whatsapp';

await sendText('+52 868 830 2741', 'Tu pedido está listo');
await sendImage('+52 868 830 2741', 'https://...foto.jpg', 'Así quedó');
```

---

## Errores comunes y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `"sesión en estado disconnected"` | WhatsApp no conectado | Verificar panel web, re-escanear QR |
| `"no está registrado en WhatsApp"` | Número no tiene WA | Verificar con `/api/check-number` antes de enviar |
| `"JSON inválido"` | Body mal formado | Verificar Content-Type y estructura del JSON |
| `"API key inválida"` | Key incorrecta | Verificar variable de entorno `WHATSAPP_API_KEY` |
| `"Rate limit excedido"` | Demasiados mensajes | Esperar y reintentar, reducir volumen de envíos |
