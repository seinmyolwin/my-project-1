import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { loadShopStore, saveShopStore, getAllShopStores, ShopStoreData } from './firestoreService.js';
import { parseTwoDBatchInput } from '../src/utils/twoDLotteryUtils.js';
import { parseQuickBetText, convertMyanmarToEnglishDigits } from '../src/utils/lotteryUtils.js';

export interface TelegramIncomingOrder {
  id: string;
  senderName: string;
  senderPhone?: string;
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

const activeSessionTokens = new Set<string>();

export function generateOwnerSessionToken(pin: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessionTokens.add(token);
  return token;
}

export function verifyOwnerTokenMiddleware(req: Request, res: Response, next: Function) {
  const hasShopHeader = Boolean(req.headers['x-shop-id']);
  const hasBotTokenHeader = Boolean(req.headers['x-telegram-bot-token']);
  const authHeader = req.headers['authorization'];

  if (hasShopHeader || hasBotTokenHeader) return next();

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && (activeSessionTokens.has(token) || token.length >= 16)) return next();
  }

  next();
}

export function getShopIdFromReq(req: Request): string {
  const paramShop = req.params?.shopId;
  if (paramShop && typeof paramShop === 'string' && paramShop.trim()) return paramShop.trim();
  const headerShop = req.headers['x-shop-id'];
  if (headerShop && typeof headerShop === 'string' && headerShop.trim()) return headerShop.trim();
  const queryShop = req.query?.shopId;
  if (queryShop && typeof queryShop === 'string' && queryShop.trim()) return queryShop.trim();
  return 'default';
}

// Global Set to prevent duplicate updates across webhook and polling
const processedTgUpdates = new Set<number>();

function addToIdempotencySet<T>(set: Set<T>, item: T, maxSize = 10000) {
  if (set.size >= maxSize) {
    const firstItem = set.values().next().value;
    if (firstItem !== undefined) set.delete(firstItem);
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
  return cleaned.replace(/^['"`<([{\s]+|['"`>)\]}\s]+$/g, '').trim();
}

export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;
  return /^\d{5,15}:[A-Za-z0-9_-]{20,65}$/.test(token.trim());
}

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
}
initMultiShopStores().catch(err => console.error('Failed to init multi-shop stores:', err));

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

export function parseBetText(rawText: string, defaultCategory: '3d' | '2d' | 'football' = '2d') {
  if (!rawText || !rawText.trim()) {
    return { items: [], totalAmount: 0, detectedCategory: defaultCategory };
  }

  let cleanInput = rawText
    .replace(/@\w+/g, ' ')
    .replace(/^\/(?:2d|3d|football|fb|bet|play|order)\b/i, ' ')
    .trim();

  cleanInput = convertMyanmarToEnglishDigits(cleanInput);

  const isExplicit2D = /^\/2d\b|\b2d\b/i.test(rawText);
  const isExplicit3D = /^\/3d\b|\b3d\b/i.test(rawText);
  const isExplicitFb = /^\/football\b|\bfb\b/i.test(rawText);

  // Run 2D batch parser (exact same engine as Quick Sale Entry Batch Paste)
  const res2D = parseTwoDBatchInput(cleanInput, 1000);
  const items2D = Array.isArray(res2D) ? res2D : (res2D as any).items || [];

  // Run 3D batch parser (exact same engine as Quick Sale Entry Batch Paste)
  const res3D = parseQuickBetText(cleanInput);
  const items3D = res3D.items || [];

  let detectedCategory: '3d' | '2d' | 'football' = defaultCategory;
  if (isExplicitFb) {
    detectedCategory = 'football';
  } else if (isExplicit2D) {
    detectedCategory = '2d';
  } else if (isExplicit3D) {
    detectedCategory = '3d';
  } else if (items2D.length > 0 && items3D.length === 0) {
    detectedCategory = '2d';
  } else if (items3D.length > 0 && items2D.length === 0) {
    detectedCategory = '3d';
  } else if (items2D.length > 0 && items3D.length > 0) {
    const count2D = items2D.filter(it => it.number && it.number.length === 2).length;
    const count3D = items3D.filter(it => it.number && it.number.length === 3).length;
    detectedCategory = count2D >= count3D ? '2d' : '3d';
  }

  let finalItems: { number: string; amount: number; isRumble: boolean; originalRaw: string }[] = [];
  if (detectedCategory === '2d' && items2D.length > 0) {
    finalItems = items2D.map(it => ({
      number: it.number,
      amount: it.amount,
      isRumble: it.isRumble || false,
      originalRaw: it.originalInput || it.number
    }));
  } else if (detectedCategory === '3d' && items3D.length > 0) {
    finalItems = items3D.map(it => ({
      number: it.number,
      amount: it.amount,
      isRumble: it.isRumble || false,
      originalRaw: it.originalInput || `${it.number}=${it.amount}${it.isRumble ? 'R' : ''}`
    }));
  } else if (items2D.length > 0) {
    finalItems = items2D.map(it => ({
      number: it.number,
      amount: it.amount,
      isRumble: it.isRumble || false,
      originalRaw: it.originalInput || it.number
    }));
    detectedCategory = '2d';
  } else if (items3D.length > 0) {
    finalItems = items3D.map(it => ({
      number: it.number,
      amount: it.amount,
      isRumble: it.isRumble || false,
      originalRaw: it.originalInput || `${it.number}=${it.amount}${it.isRumble ? 'R' : ''}`
    }));
    detectedCategory = '3d';
  }

  const totalAmount = finalItems.reduce((s, it) => s + (it.amount || 0), 0);
  return { items: finalItems, totalAmount, detectedCategory };
}

function getTelegramTokenForShop(shopStore: ShopStoreData): string {
  if (shopStore.telegram?.botToken && shopStore.telegram.botToken.trim() !== '') {
    return cleanTelegramToken(shopStore.telegram.botToken);
  }
  return cleanTelegramToken(process.env.TELEGRAM_BOT_TOKEN || '');
}

async function callTelegramApi(endpoint: string, method = 'GET', body?: any, tokenOverride?: string) {
  const token = cleanTelegramToken(tokenOverride || '');
  if (!token) return { ok: false, error: 'NO_TOKEN', message: 'Telegram Bot Token မရှိသေးပါ' };

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
    try { data = await response.json(); } catch {}

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

// ၃ စက္ကန့်တကြိမ်ဖြင့် Telegram updates များကို စစ်ဆေးပေးမည့် Polling စနစ်
const shopOffsets = new Map<string, number>();

async function processTelegramUpdateForShop(update: any, shopId: string) {
  if (!update) return;
  const updateId = update.update_id;
  
  // Idempotency check: process each update ID only once
  if (updateId && processedTgUpdates.has(updateId)) return;
  if (updateId) addToIdempotencySet(processedTgUpdates, updateId);

  const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
  if (!message) return;

  const chatId = message.chat?.id;
  const isGroup = message.chat?.type === 'group' || message.chat?.type === 'supergroup';
  const chatTitle = message.chat?.title;

  let senderName = message.from?.first_name || '';
  if (message.from?.last_name) senderName += ` ${message.from.last_name}`;
  if (!senderName.trim()) senderName = message.from?.username || '';
  senderName = senderName.trim() || 'အထွေထွေ';
  
  if (isGroup && chatTitle) {
    senderName = `${senderName} [${chatTitle}]`;
  }

  const text = message.text || message.caption || '';
  const photo = message.photo;

  if (!text && (!photo || photo.length === 0)) return;

  const cleanText = text.trim();
  if (cleanText.startsWith('/start') || cleanText.startsWith('/help') || cleanText.startsWith('/ping')) return;

  let category: '3d' | '2d' | 'football' = '2d';
  if (text.startsWith('/2d') || /\b2d\b/i.test(text)) category = '2d';
  else if (text.startsWith('/3d') || /\b3d\b/i.test(text)) category = '3d';
  else if (text.startsWith('/football') || /\bfootball\b|\bfb\b/i.test(text)) category = 'football';

  const parsed = parseBetText(cleanText, category);
  const shopStore = await getOrCreateShopStore(shopId);

  if (!Array.isArray(shopStore.telegramOrders)) {
    shopStore.telegramOrders = [];
  }

  const orderId = `tg-${updateId || Date.now()}-${message.message_id || Math.random().toString(36).substring(2, 6)}`;
  
  // Deduplicate against existing orders in this shop store
  const exists = shopStore.telegramOrders.some((o: any) => o.id === orderId);
  if (exists) return;

  const newOrder: TelegramIncomingOrder = {
    id: orderId,
    senderName: senderName || 'အထွေထွေ',
    chatId,
    orderType: photo && photo.length > 0 ? 'photo' : 'text',
    category: parsed.detectedCategory,
    rawText: cleanText, // Strictly original sent text only
    parsedItems: parsed.items,
    totalAmount: parsed.totalAmount,
    status: 'pending_review',
    timestamp: message.date ? message.date * 1000 : Date.now(),
    notes: isGroup ? `[Group Chat: ${chatTitle || 'Group'}]` : undefined
  };

  shopStore.telegramOrders.unshift(newOrder);
  if (shopStore.telegramOrders.length > 200) shopStore.telegramOrders.pop();
  await persistShopStore(shopId);
}

// Background polling loop every 3 seconds
setInterval(async () => {
  for (const [shopId, shopStore] of shopStoresMap.entries()) {
    const token = getTelegramTokenForShop(shopStore);
    if (!token) continue;

    let offset = shopOffsets.get(shopId) || 0;
    try {
      const res = await callTelegramApi(`getUpdates?offset=${offset}&timeout=2`, 'GET', undefined, token);
      if (!res.ok && res.message && res.message.includes("can't use getUpdates while webhook is active")) {
        if (!shopStore.telegram.webhookUrl) {
          console.log(`[Telegram Polling] Clearing stale Telegram webhook for shop ${shopId}...`);
          await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false }, token);
        }
      }
      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          shopOffsets.set(shopId, offset);
          await processTelegramUpdateForShop(update, shopId);
        }
      }
    } catch {}
  }
}, 3000);

export function createMessagingRouter() {
  const router = express.Router();

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
      return res.json({ shopId, success: true, hasToken: false, maskedToken: '' });
    }

    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      const cleaned = cleanTelegramToken(botToken);
      if (isValidTokenFormat(cleaned)) {
        shopStore.telegram.botToken = cleaned;
        const test = await callTelegramApi('getMe', 'GET', undefined, cleaned);
        if (test.ok && test.result) {
          shopStore.telegram.status = 'connected';
          shopStore.telegram.connectedAt = new Date().toISOString();
          shopStore.telegram.statusMessage = `Connected to @${test.result.username || test.result.first_name}`;
          shopStore.telegram.botInfo = test.result;
        } else {
          shopStore.telegram.status = 'error';
          shopStore.telegram.statusMessage = test.message;
        }
      }
    }

    await persistShopStore(shopId);
    res.json({ shopId, success: true, status: shopStore.telegram.status });
  });

  // Test Telegram Bot Connection
  router.post('/telegram/test', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { botToken, webhookUrl } = req.body || {};
    const candidateToken = cleanTelegramToken(botToken || (req.headers['x-telegram-bot-token'] as string) || getTelegramTokenForShop(shopStore));

    if (!candidateToken || !isValidTokenFormat(candidateToken)) {
      return res.status(400).json({ status: 'error', error_type: 'format_invalid', message: 'Valid Telegram Bot Token is required' });
    }

    const testRes = await callTelegramApi('getMe', 'GET', undefined, candidateToken);
    if (testRes.ok && testRes.result) {
      const bot = {
        id: testRes.result.id,
        username: testRes.result.username || '',
        firstName: testRes.result.first_name || '',
        canJoinGroups: testRes.result.can_join_groups ?? true,
        canReadAllGroupMessages: testRes.result.can_read_all_group_messages ?? false,
        supportsInlineQueries: testRes.result.supports_inline_queries ?? false
      };
      shopStore.telegram.botToken = candidateToken;
      shopStore.telegram.status = 'connected';
      shopStore.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
      shopStore.telegram.connectedAt = new Date().toISOString();
      shopStore.telegram.botInfo = testRes.result;
      if (webhookUrl) shopStore.telegram.webhookUrl = webhookUrl;
      await persistShopStore(shopId);

      return res.json({
        status: 'connected',
        message: `Connected to @${bot.username || bot.firstName}`,
        bot
      });
    }

    return res.status(400).json({
      status: 'error',
      message: testRes.message || 'Telegram Bot Connection Failed'
    });
  });

  // Webhook Registration Handler
  router.post('/telegram/set-webhook', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    let { webhookUrl } = req.body || {};
    const token = getTelegramTokenForShop(shopStore);

    if (!token) {
      return res.status(400).json({ ok: false, message: 'Telegram Bot Token is missing' });
    }

    if (!webhookUrl || !webhookUrl.trim()) {
      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      webhookUrl = `${protocol}://${host}/api/telegram/webhook/${shopId}`;
    }

    const tgRes = await callTelegramApi('setWebhook', 'POST', { url: webhookUrl.trim() }, token);
    if (tgRes.ok) {
      shopStore.telegram.webhookUrl = webhookUrl.trim();
      shopStore.telegram.status = 'connected';
      await persistShopStore(shopId);
      return res.json({ ok: true, message: 'Telegram Webhook Registered Successfully', webhookUrl: webhookUrl.trim() });
    }

    return res.status(400).json({ ok: false, message: tgRes.message || 'Failed to set Telegram Webhook' });
  });

  // Delete Webhook Handler
  router.post('/telegram/delete-webhook', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const token = getTelegramTokenForShop(shopStore);

    if (!token) {
      return res.status(400).json({ ok: false, message: 'Telegram Bot Token is missing' });
    }

    const tgRes = await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false }, token);
    if (tgRes.ok) {
      shopStore.telegram.webhookUrl = '';
      await persistShopStore(shopId);
      return res.json({ ok: true, message: 'Webhook Deleted Successfully. Reverted to Auto-Polling.' });
    }

    return res.status(400).json({ ok: false, message: tgRes.message || 'Failed to delete Webhook' });
  });

  // Clear Token Handler
  router.post('/telegram/clear-token', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    shopStore.telegram.botToken = '';
    shopStore.telegram.webhookUrl = '';
    shopStore.telegram.status = 'disconnected';
    shopStore.telegram.statusMessage = 'Bot Token cleared';
    delete shopStore.telegram.connectedAt;
    delete shopStore.telegram.botInfo;
    await persistShopStore(shopId);
    res.json({ ok: true, message: 'Bot Token cleared' });
  });

  // Send Message Proxy
  router.post('/telegram/send-message', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { chatId, text } = req.body || {};
    const token = getTelegramTokenForShop(shopStore);
    const targetChat = chatId || (req.headers['x-telegram-chat-id'] as string) || shopStore.telegram.channelId;

    if (!token || !targetChat || !text) {
      return res.status(400).json({ ok: false, message: 'Missing bot token, chat ID, or message text' });
    }

    const tgRes = await callTelegramApi('sendMessage', 'POST', {
      chat_id: targetChat,
      text: String(text),
      parse_mode: 'HTML'
    }, token);

    if (tgRes.ok) {
      return res.json({ ok: true, result: tgRes.result });
    }
    return res.status(400).json({ ok: false, message: tgRes.message || 'Failed to send message' });
  });

  const handleWebhookPost = async (req: Request, res: Response) => {
    const rawShopId = req.params?.shopId || (req.headers['x-shop-id'] as string) || (req.query?.shopId as string);
    
    let update = req.body;
    if (typeof update === 'string') {
      try { update = JSON.parse(update); } catch {}
    }
    
    // Vercel serverless environment fallback for raw body parsing
    if (!update || Object.keys(update).length === 0) {
      try {
        let rawBody = '';
        for await (const chunk of req) {
          rawBody += chunk;
        }
        if (rawBody) {
          update = JSON.parse(rawBody);
        }
      } catch (err) {
        console.error('Webhook body parse error:', err);
      }
    }

    if (!update) {
      return res.status(400).json({ ok: false, error: 'No update data received' });
    }

    if (rawShopId && typeof rawShopId === 'string' && rawShopId.trim() && rawShopId.trim() !== 'default') {
      await processTelegramUpdateForShop(update, rawShopId.trim());
    } else {
      const allShops = Array.from(shopStoresMap.keys());
      if (allShops.length === 0) allShops.push('default');
      for (const targetShopId of allShops) {
        await processTelegramUpdateForShop(update, targetShopId);
      }
    }
    return res.status(200).json({ ok: true });
  };

  router.post('/telegram/webhook', handleWebhookPost);
  router.post('/telegram/webhook/:shopId', handleWebhookPost);

  router.get('/telegram/orders', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    res.json(shopStore.telegramOrders || []);
  });

  router.patch('/telegram/orders/:id', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const orderId = req.params.id;
    const { status, notes } = req.body || {};

    if (!Array.isArray(shopStore.telegramOrders)) shopStore.telegramOrders = [];

    const orderIdx = shopStore.telegramOrders.findIndex((o: any) => o.id === orderId);
    if (orderIdx === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (status) shopStore.telegramOrders[orderIdx].status = status;
    if (notes !== undefined) shopStore.telegramOrders[orderIdx].notes = notes;

    await persistShopStore(shopId);
    res.json({ ok: true, order: shopStore.telegramOrders[orderIdx] });
  });

  router.delete('/telegram/orders/:id', verifyOwnerTokenMiddleware, async (req: Request, res: Response) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const orderId = req.params.id;

    if (!Array.isArray(shopStore.telegramOrders)) shopStore.telegramOrders = [];

    shopStore.telegramOrders = shopStore.telegramOrders.filter((o: any) => o.id !== orderId);
    await persistShopStore(shopId);
    res.json({ ok: true, message: 'Order deleted' });
  });

  return router;
}

const mainRouter = createMessagingRouter();
export default mainRouter;
