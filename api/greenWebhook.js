// Green API webhook endpoint - receives incoming WhatsApp messages
// Configure this URL in Green API console as the incoming webhook:
//   https://whatsapp-lottery.vercel.app/api/greenWebhook
//
// First version:
// - מזהה הודעות טקסט שמכילות START_<campaignId>
// - שולח חזרה הודעת ברוכים הבאים וטקסט שיתוף בסיסי

import { sendWhatsappText } from '../js/services/greenApi.js';

export default async function handler(req, res) {
  // Green API שולחים POST בלבד
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'greenWebhook alive' });
  }

  try {
    let body = req.body;

    // במקרים מסוימים הגוף מגיע כמחרוזת
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore, נמשיך עם מה שיש
      }
    }

    const typeWebhook = body?.typeWebhook;

    // מטפלים רק בהודעות נכנסות מסוג טקסט
    if (typeWebhook !== 'incomingMessageReceived') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const senderData = body?.senderData || {};
    const messageData = body?.messageData || {};

    const sender = senderData.sender || senderData.chatId || '';
    const phone = sender.split('@')[0]; // 9725...

    const textMessage =
      messageData?.textMessageData?.textMessage ||
      messageData?.extendedTextMessageData?.textMessage ||
      '';

    if (!phone || !textMessage) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    // מחפשים טקסט בסגנון START_ABC123
    const match = textMessage.match(/START_([A-Za-z0-9]+)/i);
    const campaignId = match ? match[1] : null;

    if (!campaignId) {
      // בינתיים מתעלמים מהודעות רגילות
      return res.status(200).json({ ok: true, ignored: true });
    }

    // גרסה ראשונה: הודעת ברוכים הבאים + טקסט שיתוף בסיסי
    const welcomeText = `ברוך הבא להגרלה! 🎉\nקוד הגרלה: ${campaignId}\n\nבגרסה הבאה נטען את שם ההגרלה והטקסטים מהדשבורד.`;

    const shareLink = `https://whatsapp-lottery.vercel.app/?c=${campaignId}`;
    const shareText = `כדי לשתף את ההגרלה עם חברים ולקבל עוד כרטיסים, שלח להם את הקישור הזה:\n${shareLink}`;

    await sendWhatsappText(phone, welcomeText);
    await sendWhatsappText(phone, shareText);

    return res.status(200).json({
      ok: true,
      handled: true,
      phone,
      campaignId
    });
  } catch (error) {
    console.error('greenWebhook error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

