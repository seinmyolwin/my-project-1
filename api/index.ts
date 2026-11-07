import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMessagingRouter } from '../server/messagingHub.js';
import express from 'express';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount messaging router securely
const messagingRouter = createMessagingRouter();
app.use('/api', messagingRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
