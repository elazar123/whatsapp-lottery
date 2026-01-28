// Green API service - sending WhatsApp messages from the server
// Uses environment variables configured in Vercel:
// GREEN_API_URL, GREEN_API_INSTANCE_ID, GREEN_API_TOKEN

const GREEN_API_URL = process.env.GREEN_API_URL;
const GREEN_API_INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;

function ensureEnv() {
  if (!GREEN_API_URL || !GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
    throw new Error(
      'Green API env vars missing. Please set GREEN_API_URL, GREEN_API_INSTANCE_ID, GREEN_API_TOKEN in Vercel.'
    );
  }
}

function buildApiUrl(method) {
  ensureEnv();
  return `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/${method}/${GREEN_API_TOKEN}`;
}

/**
 * Send plain text WhatsApp message
 * @param {string} phone - E.164 without + (e.g. 972525624350)
 * @param {string} message - Text content
 */
export async function sendWhatsappText(phone, message) {
  if (!phone) throw new Error('phone is required');
  if (!message) throw new Error('message is required');

  const url = buildApiUrl('sendMessage');

  const body = {
    chatId: `${phone}@c.us`,
    message
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendMessage failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Send image by public URL
 * @param {string} phone - E.164 without +
 * @param {string} imageUrl - Public image URL
 * @param {string} [caption] - Optional caption
 */
export async function sendWhatsappImage(phone, imageUrl, caption = '') {
  if (!phone) throw new Error('phone is required');
  if (!imageUrl) throw new Error('imageUrl is required');

  const url = buildApiUrl('sendFileByUrl');

  const body = {
    chatId: `${phone}@c.us`,
    urlFile: imageUrl,
    fileName: 'image.jpg',
    caption
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendFileByUrl (image) failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Send video by public URL
 * @param {string} phone - E.164 without +
 * @param {string} videoUrl - Public video URL
 * @param {string} [caption] - Optional caption
 */
export async function sendWhatsappVideo(phone, videoUrl, caption = '') {
  if (!phone) throw new Error('phone is required');
  if (!videoUrl) throw new Error('videoUrl is required');

  const url = buildApiUrl('sendFileByUrl');

  const body = {
    chatId: `${phone}@c.us`,
    urlFile: videoUrl,
    fileName: 'video.mp4',
    caption
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendFileByUrl (video) failed: ${res.status} ${text}`);
  }

  return res.json();
}

