import { setupOwnerAuth, verifyOwnerAuth, makeFailureThrottle } from './server/ownerAuth';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { createMessagingRouter, verifyOwnerTokenMiddleware, generateOwnerSessionToken } from './server/messagingHub';
import { createLiveTwoDRouter } from './server/liveTwoDService';
import { createOcrRouter } from './server/ocrService';

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
  const DATA_DIR = (process.env.VERCEL || process.env.NODE_ENV === 'production')
    ? '/tmp'
    : path.join(process.cwd(), 'data');
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

  // Mount Gemini Vision OCR, Chat Text Parser, and Live 3D Results routes
  app.use('/api', verifyOwnerTokenMiddleware, ocrLimiter, createOcrRouter());

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

