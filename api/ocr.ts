import { runGeminiOcrScan } from '../server/ocrService.js';

export const config = {
  maxDuration: 60,
};

async function readJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const result = await runGeminiOcrScan({
      image: body?.image,
      mimeType: body?.mimeType,
      mode: body?.mode || 'auto',
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel /api/ocr Error:', error);
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    return res.status(status).json({
      error: error?.message || 'OCR processing failed',
    });
  }
}
