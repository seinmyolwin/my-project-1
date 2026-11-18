import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface OcrScanRequest {
  image: string;
  mimeType?: string;
  mode?: string;
}

export interface OcrScanResult {
  customerName: string;
  customerPhone: string;
  rawText: string;
  items: any[];
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.API_KEY;
}

export async function runGeminiOcrScan({
  image,
  mimeType = 'image/jpeg',
  mode = 'auto',
}: OcrScanRequest): Promise<OcrScanResult> {
  if (!image || typeof image !== 'string') {
    throw Object.assign(new Error('No image provided'), { statusCode: 400 });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { statusCode: 500 });
  }

  const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');
  if (imageBuffer.length === 0) {
    throw Object.assign(new Error('Invalid empty image payload'), { statusCode: 400 });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const modeInstruction =
    mode === '2d'
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

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      },
      { text: prompt },
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          customerName: {
            type: Type.STRING,
            description: 'Detected customer name if shown in the image, otherwise empty string.',
          },
          customerPhone: {
            type: Type.STRING,
            description: 'Detected customer phone number if shown, otherwise empty string.',
          },
          rawText: {
            type: Type.STRING,
            description: 'Clean line-by-line copied bet text with English digits (0-9) containing ONLY betting numbers/keywords and stake amounts.',
          },
        },
        required: ['customerName', 'customerPhone', 'rawText'],
      },
    },
  });

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

  return {
    customerName: String(jsonResult.customerName || ''),
    customerPhone: String(jsonResult.customerPhone || ''),
    rawText: String(jsonResult.rawText || ''),
    items: Array.isArray(jsonResult.items) ? jsonResult.items : [],
  };
}

export async function runGeminiChatTextParse({
  text,
  mode = 'auto',
}: {
  text: string;
  mode?: string;
}) {
  if (!text || !text.trim()) {
    throw Object.assign(new Error('No text provided'), { statusCode: 400 });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { statusCode: 500 });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const modeInstruction =
    mode === '2d'
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
                originalRaw: { type: Type.STRING },
              },
              required: ['number', 'amount', 'isRumble', 'originalRaw'],
            },
          },
        },
        required: ['customerName', 'customerPhone', 'rawText', 'items'],
      },
    },
  });

  const textOutput = response.text || '';
  try {
    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    const match = textOutput.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not parse Gemini JSON response');
  }
}

const isServerlessRuntime = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET
);

export function createOcrRouter() {
  const router = express.Router();

  router.post('/ocr', async (req: Request, res: Response) => {
    try {
      const { image, mimeType, mode = 'auto' } = req.body || {};
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'No image provided' });
      }
      if (!getGeminiApiKey()) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      if (isServerlessRuntime) {
        const result = await runGeminiOcrScan({ image, mimeType, mode });
        return res.status(200).json(result);
      }

      // Persistent server / Cloud Run proxy: keep connection alive with leading whitespace
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
        const result = await runGeminiOcrScan({ image, mimeType, mode });
        clearInterval(keepaliveTimer);
        if (!res.writableEnded) {
          res.end(JSON.stringify(result));
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
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      if (!res.headersSent) {
        res.status(status).json({ error: error?.message || 'OCR processing failed' });
      } else if (!res.writableEnded) {
        res.end(JSON.stringify({ error: error?.message || 'OCR processing failed' }));
      }
    }
  });

  router.post('/parse-chat-text', async (req: Request, res: Response) => {
    try {
      const { text, mode = 'auto' } = req.body || {};
      const jsonResult = await runGeminiChatTextParse({ text, mode });
      return res.json(jsonResult);
    } catch (error: any) {
      console.error('Gemini Chat Text Parsing Error:', error);
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      return res.status(status).json({ error: error?.message || 'Chat text parsing failed' });
    }
  });

  router.get('/lottery/live-results', async (_req: Request, res: Response) => {
    try {
      let live3DData: any = null;
      try {
        const response3D = await fetch('https://thai-lottery-api.vercel.app/latest', {
          headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3500),
        });
        if (response3D.ok) {
          live3DData = await response3D.json();
        }
      } catch {
        // Fallback
      }

      res.json({
        success: true,
        source: 'Official Thai GLO Lottery',
        timestamp: new Date().toISOString(),
        live3D: live3DData,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch live results' });
    }
  });

  return router;
}
