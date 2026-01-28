// Simple test endpoint to verify Green API integration from the server
// Usage:
//   /api/greenTest?phone=9725XXXXXXXX
//
// This will send a WhatsApp message via Green API to the given phone.

import { sendWhatsappText } from '../js/services/greenApi.js';

export default async function handler(req, res) {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res
        .status(400)
        .json({ ok: false, error: 'Missing phone query param, e.g. ?phone=97252XXXXXXX' });
    }

    await sendWhatsappText(
      phone,
      'בדיקת חיבור Green API מתוך whatsapp-lottery ✅'
    );

    return res.status(200).json({ ok: true, phone });
  } catch (error) {
    console.error('greenTest error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

