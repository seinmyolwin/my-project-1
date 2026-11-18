import type { Request, Response } from 'express';
import express from 'express';
import path from 'path';
import { createMessagingRouter, generateOwnerSessionToken } from '../server/messagingHub.js';
import { createLiveTwoDRouter } from '../server/liveTwoDService.js';
import { createOcrRouter } from '../server/ocrService.js';
import { setupOwnerAuth, verifyOwnerAuth, makeFailureThrottle } from '../server/ownerAuth.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const DATA_DIR =
  process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? '/tmp'
    : path.join(process.cwd(), 'data');
const authThrottle = makeFailureThrottle(5, 15 * 60 * 1000);

app.post('/api/auth/setup', (req: Request, res: Response) => {
  try {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'Valid 6-digit PIN required' });
    }
    const created = setupOwnerAuth(DATA_DIR, pin.trim());
    if (!created) return res.status(409).json({ error: 'already-setup' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Auth setup failed' });
  }
});

app.post('/api/auth/token', (req: Request, res: Response) => {
  try {
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
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Auth token failed' });
  }
});

app.use('/api', createOcrRouter());
app.use('/api', createLiveTwoDRouter());
app.use('/api', createMessagingRouter());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export const config = {
  maxDuration: 60,
};

export default function handler(req: Request, res: Response) {
  return new Promise<void>((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    try {
      app(req as any, res as any);
    } catch (err: any) {
      console.error('API Handler Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Internal server error' });
      }
      resolve();
    }
  });
}
