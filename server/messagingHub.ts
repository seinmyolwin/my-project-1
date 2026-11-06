import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadShopStore, saveShopStore, getAllShopStores, ShopStoreData, getDefaultShopStore } from './firestoreService';

export interface TelegramIncomingOrder {
  id: string;
  senderName: string;
  senderPhone?: string; // stripped per B2 requirement
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

export interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

// Session Token Management (D1)
const activeSessionTokens = new Set<string>();

export function generateOwnerSessionToken(pin: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessionTokens.add(token);
  return token;
}

export function verifyOwnerTokenMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing owner session token' });
  }
  const token = authHeader.split(' ')[1];
  if (!token || !activeSessionTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired owner session token' });
  }
  next();
}

// Helper to extract shop ID from request headers, query, or params
export function getShopIdFromReq(req: Request): string {
  const paramShop = req.params?.shopId;
  if (paramShop && typeof paramShop === 'string' && paramShop.trim()) {
    return paramShop.trim();
  }
  const headerShop = req.headers['x-shop-id'];
  if (headerShop && typeof headerShop === 'string' && headerShop.trim()) {
    return headerShop.trim();
  }
  const queryShop = req.query?.shopId;
  if (queryShop && typeof queryShop === 'string' && queryShop.trim()) {
    return queryShop.trim();
  }
  return 'default';
}

// In-memory idempotency sets
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

export function cleanTelegramToken(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const mmNumerals: Record<string, string> = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  let cleaned = raw.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
  cleaned = cleaned.replace(/\uFF1A/g, ':');
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0\u00AD\u200E\u200F\u202A-\u202E\r\n\t]/g, ' ');
  cleaned = cleaned.replace(/https?:\/\/api\.telegram\.org\/bot/gi, '');
  cleaned = cleaned.replace(/api\.telegram\.org\/bot/gi, '');
  cleaned = cleaned.replace(/\bbot(?=\d+:)/gi, '');
  cleaned = cleaned.replace(/(\d+)\s*:\s*([A-Za-z0-9_-]+)/g, '$1:$2');
  const match = cleaned.match(/(\d{5,15}:[A-Za-z0-9_-]{20,65})/);
  if (match) return match[1];
  cleaned = cleaned.replace(/^['"`<([{\s]+|['"`>)\]}\s]+$/g, '').trim();
  return cleaned;
}

export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;
  return /^\d{5,15}:[A-Za-z0-9_-]{20,65}$/.test(token.trim());
}

// In-memory multi-tenant store map
const shopStoresMap = new Map<string, ShopStoreData>();

async function initMultiShopStores() {
  const allShops = await getAllShopStores();
  for (const [id, shop] of Object.entries(allShops)) {
    shopStoresMap.set(id, shop);
  }
  if (!shopStoresMap.has('default')) {
    const def = await loadShopStore('default');
    shopStoresMap.set('default', def);
  }
  startTelegramPolling();
}
initMultiShopStores();

async function getOrCreateShopStore(shopId: string = 'default'): Promise<ShopStoreData> {
  const id = shopId && shopId.trim() ? shopId.trim() : 'default';
  if (!shopStoresMap.has(id)) {
    const loaded = await loadShopStore(id);
    shopStoresMap.set(id, loaded);
  }
  return shopStoresMap.get(id)!;
}

async function persistShopStore(shopId: string = 'default') {
  const id = shopId && shopId.trim() ? shopId.trim() : 'default';
  const shopData = shopStoresMap.get(id);
  if (shopData) {
    if (Array.isArray(shopData.telegramOrders)) {
      shopData.telegramOrders = shopData.telegramOrders.map((o: any) => {
        const { customerPhone, ...rest } = o;
        return rest;
      });
    }
    await saveShopStore(id, shopData);
  }
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return '';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

function convertMyanmarNumerals(text: string): string {
  const mmNumerals: Record<string, string> = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  return text.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
}

function get2DReversal(num: string): string[] {
  if (num.length !== 2) return [num];
  const rev = num[1] + num[0];
  return rev === num ? [num] : [num, rev];
}

function get3DPerms(num: string): string[] {
  if (num.length !== 3) return [num];
  const set = new Set<string>();
  const a = num.split('');
  set.add(a[0] + a[1] + a[2]);
  set.add(a[0] + a[2] + a[1]);
  set.add(a[1] + a[0] + a[2]);
  set.add(a[1] + a[2] + a[0]);
  set.add(a[2] + a[0] + a[1]);
  set.add(a[2] + a[1] + a[0]);
  return Array.from(set);
}

export function parseBetText(rawText: string, defaultCategory: '3d' | '2d' | 'football' = '3d') {
  if (!rawText || !rawText.trim()) {
    return { items: [], totalAmount: 0, detectedCategory: defaultCategory };
  }

  let cleanInput = rawText
    .replace(/@\w+/g, ' ')
    .replace(/^\/(?:2d|3d|football|fb|bet|play|order)\b/i, ' ')
    .trim();

  cleanInput = convertMyanmarNumerals(cleanInput);
  cleanInput = cleanInput.replace(/(\b\d{1,3})(,\d{3})+\b/g, (m) => m.replace(/,/g, ''));

  const lines = cleanInput.split(/[\r\n]+/);
  const items: { number: string; amount: number; isRumble: boolean; originalRaw: string }[] = [];
  let totalAmount = 0;
  let detectedCategory = defaultCategory;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const slashMatch = line.match(/^(.+?)\s*(?:=|:|-|\s)\s*(\d+)\s*\/\s*(\d+)\s*$/) ||
                       line.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)\s*$/);
    if (slashMatch) {
      const numbersRaw = slashMatch[1].trim();
      const directAmt = parseInt(slashMatch[2], 10);
      const revAmt = parseInt(slashMatch[3], 10);

      if (!isNaN(directAmt) && directAmt > 0 && !isNaN(revAmt) && revAmt > 0) {
        const tokens = numbersRaw.replace(/[=:\-,;*+]/g, ' ').split(/\s+/).filter(Boolean);
        for (const tok of tokens) {
          const num = tok.replace(/\D/g, '');
          if (num.length === 2) {
            detectedCategory = '2d';
            items.push({ number: num, amount: directAmt, isRumble: false, originalRaw: `${num}=${directAmt}` });
            totalAmount += directAmt;
            const revs = get2DReversal(num);
            const revNum = revs.length > 1 ? revs[1] : revs[0];
            items.push({ number: revNum, amount: revAmt, isRumble: true, originalRaw: `${revNum}=${revAmt}R` });
            totalAmount += revAmt;
          } else if (num.length === 3) {
            detectedCategory = '3d';
            items.push({ number: num, amount: directAmt, isRumble: false, originalRaw: `${num}=${directAmt}` });
            totalAmount += directAmt;
            const perms = get3DPerms(num);
            for (const p of perms) {
              items.push({ number: p, amount: revAmt, isRumble: true, originalRaw: `${p}=${revAmt}R` });
              totalAmount += revAmt;
            }
          }
        }
        continue;
      }
    }

    const cleanedLine = line
      .replace(/ကျပ်|ks|k|စီ/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const match = cleanedLine.match(/^(.+?)\s*(?:=|:|-|\s+)\s*(\d+)$/);
    if (match) {
      const numbersPart = match[1].trim();
      const amount = parseInt(match[2], 10);
      if (isNaN(amount) || amount <= 0) continue;

      const isR = /\b(r|အာ|ပတ်)\b/i.test(numbersPart);
      const numTokens = numbersPart.replace(/\b(r|အာ|ပတ်)\b/gi, '').replace(/[=:\-,;*+]/g, ' ').split(/\s+/).filter(Boolean);

      for (const tok of numTokens) {
        const num = tok.replace(/\D/g, '');
        if (!num) continue;
        if (num.length === 2) {
          detectedCategory = '2d';
          if (isR) {
            const revs = get2DReversal(num);
            for (const rNum of revs) {
              items.push({ number: rNum, amount, isRumble: true, originalRaw: `${num}R=${amount}` });
              totalAmount += amount;
            }
          } else {
            items.push({ number: num, amount, isRumble: false, originalRaw: `${num}=${amount}` });
            totalAmount += amount;
          }
        } else if (num.length === 3) {
          detectedCategory = '3d';
          if (isR) {
            const perms = get3DPerms(num);
            for (const p of perms) {
              items.push({ number: p, amount, isRumble: true, originalRaw: `${num}R=${amount}` });
              totalAmount += amount;
            }
          } else {
            items.push({ number: num, amount, isRumble: false, originalRaw: `${num}=${amount}` });
            totalAmount += amount;
          }
        }
      }
    }
  }

  return { items, totalAmount, detectedCategory };
}

function getTelegramTokenForShop(shopStore: ShopStoreData): string {
  if (shopStore.telegram?.botToken && shopStore.telegram.botToken.trim() !== '') {
    return cleanTelegramToken(shopStore.telegram.botToken);
  }
  return cleanTelegramToken(process.env.TELEGRAM_BOT_TOKEN || '');
}

function getTelegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || '';
}

async function callTelegramApi(endpoint: string, method = 'GET', body?: any, tokenOverride?: string) {
  const token = cleanTelegramToken(tokenOverride || '');
  if (!token) {
    return { ok: false, error: 'NO_TOKEN', message: 'Telegram Bot Token မရှိသေးပါ' };
  }

  const url = `https://api.telegram.org/bot${token}/${endpoint}`;
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TelegramBotApi/1.0'
    };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000)
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // ignore
    }

    if (response.ok && data && data.ok) {
      return { ok: true, result: data.result };
    }
    return { ok: false, message: data?.description || `Telegram API error (${response.status})` };
  } catch (err: any) {
    return {
      ok: false,
      message: err.name === 'AbortError' || err.name === 'TimeoutError'
        ? 'Telegram API ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)'
        : (err.message || 'Telegram network connection failed')
    };
  }
}

async function processTelegramUpdateForShop(update: any, shopId: string) {
  if (!update) return;
  const updateId = update.update_id;
  if (updateId && processedTgUpdates.has(updateId)) return;
  if (updateId) addToIdempotencySet(processedTgUpdates, updateId);

  const message = update.message || update.edited_message;
  if (!message) return;

  const chatId = message.chat?.id;
  const senderName = message.from?.first_name || message.from?.username || 'Telegram User';
  const text = message.text || message.caption || '';
  const photo = message.photo;

  if (!text && (!photo || photo.length === 0)) return;

  let category: '3d' | '2d' | 'football' = '3d';
  if (text.startsWith('/2d') || /2d/i.test(text)) category = '2d';
  else if (text.startsWith('/football') || /football|fb/i.test(text)) category = 'football';

  const parsed = parseBetText(text, category);
  if (parsed.items.length === 0 && !photo) return;

  const shopStore = await getOrCreateShopStore(shopId);

  const newOrder: TelegramIncomingOrder = {
    id: `tg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderName,
    chatId,
    orderType: photo && photo.length > 0 ? 'photo' : 'text',
    category: parsed.detectedCategory,
    rawText: text || '[Photo Slip]',
    parsedItems: parsed.items,
    totalAmount: parsed.totalAmount,
    status: 'pending_review',
    timestamp: Date.now()
  };

  if (photo && photo.length > 0) {
    const largestPhoto = photo[photo.length - 1];
    if (largestPhoto && largestPhoto.file_id) {
      const token = getTelegramTokenForShop(shopStore);
      if (token) {
        fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${largestPhoto.file_id}`)
          .then(r => r.json())
          .then(data => {
            if (data?.ok && data?.result?.file_path) {
              newOrder.photoUrl = `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
              persistShopStore(shopId);
            }
          })
          .catch(() => {});
      }
    }
  }

  shopStore.telegramOrders.unshift(newOrder);
  if (shopStore.telegramOrders.length > 200) shopStore.telegramOrders.pop();
  await persistShopStore(shopId);
}

function startTelegramPolling() {
  const shopOffsets = new Map<string, number>();

  const pollAllShops = async () => {
    for (const [shopId, shopStore] of shopStoresMap.entries()) {
      const token = getTelegramTokenForShop(shopStore);
      if (!token) continue;

      let offset = shopOffsets.get(shopId) || 0;
      try {
        const res = await callTelegramApi(`getUpdates?offset=${offset}&timeout=10`, 'GET', undefined, token);
        if (res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            shopOffsets.set(shopId, offset);
            await processTelegramUpdateForShop(update, shopId);
          }
          shopStore.telegram.status = 'connected';
          shopStore.telegram.statusMessage = 'Connected & Polling Live';
        }
      } catch {
        // ignore
      }
    }
  };

  setInterval(pollAllShops, 4000);
}

export function createMessagingRouter() {
  const router = express.Router();

  // 1. Telegram Config Status (Protected by owner token & scoped per Shop ID)
  router.get('/telegram/config', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const currentToken = getTelegramTokenForShop(shopStore);

    res.json({
      shopId,
      hasToken: Boolean(currentToken && currentToken.length > 0),
      maskedToken: maskToken(currentToken),
      channelId: shopStore.telegram.channelId,
      accountName: shopStore.telegram.accountName,
      webhookUrl: shopStore.telegram.webhookUrl,
      status: shopStore.telegram.status,
      statusMessage: shopStore.telegram.statusMessage,
      connectedAt: shopStore.telegram.connectedAt,
      bot: shopStore.telegram.botInfo
    });
  });

  // 2. Telegram Save / Update Config & Test Connection (Protected by owner token & scoped per Shop ID)
  router.post('/telegram/config', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { botToken, channelId, accountName, webhookUrl } = req.body || {};

    if (channelId !== undefined) shopStore.telegram.channelId = channelId;
    if (accountName !== undefined) shopStore.telegram.accountName = accountName;
    if (webhookUrl !== undefined) shopStore.telegram.webhookUrl = webhookUrl;

    if (botToken === '') {
      shopStore.telegram.botToken = '';
      shopStore.telegram.webhookUrl = '';
      shopStore.telegram.status = 'disconnected';
      shopStore.telegram.statusMessage = 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ';
      delete shopStore.telegram.connectedAt;
      delete shopStore.telegram.botInfo;
      await persistShopStore(shopId);

      return res.json({
        shopId,
        success: true,
        hasToken: false,
        maskedToken: '',
        status: shopStore.telegram.status,
        statusMessage: shopStore.telegram.statusMessage
      });
    }

    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      const cleaned = cleanTelegramToken(botToken);
      if (isValidTokenFormat(cleaned)) {
        shopStore.telegram.botToken = cleaned;
        const test = await callTelegramApi('getMe', 'GET', undefined, cleaned);
        if (test.ok && test.result) {
          const bot: TelegramBotInfo = {
            id: test.result.id,
            username: test.result.username || '',
            firstName: test.result.first_name || '',
            canJoinGroups: test.result.can_join_groups ?? true,
            canReadAllGroupMessages: test.result.can_read_all_group_messages ?? false,
            supportsInlineQueries: test.result.supports_inline_queries ?? false
          };
          shopStore.telegram.status = 'connected';
          shopStore.telegram.connectedAt = new Date().toISOString();
          shopStore.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
          shopStore.telegram.botInfo = bot;

          try {
            await fetch(`https://api.telegram.org/bot${cleaned}/deleteWebhook?drop_pending_updates=false`);
          } catch {
            // ignore
          }
        } else {
          shopStore.telegram.status = 'error';
          shopStore.telegram.statusMessage = test.message;
        }
      }
    }

    await persistShopStore(shopId);

    const currentToken = getTelegramTokenForShop(shopStore);
    res.json({
      shopId,
      success: true,
      hasToken: Boolean(currentToken && currentToken.length > 0),
      maskedToken: maskToken(currentToken),
      status: shopStore.telegram.status,
      statusMessage: shopStore.telegram.statusMessage,
      connectedAt: shopStore.telegram.connectedAt,
      bot: shopStore.telegram.botInfo
    });
  });

  // 3. Telegram Test Connection endpoint (POST & GET) (Protected by owner token & scoped per Shop ID)
  const handleTestConnection = async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);

    const candidateToken = req.body?.botToken || req.query?.botToken;
    const tokenToTest = candidateToken && typeof candidateToken === 'string' && candidateToken.trim()
      ? cleanTelegramToken(candidateToken)
      : getTelegramTokenForShop(shopStore);

    if (!tokenToTest) {
      return res.json({ status: 'disconnected', message: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ', shopId });
    }

    const test = await callTelegramApi('getMe', 'GET', undefined, tokenToTest);
    if (test.ok && test.result) {
      const bot: TelegramBotInfo = {
        id: test.result.id,
        username: test.result.username || '',
        firstName: test.result.first_name || '',
        canJoinGroups: test.result.can_join_groups ?? true,
        canReadAllGroupMessages: test.result.can_read_all_group_messages ?? false,
        supportsInlineQueries: test.result.supports_inline_queries ?? false
      };

      shopStore.telegram.botToken = tokenToTest;
      shopStore.telegram.status = 'connected';
      shopStore.telegram.connectedAt = new Date().toISOString();
      shopStore.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
      shopStore.telegram.botInfo = bot;
      await persistShopStore(shopId);

      return res.json({
        shopId,
        status: 'connected',
        message: `Telegram Connection Successful (@${bot.username || bot.firstName})`,
        bot
      });
    }

    return res.json({
      shopId,
      status: 'error',
      message: test.message || 'Telegram Bot Token မမှန်ကန်ပါ (401 Unauthorized)'
    });
  };

  router.post('/telegram/test', verifyOwnerTokenMiddleware, handleTestConnection);
  router.get('/telegram/test', verifyOwnerTokenMiddleware, handleTestConnection);

  // 4. Clear Token endpoint (Protected by owner token & scoped per Shop ID)
  router.post('/telegram/clear-token', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);

    try {
      const token = getTelegramTokenForShop(shopStore);
      if (token) {
        await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false }, token);
      }
    } catch {
      // ignore
    }

    shopStore.telegram.botToken = '';
    shopStore.telegram.webhookUrl = '';
    shopStore.telegram.status = 'disconnected';
    shopStore.telegram.statusMessage = 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)';
    delete shopStore.telegram.connectedAt;
    delete shopStore.telegram.botInfo;
    await persistShopStore(shopId);

    return res.json({
      shopId,
      success: true,
      hasToken: false,
      maskedToken: '',
      status: 'disconnected',
      statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)'
    });
  });

  // 5. Telegram Set Webhook (Protected by owner token & scoped per Shop ID)
  router.post('/telegram/set-webhook', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { webhookUrl } = req.body || {};
    const url = webhookUrl || shopStore.telegram.webhookUrl;

    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ ok: false, message: 'HTTPS Webhook URL is required by Telegram' });
    }

    const secret = getTelegramWebhookSecret();
    const token = getTelegramTokenForShop(shopStore);

    if (!token) {
      return res.status(400).json({ ok: false, message: 'Telegram Bot Token is required before setting webhook' });
    }

    const setPayload: any = {
      url,
      drop_pending_updates: false
    };
    if (secret) {
      setPayload.secret_token = secret;
    }

    const result = await callTelegramApi('setWebhook', 'POST', setPayload, token);

    if (result.ok) {
      shopStore.telegram.webhookUrl = url;
      await persistShopStore(shopId);
      return res.json({ shopId, ok: true, message: 'Telegram Webhook registered successfully' });
    }

    return res.status(502).json({ shopId, ok: false, message: result.message });
  });

  // 6. Telegram Delete Webhook (Protected by owner token & scoped per Shop ID)
  router.post('/telegram/delete-webhook', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const token = getTelegramTokenForShop(shopStore);

    const result = await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false }, token);
    if (result.ok) {
      shopStore.telegram.webhookUrl = '';
      await persistShopStore(shopId);
    }
    return res.json({ shopId, ...result });
  });

  // 7. Multi-Tenant Telegram Webhook Receiver Endpoints
  const handleWebhookPost = async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const configuredSecret = getTelegramWebhookSecret();

    if (configuredSecret) {
      const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (incomingSecret) {
        const incomingBuf = Buffer.from(incomingSecret as string);
        const configBuf = Buffer.from(configuredSecret);
        if (incomingBuf.length !== configBuf.length || !crypto.timingSafeEqual(incomingBuf, configBuf)) {
          return res.status(403).json({ error: 'Forbidden: Invalid secret token' });
        }
      }
    }

    const update = req.body;
    await processTelegramUpdateForShop(update, shopId);

    return res.status(200).json({ ok: true, shopId });
  };

  router.post('/telegram/webhook', handleWebhookPost);
  router.post('/telegram/webhook/:shopId', handleWebhookPost);

  // 8. Telegram Outbound Message (Protected by owner token & scoped per Shop ID)
  router.post('/telegram/send-message', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);

    const { chatId, text, parseMode } = req.body || {};
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, message: 'chatId and text are required' });
    }

    const token = getTelegramTokenForShop(shopStore);
    const result = await callTelegramApi('sendMessage', 'POST', {
      chat_id: chatId,
      text: String(text),
      parse_mode: parseMode || 'HTML'
    }, token);

    return res.json({ shopId, ...result });
  });

  // 9. Telegram Orders Queue API (Protected by owner token & scoped per Shop ID)
  router.get('/telegram/orders', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    res.json(shopStore.telegramOrders || []);
  });

  router.patch('/telegram/orders/:id', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { id } = req.params;
    const { status, notes } = req.body || {};

    const order = (shopStore.telegramOrders || []).find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    await persistShopStore(shopId);

    res.json(order);
  });

  router.delete('/telegram/orders/:id', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { id } = req.params;

    shopStore.telegramOrders = (shopStore.telegramOrders || []).filter(o => o.id !== id);
    await persistShopStore(shopId);

    res.json({ success: true, shopId });
  });

  return router;
}
