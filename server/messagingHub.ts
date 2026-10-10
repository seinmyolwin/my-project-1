import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface TelegramIncomingOrder {
  id: string;
  senderName: string;
  senderPhone: string;
  chatId?: string | number;
  orderType: 'text' | 'photo';
  category: '3d' | '2d' | 'football';
  rawText: string;
  photoUrl?: string;
  parsedItems: {
    number: string;
    amount: number;
    isRumble: boolean;
    originalRaw: string;
  }[];
  totalAmount: number;
  status: 'pending_review' | 'approved' | 'rejected';
  timestamp: number;
  notes?: string;
}



interface ServerStoreData {
  telegram: {
    botToken: string;
    isCleared?: boolean;
    channelId: string;
    accountName: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error';
    statusMessage?: string;
    connectedAt?: string;
  };
  telegramOrders: TelegramIncomingOrder[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'messaging_store.json');

// In-memory idempotency sets (capped at 5000 items)
const processedTgUpdates = new Set<number>();

function addToIdempotencySet<T>(set: Set<T>, item: T, maxSize = 5000) {
  if (set.size >= maxSize) {
    const firstItem = set.values().next().value;
    if (firstItem !== undefined) {
      set.delete(firstItem);
    }
  }
  set.add(item);
}

function loadStore(): ServerStoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const isTgCleared = parsed.telegram?.isCleared === true || (parsed.telegram?.botToken === '' && parsed.telegram?.isCleared !== false);
      const tgBotToken = isTgCleared ? '' : (parsed.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || '');

      return {
        telegram: {
          botToken: tgBotToken,
          isCleared: isTgCleared,
          channelId: parsed.telegram?.channelId || '@shwemingalar_channel',
          accountName: parsed.telegram?.accountName || 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
          webhookUrl: parsed.telegram?.webhookUrl || '',
          status: parsed.telegram?.status || 'disconnected',
          statusMessage: parsed.telegram?.statusMessage || '',
          connectedAt: parsed.telegram?.connectedAt
        },
        telegramOrders: Array.isArray(parsed.telegramOrders) ? parsed.telegramOrders : []
      };
    }
  } catch (err) {
    console.error('Failed to read messaging store:', err);
  }

  return {
    telegram: {
      botToken: '',
      isCleared: true,
      channelId: '@shwemingalar_channel',
      accountName: 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
      webhookUrl: '',
      status: 'disconnected',
      statusMessage: ''
    },
    telegramOrders: []
  };
}

let store = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist messaging store:', err);
  }
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return '';
  return `${token.slice(0, 3)}****${token.slice(-4)}`;
}

// Convert Myanmar numerals (၀-၉) to English digits
function convertMyanmarNumerals(text: string): string {
  const mmNumerals: Record<string, string> = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  return text.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
}

// Simple fast parser for incoming text messages
function parseBetText(rawText: string, defaultCategory: '3d' | '2d' | 'football' = '3d') {
  const converted = convertMyanmarNumerals(rawText || '');
  const tokens = converted.split(/[\n,;+\t|]/);
  const items: { number: string; amount: number; isRumble: boolean; originalRaw: string }[] = [];
  let totalAmount = 0;
  let detectedCategory = defaultCategory;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/(\d{2,3})\s*(r|R|ပတ်|ခွေ)?\s*[:=\-*\/x\s]\s*(\d+)/i);
    if (match) {
      const num = match[1];
      const isRumble = !!match[2];
      const amt = parseInt(match[3], 10) || 0;

      if (num.length === 2 && detectedCategory === '3d') {
        detectedCategory = '2d';
      }

      items.push({
        number: num,
        amount: amt,
        isRumble,
        originalRaw: trimmed
      });
      totalAmount += amt;
    }
  }

  return { items, totalAmount, detectedCategory };
}

/* =========================================================================
   TELEGRAM SERVICE METHODS
   ========================================================================= */

function getTelegramToken(): string {
  if (store.telegram.isCleared || store.telegram.botToken === '') {
    return '';
  }
  return store.telegram.botToken || '';
}

function getTelegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || 'shwemingalar_tg_secret_v1';
}

async function callTelegramApi(endpoint: string, method = 'GET', body?: any) {
  const token = getTelegramToken();
  if (!token) {
    return { ok: false, error: 'NO_TOKEN', message: 'Telegram Bot Token is not configured' };
  }

  const url = `https://api.telegram.org/bot${token}/${endpoint}`;
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(6000)
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      return { ok: false, status: response.status, message: 'Invalid JSON response from Telegram' };
    }

    if (response.ok && data?.ok) {
      return { ok: true, result: data.result };
    }

    // Specific Telegram HTTP status handling
    if (response.status === 401 || response.status === 404) {
      return { ok: false, status: 401, message: 'Invalid Telegram Bot Token (Unauthorized)' };
    }
    if (response.status === 429) {
      const retryAfter = data?.parameters?.retry_after || 10;
      return { ok: false, status: 429, message: `Telegram rate limit hit. Retry after ${retryAfter}s`, retryAfter };
    }
    if (response.status === 409) {
      return { ok: false, status: 409, message: `Telegram conflict: ${data?.description || 'Webhook/getUpdates conflict'}` };
    }

    return { ok: false, status: response.status, message: data?.description || `Telegram error (HTTP ${response.status})` };
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { ok: false, status: 408, message: 'Connection to Telegram timed out' };
    }
    return { ok: false, status: 500, message: 'Network failure connecting to Telegram API' };
  }
}



/* =========================================================================
   EXPRESS ROUTER
   ========================================================================= */

export function createMessagingRouter(): Router {
  const router = Router();

  // ----------------- TELEGRAM ROUTES ----------------- //

  // 1. Telegram Status Check (calls getMe via server token)
  router.get('/telegram/status', async (req: Request, res: Response) => {
    const token = getTelegramToken();
    if (!token) {
      return res.json({
        ok: false,
        status: 'disconnected',
        hasToken: false,
        message: 'Telegram Bot Token is not configured on the server'
      });
    }

    const test = await callTelegramApi('getMe');
    if (test.ok && test.result) {
      store.telegram.status = 'connected';
      store.telegram.connectedAt = new Date().toISOString();
      store.telegram.statusMessage = `Connected to @${test.result.username || test.result.first_name}`;
      saveStore();

      return res.json({
        ok: true,
        status: 'connected',
        hasToken: true,
        bot: {
          id: test.result.id,
          username: test.result.username,
          firstName: test.result.first_name
        },
        message: `Telegram Bot [@${test.result.username || test.result.first_name}] သို့ အောင်မြင်စွာ ချိတ်ဆက်ထားပါသည်`
      });
    }

    store.telegram.status = 'error';
    store.telegram.statusMessage = test.message;
    saveStore();

    return res.json({
      ok: false,
      status: 'error',
      hasToken: true,
      message: test.message
    });
  });

  // 2. Telegram Connection Test (validates token explicitly)
  router.post('/telegram/test', async (req: Request, res: Response) => {
    const { botToken, webhookUrl } = req.body || {};
    const testToken = (botToken && typeof botToken === 'string' && botToken.trim()) || getTelegramToken();

    if (!testToken) {
      return res.json({
        status: 'disconnected',
        message: 'Telegram Bot Token မရှိသေးပါ'
      });
    }

    // Call getMe directly with the tested token
    try {
      const response = await fetch(`https://api.telegram.org/bot${testToken.trim()}/getMe`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok && data.result) {
        return res.json({
          status: 'connected',
          message: `Telegram Bot [@${data.result.username || data.result.first_name}] သို့ တရားဝင် အောင်မြင်စွာ ချိတ်ဆက်ထားသည်`,
          bot: {
            id: data.result.id,
            username: data.result.username,
            firstName: data.result.first_name
          }
        });
      }

      if (response.status === 401 || response.status === 404) {
        return res.json({
          status: 'error',
          message: 'Telegram Bot Token မမှန်ကန်ပါ (Unauthorized)'
        });
      }

      return res.json({
        status: 'error',
        message: data?.description || `Telegram Server မှ တုံ့ပြန်မှု မအောင်မြင်ပါ (HTTP ${response.status})`
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return res.json({
          status: 'timeout',
          message: 'Telegram API ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)'
        });
      }
      return res.json({
        status: 'error',
        message: 'Telegram Server သို့ ချိတ်ဆက်၍ မရပါ (Network Failure)'
      });
    }
  });

  // 3. Telegram Config GET (Sanitized, token NEVER returned raw)
  router.get('/telegram/config', (req: Request, res: Response) => {
    const token = getTelegramToken();
    res.json({
      hasToken: Boolean(token),
      maskedToken: maskToken(token),
      channelId: store.telegram.channelId,
      accountName: store.telegram.accountName,
      webhookUrl: store.telegram.webhookUrl,
      status: store.telegram.status,
      statusMessage: store.telegram.statusMessage,
      connectedAt: store.telegram.connectedAt
    });
  });

  // 4. Telegram Config POST (Saves securely on server)
  router.post('/telegram/config', async (req: Request, res: Response) => {
    const { botToken, channelId, accountName, webhookUrl, clearToken } = req.body || {};

    if (channelId) store.telegram.channelId = String(channelId).trim();
    if (accountName) store.telegram.accountName = String(accountName).trim();
    if (webhookUrl !== undefined) store.telegram.webhookUrl = String(webhookUrl).trim();

    // If explicit clear token requested
    if (clearToken === true || botToken === '') {
      try {
        if (store.telegram.botToken) {
          await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false });
        }
      } catch {
        // ignore
      }
      store.telegram.botToken = '';
      store.telegram.status = 'disconnected';
      store.telegram.statusMessage = 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)';
      delete store.telegram.connectedAt;
      saveStore();

      return res.json({
        success: true,
        hasToken: false,
        maskedToken: '',
        status: store.telegram.status,
        statusMessage: store.telegram.statusMessage
      });
    }

    // If new token provided, test and store it
    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      store.telegram.botToken = botToken.trim();
    }

    // Verify token
    const token = getTelegramToken();
    if (token) {
      const test = await callTelegramApi('getMe');
      if (test.ok && test.result) {
        store.telegram.status = 'connected';
        store.telegram.connectedAt = new Date().toISOString();
        store.telegram.statusMessage = `Connected to @${test.result.username || test.result.first_name}`;
      } else {
        store.telegram.status = 'error';
        store.telegram.statusMessage = test.message;
      }
    } else {
      store.telegram.status = 'disconnected';
      store.telegram.statusMessage = 'Token missing';
    }

    saveStore();

    res.json({
      success: true,
      hasToken: Boolean(token),
      maskedToken: maskToken(token),
      status: store.telegram.status,
      statusMessage: store.telegram.statusMessage,
      connectedAt: store.telegram.connectedAt
    });
  });

  // 4b. Clear / Delete Telegram Token endpoint
  router.post('/telegram/clear-token', async (req: Request, res: Response) => {
    try {
      if (store.telegram.botToken) {
        await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false });
      }
    } catch {
      // ignore
    }
    store.telegram.botToken = '';
    store.telegram.webhookUrl = '';
    store.telegram.status = 'disconnected';
    store.telegram.statusMessage = 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)';
    delete store.telegram.connectedAt;
    saveStore();

    return res.json({
      success: true,
      hasToken: false,
      maskedToken: '',
      status: 'disconnected',
      statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)'
    });
  });

  // 5. Telegram Set Webhook
  router.post('/telegram/set-webhook', async (req: Request, res: Response) => {
    const { webhookUrl } = req.body || {};
    const url = webhookUrl || store.telegram.webhookUrl;

    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({
        ok: false,
        message: 'HTTPS Webhook URL is required by Telegram'
      });
    }

    const secret = getTelegramWebhookSecret();
    const result = await callTelegramApi('setWebhook', 'POST', {
      url,
      secret_token: secret,
      drop_pending_updates: false
    });

    if (result.ok) {
      store.telegram.webhookUrl = url;
      saveStore();
      return res.json({ ok: true, message: 'Telegram Webhook registered successfully' });
    }

    return res.status(502).json({ ok: false, message: result.message });
  });

  // 6. Telegram Delete Webhook
  router.post('/telegram/delete-webhook', async (req: Request, res: Response) => {
    const result = await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false });
    return res.json(result);
  });

  // 7. Telegram Webhook Receiver Endpoint
  router.post('/telegram/webhook', (req: Request, res: Response) => {
    // 1. Verify Secret Token Header if configured
    const configuredSecret = getTelegramWebhookSecret();
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];

    if (configuredSecret) {
      if (!incomingSecret || typeof incomingSecret !== 'string') {
        return res.status(403).json({ error: 'Missing or invalid secret token header' });
      }
      const incomingBuf = Buffer.from(incomingSecret);
      const configBuf = Buffer.from(configuredSecret);
      if (incomingBuf.length !== configBuf.length || !crypto.timingSafeEqual(incomingBuf, configBuf)) {
        return res.status(403).json({ error: 'Unauthorized secret token' });
      }
    }

    const update = req.body;
    if (!update || typeof update !== 'object' || !update.update_id) {
      return res.status(400).json({ error: 'Invalid update payload' });
    }

    // 2. Idempotency Check
    if (processedTgUpdates.has(update.update_id)) {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    addToIdempotencySet(processedTgUpdates, update.update_id);

    // 3. Process Message / Order
    const msg = update.message || update.channel_post;
    if (msg) {
      const text = msg.text || msg.caption || '';
      const chatId = msg.chat?.id;
      const senderName = msg.from
        ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || msg.from.username || 'Telegram User'
        : 'Telegram Channel';
      const senderPhone = msg.contact?.phone_number || '';

      const { items, totalAmount, detectedCategory } = parseBetText(text, '3d');

      const newOrder: TelegramIncomingOrder = {
        id: `tg-ord-${Date.now()}-${update.update_id}`,
        senderName,
        senderPhone,
        chatId,
        orderType: msg.photo ? 'photo' : 'text',
        category: detectedCategory,
        rawText: text,
        parsedItems: items,
        totalAmount: totalAmount || 0,
        status: 'pending_review',
        timestamp: Date.now(),
        notes: `Telegram Bot update_id [${update.update_id}]`
      };

      store.telegramOrders.unshift(newOrder);
      if (store.telegramOrders.length > 300) {
        store.telegramOrders = store.telegramOrders.slice(0, 300);
      }
      saveStore();
    }

    return res.status(200).json({ ok: true });
  });

  // 8. Telegram Outbound Message
  router.post('/telegram/send-message', async (req: Request, res: Response) => {
    const { chatId, text, parseMode } = req.body || {};
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, message: 'chatId and text are required' });
    }

    const result = await callTelegramApi('sendMessage', 'POST', {
      chat_id: chatId,
      text: String(text),
      parse_mode: parseMode || 'HTML'
    });

    return res.json(result);
  });

  // 9. Telegram Orders Queue API
  router.get('/telegram/orders', (req: Request, res: Response) => {
    res.json(store.telegramOrders);
  });

  router.patch('/telegram/orders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const order = store.telegramOrders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    saveStore();

    res.json(order);
  });

  router.delete('/telegram/orders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    store.telegramOrders = store.telegramOrders.filter(o => o.id !== id);
    saveStore();
    res.json({ success: true });
  });

  return router;
}
