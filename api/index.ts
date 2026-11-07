import express from 'express';
import type { Request, Response } from 'express';
import messagingRouter from '../server/messagingHub.js';

const app = express();

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Mount the messaging router (handles all /api/telegram/... routes)
if (messagingRouter) {
  app.use('/api', messagingRouter);
}

// Fallback for unhandled routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

export default app;
