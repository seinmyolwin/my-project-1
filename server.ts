import { setupOwnerAuth, verifyOwnerAuth, makeFailureThrottle } from './server/ownerAuth';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { createMessagingRouter, verifyOwnerTokenMiddleware, generateOwnerSessionToken } from './server/messagingHub';
import { createLiveTwoDRouter } from './server/liveTwoDService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Session Token Auth Endpoint (D1)
  const DATA_DIR = path.join(process.cwd(), 'data');
  const authThrottle = makeFailureThrottle(5, 15 * 60 * 1000);

  // One-time owner PIN registration (first come). Stores only a salted PBKDF2 hash.
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'Valid 6-digit PIN required' });
    }
    const created = setupOwnerAuth(DATA_DIR, pin.trim());
    if (!created) return res.status(409).json({ error: 'already-setup' });
    return res.json({ success: true });
  });

  // Owner session token: PIN must match the server-side hash. Throttled per client IP.
  app.post('/api/auth/token', (req: Request, res: Response) => {
    const key = req.ip || 'unknown';
    if (authThrottle.blocked(key)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'Valid 6-digit PIN required' });
    }
    const ok = verifyOwnerAuth(DATA_DIR, pin.trim());
    if (ok === 'not-setup') return res.status(409).json({ error: 'setup-required' });
    if (!ok) {
      authThrottle.fail(key);
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    authThrottle.reset(key);
    const token = generateOwnerSessionToken(pin.trim());
    return res.json({ success: true, token });
  });

  // Mount Telegram messaging integration router (Protected routes inside messagingHub)
  app.use('/api', createMessagingRouter());

  // Mount Live 2D (SET & Value) real-time market feed + SSE stream
  app.use('/api', createLiveTwoDRouter());

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
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'No image provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      if (imageBuffer.length === 0) {
        return res.status(400).json({ error: 'Invalid empty image payload' });
      }

      const modeInstruction = mode === '2d'
        ? `Target Mode: Myanmar 2D Lottery ONLY (2-digit numbers 00-99, plus Burmese 2D group keywords).
Support all Myanmar 2D notations:
- Straight bets: "52=57=500", "44 2000", "24=1000"
- Direct & Reverse split: "52=7000r3000" or "52=7000/3000"
- Reversal / R: "42 R 500", "34 R 200", "24 အာ 500", "24ပတ် 500" -> write as "<num> R <amount>"
- Handwritten bracket / hook / ditto marks (e.g. a "7"-shaped hook, bracket, or slash spanning rows below a stake like "34 R 200" with "35", "45" below it, or "33 500" with "44", "55" below it): expand EACH grouped row with that shared stake on its own line (e.g. "34 R 200", "35 R 200", "45 R 200").
- Myanmar 2D keywords: "ပါ"/"ပါး"/"အပါ" (e.g. "4ပါ 200"), "ထိပ်" (Head), "ပိတ်"/"နောက်" (Tail), "ဘရိတ်"/"b" (Break), "အပူး" (Doubles), "ပါဝါ" (Power), "နက္ခတ်" (Natkhat), "ညီကို" (Brothers), "စုံစုံ", "မမ", "စုံမ", "မစုံ", "ခွေ", "ခွေပူး", "ခွေR".`
        : mode === '3d'
        ? `Target Mode: Myanmar 3D Lottery ONLY (3-digit numbers 000-999, plus Burmese 3D keywords).
Support:
- Straight bets: "123=1000", "123 456 500"
- Direct / Rumble slash: "123=1000/200", "123 456 1000/200"
- Rumble / R: "123 R 500", "123 ပတ် 500" -> "<num> R <amount>"
- Handwritten bracket / ditto marks spanning multiple 3-digit rows sharing a stake: expand each row cleanly with that stake.
- Break / Head / Tail keywords: "3 ဘရိတ် 300", "4 ထိပ် 500 ပိတ် 200".`
        : `Target Mode: AUTO (Myanmar 2D or 3D lottery).`;

      const prompt = `Read this Myanmar 2D/3D lottery image (handwritten Myanmar digits ၀-၉, English digits 0-9, or chat screenshot).
Extract ONLY betting numbers/keywords and stake amounts in top-to-bottom order (NEVER sort).
Rules:
1. Convert Myanmar digits (၀-၉) to English (0-9). Carefully distinguish handwritten ၂(2) vs ၃(3), ၄(4) vs ၅(5), ၆(6) vs ၈(8) vs ၉(9), ၇(7) vs ၁(1).
2. Ignore chat timestamps ("3:27 PM", "14:30"), ticks, greetings, and margin scribbles without amounts. Put detected customer name in "customerName" ONLY (not in "rawText").
3. Format "rawText" line-by-line as clean copied text: e.g. "52=57=58=50=59=500", "52=7000r3000", "42 R 500", "44 2000", "4ပါ 200". Expand handwritten bracket/"7" ditto hooks so each row has its shared stake on its own line.
${modeInstruction}`;

      // Keep upstream proxy/gateway alive while Gemini processes handwriting/vision
      res.status(200);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.flushHeaders();

      const keepaliveTimer = setInterval(() => {
        if (!res.writableEnded) {
          res.write(' ');
        }
      }, 2500);

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBuffer.toString('base64')
              }
            },
            { text: prompt }
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                customerName: {
                  type: Type.STRING,
                  description: 'Detected customer name if shown in the image, otherwise empty string.'
                },
                customerPhone: {
                  type: Type.STRING,
                  description: 'Detected customer phone number if shown, otherwise empty string.'
                },
                rawText: {
                  type: Type.STRING,
                  description: 'Clean line-by-line copied bet text with English digits (0-9) containing ONLY betting numbers/keywords and stake amounts.'
                }
              },
              required: ['customerName', 'customerPhone', 'rawText']
            }
          }
        });

        clearInterval(keepaliveTimer);

        const textOutput = response.text || '';
        let jsonResult: any;
        try {
          const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
          jsonResult = JSON.parse(cleanJson);
        } catch {
          const match = textOutput.match(/\{[\s\S]*\}/);
          if (match) {
            jsonResult = JSON.parse(match[0]);
          } else {
            throw new Error('Could not parse Gemini JSON response');
          }
        }

        if (!res.writableEnded) {
          res.end(
            JSON.stringify({
              customerName: String(jsonResult.customerName || ''),
              customerPhone: String(jsonResult.customerPhone || ''),
              rawText: String(jsonResult.rawText || ''),
              items: Array.isArray(jsonResult.items) ? jsonResult.items : []
            })
          );
        }
      } catch (innerErr: any) {
        clearInterval(keepaliveTimer);
        console.error('Gemini OCR Inner Error:', innerErr);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: innerErr?.message || 'OCR processing failed' }));
        }
      }
    } catch (error: any) {
      console.error('Gemini OCR Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'OCR processing failed' });
      } else if (!res.writableEnded) {
        res.end(JSON.stringify({ error: error.message || 'OCR processing failed' }));
      }
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
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const modeInstruction = mode === '2d'
        ? `Target Mode: 2D ONLY. Extract 2-digit numbers and amounts.`
        : mode === '3d'
        ? `Target Mode: 3D ONLY. Extract 3-digit numbers and amounts.`
        : `Target Mode: AUTO (both 2D and 3D).`;

      const prompt = `You are an expert data parser for Myanmar 2D/3D lottery bets sent via Telegram, Viber, or SMS.
The user provided text:
"""
${text}
"""

Instructions:
1. Identify customer name and phone number if present.
2. Extract all bet items and amounts according to ${modeInstruction}.
3. Convert all Myanmar numerals to English digits (0-9).
4. Exclude chat timestamps and non-bet chatter from rawText.
5. Preserve the EXACT chronological/line-by-line appearance order from the input text. NEVER sort bet numbers ascending or descending.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              customerPhone: { type: Type.STRING },
              rawText: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    isRumble: { type: Type.BOOLEAN },
                    originalRaw: { type: Type.STRING }
                  },
                  required: ['number', 'amount', 'isRumble', 'originalRaw']
                }
              }
            },
            required: ['customerName', 'customerPhone', 'rawText', 'items']
          }
        }
      });

      const textOutput = response.text || '';
      let jsonResult;
      try {
        const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonResult = JSON.parse(cleanJson);
      } catch {
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
  if (process.env.NODE_ENV === 'production' || (fs.existsSync(distPath) && !process.env.VITE_DEV_MODE)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Parse CLI args for --port and --host
  let PORT = parseInt(process.env.PORT || '3000', 10);
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(parsed)) PORT = parsed;
  }

  let HOST = process.env.HOST || '0.0.0.0';
  const hostArgIdx = process.argv.indexOf('--host');
  if (hostArgIdx !== -1 && process.argv[hostArgIdx + 1]) {
    HOST = process.argv[hostArgIdx + 1];
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });

  return app;
}

const appPromise = startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

export { appPromise };
export default async (req: Request, res: Response) => {
  const app = await appPromise;
  if (app) app(req, res);
};

