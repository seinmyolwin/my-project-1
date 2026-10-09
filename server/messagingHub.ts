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

export interface ViberIncomingOrder {
  id: string;
  senderName: string;
  senderPhone: string;
  senderId?: string;
  senderAvatar?: string;
  orderType: 'text' | 'photo';
  category: '3d' | '2d' | 'football';
  rawText?: string;
  photoUrl?: string;
  receivedAt: string;
  status: 'pending_review' | 'approved' | 'rejected';
  parsedItems: {
    id: string;
    number: string;
    amount: number;
    betType: 'straight' | 'rumble';
    isRumble?: boolean;
  }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  notes?: string;
  rejectionReason?: string;
  approvedVoucherNo?: string;
  verifiedAt?: string;
}

interface ServerStoreData {
  telegram: {
    botToken: string;
    channelId: string;
    accountName: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error';
    statusMessage?: string;
    connectedAt?: string;
  };
  viber: {
    botToken: string;
    accountName: string;
    phoneNumber: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error';
    statusMessage?: string;
    connectedAt?: string;
  };
  telegramOrders: TelegramIncomingOrder[];
  viberOrders: ViberIncomingOrder[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'messaging_store.json');

// In-memory idempotency sets (capped at 5000 items)
const processedTgUpdates = new Set<number>();
const processedViberTokens = new Set<string>();

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
      return {
        telegram: {
          botToken: process.env.TELEGRAM_BOT_TOKEN || parsed.telegram?.botToken || '',
          channelId: parsed.telegram?.channelId || '@shwemingalar_channel',
          accountName: parsed.telegram?.accountName || 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
          webhookUrl: parsed.telegram?.webhookUrl || '',
          status: parsed.telegram?.status || 'disconnected',
          statusMessage: parsed.telegram?.statusMessage || '',
          connectedAt: parsed.telegram?.connectedAt
        },
        viber: {
          botToken: process.env.VIBER_AUTH_TOKEN || parsed.viber?.botToken || '',
          accountName: parsed.viber?.accountName || 'ရွှေမင်္ဂလာ Viber စာရင်းလက်ခံစနစ်',
          phoneNumber: parsed.viber?.phoneNumber || '09-798889900',
          webhookUrl: parsed.viber?.webhookUrl || '',
          status: parsed.viber?.status || 'disconnected',
          statusMessage: parsed.viber?.statusMessage || '',
          connectedAt: parsed.viber?.connectedAt
        },
        telegramOrders: Array.isArray(parsed.telegramOrders) ? parsed.telegramOrders : [],
        viberOrders: Array.isArray(parsed.viberOrders) ? parsed.viberOrders : []
      };
    }
  } catch (err) {
    console.error('Failed to read messaging store:', err);
  }

  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      channelId: '@shwemingalar_channel',
      accountName: 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
      webhookUrl: '',
      status: 'disconnected',
      statusMessage: ''
    },
    viber: {
      botToken: process.env.VIBER_AUTH_TOKEN || '',
      accountName: 'ရွှေမင်္ဂလာ Viber စာရင်းလက်ခံစနစ်',
      phoneNumber: '09-798889900',
      webhookUrl: '',
      status: 'disconnected',
      statusMessage: ''
    },
    telegramOrders: [],
    viberOrders: []
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
  return process.env.TELEGRAM_BOT_TOKEN || store.telegram.botToken || '';
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
   VIBER SERVICE METHODS
   ========================================================================= */

function getViberToken(): string {
  return process.env.VIBER_AUTH_TOKEN || store.viber.botToken || '';
}

async function callViberApi(endpoint: string, body: any = {}) {
  const token = getViberToken();
  if (!token) {
    return { ok: false, error: 'NO_TOKEN', message: 'Viber Auth Token is not configured' };
  }

  const url = `https://chatapi.viber.com/pa/${endpoint}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Viber-Auth-Token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000)
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      return { ok: false, status: response.status, message: 'Invalid JSON response from Viber' };
    }

    if (response.ok && data?.status === 0) {
      return { ok: true, result: data };
    }

    if (response.status === 401 || response.status === 403 || data?.status === 1) {
      return { ok: false, status: 401, message: 'Invalid Viber Auth Token (Unauthorized)' };
    }
    if (response.status === 429) {
      return { ok: false, status: 429, message: 'Viber API rate limit reached' };
    }

    return { ok: false, status: response.status, message: data?.status_message || `Viber error (status: ${data?.status})` };
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { ok: false, status: 408, message: 'Connection to Viber timed out' };
    }
    return { ok: false, status: 500, message: 'Network failure connecting to Viber API' };
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
    const { botToken, channelId, accountName, webhookUrl } = req.body || {};

    if (channelId) store.telegram.channelId = String(channelId).trim();
    if (accountName) store.telegram.accountName = String(accountName).trim();
    if (webhookUrl !== undefined) store.telegram.webhookUrl = String(webhookUrl).trim();

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


  // ----------------- VIBER ROUTES ----------------- //

  // 1. Viber Status Check
  router.get('/viber/status', async (req: Request, res: Response) => {
    const token = getViberToken();
    if (!token) {
      return res.json({
        ok: false,
        status: 'disconnected',
        hasToken: false,
        message: 'Viber Auth Token is not configured on the server'
      });
    }

    const test = await callViberApi('get_account_details');
    if (test.ok && test.result) {
      store.viber.status = 'connected';
      store.viber.connectedAt = new Date().toISOString();
      store.viber.statusMessage = `Connected to ${test.result.name || 'Viber Bot'}`;
      saveStore();

      return res.json({
        ok: true,
        status: 'connected',
        hasToken: true,
        account: {
          name: test.result.name,
          uri: test.result.uri,
          subscribersCount: test.result.subscribers_count
        },
        message: `Viber Bot [${test.result.name || 'Bot'}] သို့ အောင်မြင်စွာ ချိတ်ဆက်ထားပါသည်`
      });
    }

    store.viber.status = 'error';
    store.viber.statusMessage = test.message;
    saveStore();

    return res.json({
      ok: false,
      status: 'error',
      hasToken: true,
      message: test.message
    });
  });

  // 2. Viber Connection Test
  router.post('/viber/test', async (req: Request, res: Response) => {
    const { botToken } = req.body || {};
    const testToken = (botToken && typeof botToken === 'string' && botToken.trim()) || getViberToken();

    if (!testToken) {
      return res.json({
        status: 'disconnected',
        message: 'Viber Auth Token မရှိသေးပါ'
      });
    }

    try {
      const response = await fetch('https://chatapi.viber.com/pa/get_account_details', {
        method: 'POST',
        headers: {
          'X-Viber-Auth-Token': testToken.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(6000)
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.status === 0) {
        return res.json({
          status: 'connected',
          message: `Viber Bot အကောင့် [${data.name || 'Bot'}] သို့ တရားဝင် အောင်မြင်စွာ ချိတ်ဆက်ထားသည်`,
          account: {
            name: data.name,
            uri: data.uri,
            subscribersCount: data.subscribers_count
          }
        });
      }

      if (response.status === 401 || response.status === 403 || data?.status === 1) {
        return res.json({
          status: 'error',
          message: 'Viber API Key / Token မမှန်ကန်ပါ (Unauthorized)'
        });
      }

      return res.json({
        status: 'error',
        message: data?.status_message || `Viber Server မှ တုံ့ပြန်မှု မအောင်မြင်ပါ (status: ${data?.status})`
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return res.json({
          status: 'timeout',
          message: 'Viber API ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)'
        });
      }
      return res.json({
        status: 'error',
        message: 'Viber Server သို့ ချိတ်ဆက်၍ မရပါ (Network Failure)'
      });
    }
  });

  // 3. Viber Config GET
  router.get('/viber/config', (req: Request, res: Response) => {
    const token = getViberToken();
    res.json({
      hasToken: Boolean(token),
      maskedToken: maskToken(token),
      accountName: store.viber.accountName,
      phoneNumber: store.viber.phoneNumber,
      webhookUrl: store.viber.webhookUrl,
      status: store.viber.status,
      statusMessage: store.viber.statusMessage,
      connectedAt: store.viber.connectedAt
    });
  });

  // 4. Viber Config POST
  router.post('/viber/config', async (req: Request, res: Response) => {
    const { botToken, accountName, phoneNumber, webhookUrl } = req.body || {};

    if (accountName) store.viber.accountName = String(accountName).trim();
    if (phoneNumber) store.viber.phoneNumber = String(phoneNumber).trim();
    if (webhookUrl !== undefined) store.viber.webhookUrl = String(webhookUrl).trim();

    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      store.viber.botToken = botToken.trim();
    }

    const token = getViberToken();
    if (token) {
      const test = await callViberApi('get_account_details');
      if (test.ok && test.result) {
        store.viber.status = 'connected';
        store.viber.connectedAt = new Date().toISOString();
        store.viber.statusMessage = `Connected to ${test.result.name || 'Viber Bot'}`;
      } else {
        store.viber.status = 'error';
        store.viber.statusMessage = test.message;
      }
    } else {
      store.viber.status = 'disconnected';
      store.viber.statusMessage = 'Token missing';
    }

    saveStore();

    res.json({
      success: true,
      hasToken: Boolean(token),
      maskedToken: maskToken(token),
      status: store.viber.status,
      statusMessage: store.viber.statusMessage,
      connectedAt: store.viber.connectedAt
    });
  });

  // 5. Viber Set Webhook
  router.post('/viber/set-webhook', async (req: Request, res: Response) => {
    const { webhookUrl } = req.body || {};
    const url = webhookUrl || store.viber.webhookUrl;

    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({
        ok: false,
        message: 'HTTPS Webhook URL is required by Viber'
      });
    }

    const result = await callViberApi('set_webhook', {
      url,
      event_types: ['delivered', 'seen', 'failed', 'subscribed', 'unsubscribed', 'conversation_started', 'message'],
      send_name: true,
      send_photo: true
    });

    if (result.ok) {
      store.viber.webhookUrl = url;
      saveStore();
      return res.json({ ok: true, message: 'Viber Webhook registered successfully' });
    }

    return res.status(502).json({ ok: false, message: result.message });
  });

  // 6. Viber Webhook Receiver Endpoint
  router.post('/viber/webhook', (req: Request, res: Response) => {
    // 1. Verify Viber Content Signature if auth token is configured
    const viberToken = getViberToken();
    const incomingSignature = req.headers['x-viber-content-signature'];

    if (viberToken && incomingSignature) {
      try {
        const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
        const expectedSig = crypto.createHmac('sha256', viberToken).update(rawBody).digest('hex');
        const incomingBuf = Buffer.from(String(incomingSignature));
        const expBuf = Buffer.from(expectedSig);
        if (incomingBuf.length !== expBuf.length || !crypto.timingSafeEqual(incomingBuf, expBuf)) {
          return res.status(403).json({ error: 'Invalid Viber signature' });
        }
      } catch (sigErr) {
        return res.status(403).json({ error: 'Signature verification failure' });
      }
    }

    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // 1. Handshake verification event
    if (body.event === 'webhook') {
      return res.status(200).json({ status: 0, status_message: 'ok' });
    }

    // 2. Incoming Message Event
    if (body.event === 'message' && body.message) {
      const messageToken = String(body.message_token || '');
      if (messageToken && processedViberTokens.has(messageToken)) {
        return res.status(200).json({ status: 0, duplicate: true });
      }
      if (messageToken) {
        addToIdempotencySet(processedViberTokens, messageToken);
      }

      const sender = body.sender || {};
      const senderName = sender.name || 'Viber User';
      const senderId = sender.id || '';
      const text = body.message?.text || '';
      const photoUrl = body.message?.media || undefined;

      const { items, totalAmount, detectedCategory } = parseBetText(text, '3d');

      const newOrder: ViberIncomingOrder = {
        id: `viber-ord-${Date.now()}-${messageToken.slice(-6)}`,
        senderName,
        senderPhone: sender.phone || '',
        senderId,
        senderAvatar: sender.avatar,
        orderType: photoUrl ? 'photo' : 'text',
        category: detectedCategory,
        rawText: text,
        photoUrl,
        receivedAt: new Date().toISOString(),
        status: 'pending_review',
        parsedItems: items.map((it, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          number: it.number,
          amount: it.amount,
          betType: it.isRumble ? 'rumble' : 'straight',
          isRumble: it.isRumble
        })),
        subtotal: totalAmount,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: totalAmount,
        notes: `Viber Webhook token [${messageToken}]`
      };

      store.viberOrders.unshift(newOrder);
      if (store.viberOrders.length > 300) {
        store.viberOrders = store.viberOrders.slice(0, 300);
      }
      saveStore();
    }

    return res.status(200).json({ status: 0 });
  });

  // 7. Viber Outbound Message
  router.post('/viber/send-message', async (req: Request, res: Response) => {
    const { receiver, text, type = 'text' } = req.body || {};
    if (!receiver || !text) {
      return res.status(400).json({ ok: false, message: 'receiver and text are required' });
    }

    const result = await callViberApi('send_message', {
      receiver: String(receiver),
      min_api_version: 1,
      type,
      text: String(text)
    });

    return res.json(result);
  });

  // 8. Viber Orders Queue API
  router.get('/viber/orders', (req: Request, res: Response) => {
    res.json(store.viberOrders);
  });

  router.patch('/viber/orders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes, rejectionReason, approvedVoucherNo } = req.body || {};
    const order = store.viberOrders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    if (rejectionReason !== undefined) order.rejectionReason = rejectionReason;
    if (approvedVoucherNo !== undefined) order.approvedVoucherNo = approvedVoucherNo;
    order.verifiedAt = new Date().toISOString();
    saveStore();

    res.json(order);
  });

  router.delete('/viber/orders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    store.viberOrders = store.viberOrders.filter(o => o.id !== id);
    saveStore();
    res.json({ success: true });
  });

  return router;
}
