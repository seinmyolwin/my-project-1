import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { createMessagingRouter, verifyOwnerTokenMiddleware, generateOwnerSessionToken } from './server/messagingHub.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Session Token Auth Endpoint (D1)
  app.post('/api/auth/token', (req: Request, res: Response) => {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'Valid 6-digit PIN required' });
    }
    const token = generateOwnerSessionToken(pin.trim());
    return res.json({ success: true, token });
  });

  // Mount Telegram messaging integration router (Protected routes inside messagingHub)
  app.use('/api', createMessagingRouter());

  // Rate Limiter for AI / OCR endpoints (D3)
  const ocrRateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10);
  const ocrLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: ocrRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  // Live Thai 3D Results proxy endpoint
  app.get('/api/lottery/live-results', async (req, res) => {
    try {
      let live3DData: any = null;

      try {
        const response3D = await fetch('https://thai-lottery-api.vercel.app/latest', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3500)
        });
        if (response3D.ok) {
          live3DData = await response3D.json();
        }
      } catch (err3d) {
        // Fallback
      }

      res.json({
        success: true,
        source: 'Official Thai GLO Lottery',
        timestamp: new Date().toISOString(),
        live3D: live3DData
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch live results' });
    }
  });

  // Gemini AI Vision OCR endpoint (Protected by owner token + rate limit) (D1, D3)
  app.post('/api/ocr', verifyOwnerTokenMiddleware, ocrLimiter, async (req: Request, res: Response) => {
    try {
      const { image, mimeType, mode = 'auto' } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const modeInstruction = mode === '2d'
        ? `Target Mode: 2D ONLY. Extract 2-digit numbers (00 to 99) and amounts.
Also support:
- 2D reversals / R / အာ / ပတ် / ပတ်လည် (e.g. "24R 1000", "24 အာ 500", "24-42 1000" -> produce 24=1000 and 42=1000).
- Multiple 2D numbers with R / အာ / ပတ်.
- Special Myanmar 2D lottery groups: အပူး, အပါ, ဘရိတ်, ထိပ်, နောက်, ပါဝါ, နက္ခတ်, ညီကို.`
        : mode === '3d'
        ? `Target Mode: 3D ONLY. Extract 3-digit numbers (000 to 999) and amounts.`
        : `Target Mode: AUTO (both 2D and 3D).`;

      const prompt = `You are an expert OCR and data extraction assistant specialized in Myanmar 2D/3D lottery slips, paper receipts, and chat screenshots from Telegram and SMS.
Analyze this image.
1. Extract ALL readable text line-by-line verbatim into "rawText".
2. Identify customer name if present.
3. Identify customer phone number if present.
4. Extract all betting numbers and amounts accurately:
   ${modeInstruction}
   - Convert all Myanmar numerals into English digits (0-9).
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
        model: 'gemini-2.5-flash',
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

  // Gemini AI endpoint for direct chat text parsing (Protected by owner token + rate limit) (D1, D3)
  app.post('/api/parse-chat-text', verifyOwnerTokenMiddleware, ocrLimiter, async (req: Request, res: Response) => {
    try {
      const { text, mode = 'auto' } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'No text provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

      const modeInstruction = mode === '2d'
        ? `Target Mode: 2D ONLY. Extract 2-digit numbers and amounts.`
        : mode === '3d'
        ? `Target Mode: 3D ONLY. Extract 3-digit numbers and amounts.`
        : `Target Mode: AUTO (both 2D and 3D).`;

      const prompt = `You are an expert data parser for Myanmar 2D/3D lottery bets sent via Telegram or SMS.
The user pasted text directly from a chat:
"""
${text}
"""

Instructions:
1. Identify customer name and phone number if present.
2. Extract all bet items and amounts according to ${modeInstruction}.
3. Convert all Myanmar numerals to English digits (0-9).
4. Return ONLY a valid JSON object matching:
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "string", "amount": 1000, "isRumble": false, "originalRaw": "string" }
  ],
  "rawText": "clean summary"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

  // Vite middleware for development or static serving for production
  const distPath = path.resolve(__dirname, 'dist');
  if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  // Bind strictly to 127.0.0.1 per D2 requirement
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running securely on http://127.0.0.1:${PORT}`);
  });
}

startServer();
