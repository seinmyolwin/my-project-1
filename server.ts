import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Gemini AI Vision OCR endpoint for Lottery Slips & Viber Screenshots
  app.post('/api/ocr', async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured on server' });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Clean base64 header if present
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBuffer.toString('base64')
            }
          },
          {
            text: `You are an expert OCR and data extraction assistant specialized in lottery slips, Viber chat screenshots, and betting lists in Myanmar.
Analyze this image (which may be a Viber chat screenshot containing chat bubbles, interface elements, timestamps, customer name, phone number, and betting items with amounts).
Extract all bet items, customer name, and customer phone number accurately. Ignore UI noise, chat decorations, and timestamps.
Rules:
1. Identify customer name if present (e.g. name at top of chat or labeled with နာမည်/ဝယ်သူ/အမည်).
2. Identify customer phone number if present (09-xxxxxxxxx).
3. Extract all betting numbers and amounts:
   - 3-digit numbers with amounts (e.g. 123=1000, 123 500, 123 - 1000, 123/1000).
   - R / permutation / rumble / phet patterns (e.g. 123R=1000, 123ပတ် 500, 123ခွေ=1000, 123 r 1000).
   - Multiple numbers on a line (e.g. 123, 456, 789 = 1000).
4. Return ONLY a valid JSON object with this exact structure (no markdown code fences or extra text):
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "123", "amount": 1000, "isRumble": false, "originalRaw": "123=1000" },
    { "number": "456", "amount": 500, "isRumble": true, "originalRaw": "456 R" }
  ],
  "rawText": "summary of extracted text"
}`
          }
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
