import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Gemini AI Vision OCR endpoint for Lottery Slips, Viber/Telegram Screenshots & Photos
  app.post('/api/ocr', async (req, res) => {
    try {
      const { image, mimeType, mode = 'auto' } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

      // Clean base64 header if present
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const modeInstruction = mode === '2d'
        ? `Target Mode: 2D ONLY. Extract 2-digit numbers (00 to 99) and amounts.
Also support:
- 2D reversals / R / အာ / ပတ် (e.g. "24R 1000", "24 အာ 500", "24-42 1000" -> produce 24=1000 and 42=1000).
- Special Myanmar 2D lottery groups:
  * အပူး (Doubles): 00, 11, 22, 33, 44, 55, 66, 77, 88, 99.
  * ဘရိတ် (Breaks): e.g. 5 ဘရိတ် -> 05, 14, 23, 32, 41, 50, 69, 78, 87, 96.
  * ထိပ် (Head): e.g. 8 ထိပ် -> 80, 81, 82, 83, 84, 85, 86, 87, 88, 89.
  * နောက် (Tail): e.g. 3 နောက် -> 03, 13, 23, 33, 43, 53, 63, 73, 83, 93.
  * ပါဝါ (Power): 05, 16, 27, 38, 49, 50, 61, 72, 83, 94.
  * နက္ခတ် (Natkhat): 07, 18, 24, 35, 42, 53, 69, 70, 81, 96.
  * ညီကို (Brothers): 01, 12, 23, 34, 45, 56, 67, 78, 89, 90, 10, 21, 32, 43, 54, 65, 76, 87, 98, 09.`
        : mode === '3d'
        ? `Target Mode: 3D ONLY. Extract 3-digit numbers (000 to 999) and amounts.
Also support:
- R / permutations / ပတ် / ခွေ (e.g. "123R 1000", "123 ပတ် 500", "123 ခွေ 1000") -> mark isRumble: true or expand permutations.
- Multiple 3D numbers on a line (e.g. "123, 456, 789 = 1000").`
        : `Target Mode: AUTO (both 2D and 3D). Detect whether numbers are 2-digit or 3-digit and extract accurately.`;

      const prompt = `You are an expert OCR and data extraction assistant specialized in Myanmar 2D/3D lottery slips, paper receipts, and chat screenshots from Viber, Telegram, Messenger, and SMS.
Analyze this image (which may be a screenshot of a Viber or Telegram conversation, chat bubbles, interface elements, timestamps, customer names, phone numbers, or handwritten/printed lottery slips).

Your goals:
1. Extract ALL readable text from the image line-by-line verbatim into "rawText" (so the user can clearly inspect what text was scanned from the photo).
2. Identify customer name if present (e.g. Viber/Telegram chat header, sender bubble, or labeled with နာမည်/ဝယ်သူ/အမည်/ကို/မ/ဒေါ်/ဦး).
3. Identify customer phone number if present (09-xxxxxxxxx or +959xxxxxxxxx).
4. Extract all betting numbers and amounts accurately:
   ${modeInstruction}
   - Convert all Myanmar numerals (၀, ၁, ၂, ၃, ၄, ၅, ၆, ၇, ၈, ၉) into English digits (0-9).
   - Clean common Myanmar chat noise like "ကျပ်", "ks", "k", "စီ" (each), "တင်ပေးပါ", "ထိုးမယ်", timestamps, and checkmarks.
   - Standard formats include "123=1000", "24=500", "123-1000", "24 1000", "123/500", "24:1000", "123*500", "24x1000", "24/42=1000 စီ".
5. Return ONLY a valid JSON object with this exact structure (no markdown fences, no explanatory comments):
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "24", "amount": 1000, "isRumble": false, "originalRaw": "24=1000" }
  ],
  "rawText": "verbatim text lines detected in image"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBuffer.toString('base64')
            }
          },
          { text: prompt }
        ]
      });

      const textOutput = response.text || '';
      let jsonResult;
      try {
        const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonResult = JSON.parse(cleanJson);
      } catch (parseErr) {
        const match = textOutput.match(/\{[\s\S]*\}/);
        if (match) {
          jsonResult = JSON.parse(match[0]);
        } else {
          throw new Error('Could not parse Gemini JSON response');
        }
      }

      res.json(jsonResult);
    } catch (error: any) {
      console.error('Gemini OCR Error:', error);
      res.status(500).json({ error: error.message || 'OCR processing failed' });
    }
  });

  // Gemini AI endpoint for direct chat text parsing (Viber / Telegram / SMS)
  app.post('/api/parse-chat-text', async (req, res) => {
    try {
      const { text, mode = 'auto' } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'No text provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

      const modeInstruction = mode === '2d'
        ? `Target Mode: 2D ONLY. Extract 2-digit numbers and amounts. Also support 2D reversals/R (24R, 24 အာ), and special Myanmar 2D groups (အပူး doubles, ဘရိတ် breaks, ထိပ် heads, နောက် tails, ပါဝါ, နက္ခတ်, ညီကို).`
        : mode === '3d'
        ? `Target Mode: 3D ONLY. Extract 3-digit numbers and amounts. Support 3D permutations/R (123R, 123 ပတ်, 123 ခွေ).`
        : `Target Mode: AUTO (both 2D and 3D).`;

      const prompt = `You are an expert data parser for Myanmar 2D/3D lottery bets sent via Viber, Telegram, or SMS.
The user pasted text directly from a chat:
"""
${text}
"""

Instructions:
1. Identify customer name and phone number if present.
2. Extract all bet items and amounts according to ${modeInstruction}.
3. Convert all Myanmar numerals (၀-၉) to English digits (0-9).
4. Handle Myanmar chat patterns like "စီ", "ကျပ်", "ks", "အပူး", "ဘရိတ်", "ထိပ်", "နောက်", "အာ", "ပတ်".
5. Return ONLY a valid JSON object matching:
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "string", "amount": 1000, "isRumble": false, "originalRaw": "string" }
  ],
  "rawText": "clean summary"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      const textOutput = response.text || '';
      let jsonResult;
      try {
        const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonResult = JSON.parse(cleanJson);
      } catch (parseErr) {
        const match = textOutput.match(/\{[\s\S]*\}/);
        if (match) {
          jsonResult = JSON.parse(match[0]);
        } else {
          throw new Error('Could not parse Gemini JSON response');
        }
      }

      res.json(jsonResult);
    } catch (error: any) {
      console.error('Gemini Chat Text Parsing Error:', error);
      res.status(500).json({ error: error.message || 'Chat text parsing failed' });
    }
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
