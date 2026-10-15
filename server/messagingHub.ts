import express from 'express';
import type { Request, Response } from 'express';
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

export interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

interface ServerStoreData {
  telegram: {
    botToken: string;
    channelId: string;
    accountName: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error' | 'timeout';
    statusMessage?: string;
    connectedAt?: string;
    botInfo?: TelegramBotInfo;
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

/**
 * Intelligent Telegram Bot Token Sanitizer
 * Handles:
 * - Myanmar numerals (၀-၉ -> 0-9)
 * - Fullwidth colon '：' (U+FF1A -> ':')
 * - Zero-width spaces, non-breaking spaces, control characters
 * - Pasted messages from BotFather (extracts exact token)
 * - Leading 'bot' prefix or 'https://api.telegram.org/bot...'
 * - Surrounding quotes or whitespace
 */
/**
 * Intelligent Telegram Bot Token Sanitizer for Tablets & Mobile
 */
export function cleanTelegramToken(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  // 1. Convert Myanmar numerals (၀-၉) to English digits (0-9)
  const mmNumerals: Record<string, string> = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  let cleaned = raw.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);

  // 2. Replace fullwidth colon '：' (U+FF1A) with standard ASCII ':' (U+003A)
  cleaned = cleaned.replace(/\uFF1A/g, ':');

  // 3. Remove zero-width spaces, joiners, non-breaking spaces, control characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0\u00AD\u200E\u200F\u202A-\u202E\r\n\t]/g, ' ');

  // 4. Strip leading URLs or API prefixes if user pasted full API link
  cleaned = cleaned.replace(/https?:\/\/api\.telegram\.org\/bot/gi, '');
  cleaned = cleaned.replace(/api\.telegram\.org\/bot/gi, '');
  cleaned = cleaned.replace(/\bbot(?=\d+:)/gi, '');

  // 5. Remove spaces around colon (e.g. "123456789 : ABC..." -> "123456789:ABC...")
  cleaned = cleaned.replace(/(\d+)\s*:\s*([A-Za-z0-9_-]+)/g, '$1:$2');

  // 6. Extract token pattern <digits>:<chars> anywhere in text
  const match = cleaned.match(/(\d{7,12}:[A-Za-z0-9_-]{25,50})/);
  if (match) {
    return match[1];
  }

  // 7. Strip surrounding quotes or brackets
  cleaned = cleaned.replace(/^['"`<([{\s]+|['"`>)\]}\s]+$/g, '').trim();

  return cleaned;
}

export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;
  return /^\d{7,12}:[A-Za-z0-9_-]{25,50}$/.test(token);
}

import { loadStoreFromFirestore, saveStoreToFirestore } from './firestoreService';

interface ServerStoreData {
  telegram: {
    botToken: string;
    channelId: string;
    accountName: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error' | 'timeout';
    statusMessage?: string;
    connectedAt?: string;
    botInfo?: TelegramBotInfo;
  };
  telegramOrders: TelegramIncomingOrder[];
}

// In-memory store
let store: ServerStoreData = {
  telegram: {
    botToken: '',
    channelId: '',
    accountName: '',
    webhookUrl: '',
    status: 'disconnected',
    statusMessage: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ',
  },
  telegramOrders: []
};

// Initialize store from Firestore
async function initStore() {
  store = await loadStoreFromFirestore();
  // Start polling after store is loaded
  startTelegramPolling();
}
initStore();

function saveStore() {
  saveStoreToFirestore(store);
}


function maskToken(token: string): string {
  if (!token || token.length < 8) return '';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

// Convert Myanmar numerals (၀-၉) to English digits
function convertMyanmarNumerals(text: string): string {
  const mmNumerals: Record<string, string> = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  return text.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
}

// Generate permutations for 2D reversal
function get2DReversal(num: string): string[] {
  if (num.length !== 2) return [num];
  const rev = num[1] + num[0];
  return rev === num ? [num] : [num, rev];
}

// Generate permutations for 3D
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

/**
 * Robust parser for Myanmar lottery bets in Telegram messages
 * Supports:
 * - Direct / Reversal slash ratio: "23 45 26 800/200" or "34 46 37 1000/500"
 * - 3D straight + rumble slash ratio: "123 456 1000/200"
 * - Multiple numbers on a line with amount: "23, 45, 67 = 500"
 * - Reversals / R: "24R 500", "24 အာ 500", "24 ပတ် 500", "123R 1000"
 * - Myanmar numerals: "၂၃ ၄၅ ၅၀၀/၁၀၀"
 * - Cleans bot mentions (@my_bot) and slash commands (/2d, /3d, /bet)
 */
export function parseBetText(rawText: string, defaultCategory: '3d' | '2d' | 'football' = '3d') {
  if (!rawText || !rawText.trim()) {
    return { items: [], totalAmount: 0, detectedCategory: defaultCategory };
  }

  // 1. Strip bot mentions (e.g. @shwemingalar_bot) and command prefixes (e.g. /2d, /3d, /bet, /start)
  let cleanInput = rawText
    .replace(/@\w+/g, ' ')
    .replace(/^\/(?:2d|3d|football|fb|bet|play|order)\b/i, ' ')
    .trim();

  // 2. Convert Myanmar numerals
  cleanInput = convertMyanmarNumerals(cleanInput);

  // 3. Remove thousands separators
  cleanInput = cleanInput.replace(/(\b\d{1,3})(,\d{3})+\b/g, (m) => m.replace(/,/g, ''));

  const lines = cleanInput.split(/[\r\n]+/);
  const items: { number: string; amount: number; isRumble: boolean; originalRaw: string }[] = [];
  let totalAmount = 0;
  let detectedCategory = defaultCategory;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Pattern A: Slash ratio (e.g. "23 45 26 800/200" or "123 456 1000/200")
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
            // Direct bet
            items.push({
              number: num,
              amount: directAmt,
              isRumble: false,
              originalRaw: `${num}=${directAmt}`
            });
            totalAmount += directAmt;

            // Reversal bet
            const revs = get2DReversal(num);
            const revNum = revs.length > 1 ? revs[1] : revs[0];
            items.push({
              number: revNum,
              amount: revAmt,
              isRumble: true,
              originalRaw: `${revNum}=${revAmt}R`
            });
            totalAmount += revAmt;
          } else if (num.length === 3) {
            detectedCategory = '3d';
            // Straight bet
            items.push({
              number: num,
              amount: directAmt,
              isRumble: false,
              originalRaw: `${num}=${directAmt}`
            });
            totalAmount += directAmt;

            // Rumble permutations
            const perms = get3DPerms(num);
            for (const p of perms) {
              items.push({
                number: p,
                amount: revAmt,
                isRumble: true,
                originalRaw: `${p}=${revAmt}R`
              });
              totalAmount += revAmt;
            }
          }
        }
        continue;
      }
    }

    // Pattern B: Standard lines (e.g. "24=500", "123=1000", "24 42 R 500", "35 56 1000")
    const cleanedLine = line
      .replace(/ကျပ်|ks|k|စီ/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const isRumble = /r|R|ပတ်|ခွေ|အာ/i.test(cleanedLine);
    const lineForParts = cleanedLine
      .replace(/r|R|ပတ်|ခွေ|အာ/gi, ' ')
      .replace(/[:=\-*\/x]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = lineForParts.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      const amountStr = parts[parts.length - 1];
      const amt = parseInt(amountStr, 10);
      if (!isNaN(amt) && amt > 0) {
        const numbers = parts.slice(0, parts.length - 1);
        for (const numStr of numbers) {
          const cleanNum = numStr.replace(/\D/g, '');
          if (cleanNum.length === 2) {
            detectedCategory = '2d';
            if (isRumble) {
              const revs = get2DReversal(cleanNum);
              for (const r of revs) {
                items.push({
                  number: r,
                  amount: amt,
                  isRumble: true,
                  originalRaw: `${r}=${amt}R`
                });
                totalAmount += amt;
              }
            } else {
              items.push({
                number: cleanNum,
                amount: amt,
                isRumble: false,
                originalRaw: `${cleanNum}=${amt}`
              });
              totalAmount += amt;
            }
          } else if (cleanNum.length === 3) {
            if (detectedCategory !== '2d') detectedCategory = '3d';
            if (isRumble) {
              const perms = get3DPerms(cleanNum);
              for (const p of perms) {
                items.push({
                  number: p,
                  amount: amt,
                  isRumble: true,
                  originalRaw: `${p}=${amt}R`
                });
                totalAmount += amt;
              }
            } else {
              items.push({
                number: cleanNum,
                amount: amt,
                isRumble: false,
                originalRaw: `${cleanNum}=${amt}`
              });
              totalAmount += amt;
            }
          }
        }
      }
    }
  }

  return { items, totalAmount, detectedCategory };
}

// Process update from Webhook OR Polling
function processTelegramUpdate(update: any): boolean {
  if (!update || typeof update !== 'object' || !update.update_id) {
    return false;
  }

  // Idempotency check
  if (processedTgUpdates.has(update.update_id)) {
    return false;
  }
  addToIdempotencySet(processedTgUpdates, update.update_id);

  const msg = update.message || update.channel_post || update.edited_message;
  if (!msg) return false;

  const text = msg.text || msg.caption || '';
  const chatId = msg.chat?.id;
  const chatTitle = msg.chat?.title || '';

  let senderName = msg.from
    ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || msg.from.username || 'Telegram User'
    : (chatTitle || 'Telegram Member');

  if (chatTitle && msg.from) {
    senderName = `${senderName} (${chatTitle})`;
  } else if (chatTitle) {
    senderName = chatTitle;
  }

  const senderPhone = msg.contact?.phone_number || '';

  // Parse bet text
  const { items, totalAmount, detectedCategory } = parseBetText(text, '3d');

  // Accept text orders OR photo orders (even without caption)
  if (text.trim().length > 0 || msg.photo) {
    const isPhoto = Boolean(msg.photo && msg.photo.length > 0);
    const newOrder: TelegramIncomingOrder = {
      id: `tg-ord-${Date.now()}-${update.update_id}`,
      senderName,
      senderPhone,
      chatId,
      orderType: isPhoto ? 'photo' : 'text',
      category: detectedCategory,
      rawText: text || '(ဓါတ်ပုံစလစ် / Photo Slip)',
      parsedItems: items,
      totalAmount: totalAmount || 0,
      status: 'pending_review',
      timestamp: Date.now(),
      notes: chatTitle ? `[Group: ${chatTitle}] update_id [${update.update_id}]` : `Direct chat update_id [${update.update_id}]`
    };

    store.telegramOrders.unshift(newOrder);
    if (store.telegramOrders.length > 300) {
      store.telegramOrders = store.telegramOrders.slice(0, 300);
    }
    saveStore();
    return true;
  }
  return false;
}

let tgPollingActive = false;
let lastUpdateId = 0;

export function startTelegramPolling() {
  if (tgPollingActive) return;
  tgPollingActive = true;

  const pollLoop = async () => {
    while (tgPollingActive) {
      const token = getTelegramToken();
      if (!token) {
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=50&timeout=4`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.result)) {
            for (const upd of data.result) {
              if (upd.update_id > lastUpdateId) {
                lastUpdateId = upd.update_id;
              }
              processTelegramUpdate(upd);
            }
          }
        } else if (res.status === 409) {
          // Webhook conflict detected! Automatically clear webhook so polling works!
          console.warn('[Telegram Polling] 409 Webhook Conflict detected. Deleting webhook to restore polling...');
          try {
            await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
          } catch {
            // ignore
          }
          await new Promise(r => setTimeout(r, 3000));
        } else if (res.status === 401) {
          // Token is unauthorized! Sleep longer to prevent spamming
          await new Promise(r => setTimeout(r, 10000));
        }
      } catch {
        // network timeout / offline
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  };

  pollLoop().catch(err => console.error('Telegram polling error:', err));
}

/* =========================================================================
   TELEGRAM SERVICE METHODS
   ========================================================================= */

function getTelegramToken(): string {
  if (store.telegram?.botToken && store.telegram.botToken.trim() !== '') {
    return cleanTelegramToken(store.telegram.botToken);
  }
  return cleanTelegramToken(process.env.TELEGRAM_BOT_TOKEN || '');
}

function getTelegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || 'shwemingalar_tg_secret_v1';
}

async function callTelegramApi(endpoint: string, method = 'GET', body?: any, tokenOverride?: string) {
  const token = cleanTelegramToken(tokenOverride || getTelegramToken());
  if (!token) {
    return { ok: false, error: 'NO_TOKEN', message: 'Telegram Bot Token မရှိသေးပါ' };
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
      signal: AbortSignal.timeout(7000)
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
      return {
        ok: false,
        status: 401,
        error: 'UNAUTHORIZED',
        message: 'Telegram Bot Token မမှန်ကန်ပါ (401 Unauthorized)'
      };
    }
    if (response.status === 429) {
      const retryAfter = data?.parameters?.retry_after || 5;
      return {
        ok: false,
        status: 429,
        error: 'RATE_LIMIT',
        message: `Telegram rate limit hit. Retry after ${retryAfter}s`,
        retryAfter
      };
    }
    if (response.status === 409) {
      return {
        ok: false,
        status: 409,
        error: 'CONFLICT',
        message: `Telegram conflict: ${data?.description || 'Webhook conflict'}`
      };
    }

    return {
      ok: false,
      status: response.status,
      message: data?.description || `Telegram error (HTTP ${response.status})`
    };
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

export function createMessagingRouter() {
  const router = express.Router();

  // Start background auto-polling for incoming orders
  startTelegramPolling();

  // ----------------- TELEGRAM ROUTES ----------------- //

  // 1. Telegram Status Check (returns stored status without spamming Telegram)
  router.get('/telegram/status', async (req: Request, res: Response) => {
    const token = getTelegramToken();
    if (!token) {
      return res.json({
        ok: false,
        status: 'disconnected',
        hasToken: false,
        message: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ'
      });
    }

    return res.json({
      ok: store.telegram.status === 'connected',
      status: store.telegram.status,
      hasToken: true,
      bot: store.telegram.botInfo,
      message: store.telegram.statusMessage || 'Telegram status'
    });
  });

  // 2. Telegram Connection Test (validates token explicitly against getMe)
  router.post('/telegram/test', async (req: Request, res: Response) => {
    const { botToken } = req.body || {};
    const candidateRaw = (botToken && typeof botToken === 'string') ? botToken : getTelegramToken();
    const testToken = cleanTelegramToken(candidateRaw);

    if (!testToken) {
      return res.json({
        status: 'disconnected',
        message: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ'
      });
    }

    // Check if user accidentally pasted bot username (@mybot) instead of token
    if (testToken.startsWith('@') || !testToken.includes(':')) {
      return res.json({
        status: 'error',
        error_type: 'format_username',
        message: '⚠️ ထည့်သွင်းထားသည်မှာ Bot Username (@name) ဖြစ်နေပါသည်။ BotFather မှ ပေးသော နံပါတ်နှင့်စသည့် Token (ဥပမာ 123456789:ABCdef...) ကို ထည့်သွင်းပေးပါ'
      });
    }

    if (!isValidTokenFormat(testToken)) {
      return res.json({
        status: 'error',
        error_type: 'format_invalid',
        message: '⚠️ Bot Token ပုံစံ မမှန်ကန်ပါ။ ရှေ့တွင် Bot ID ဂဏန်း ၈ လုံးမှ ၁၁ လုံးနှင့် colon (:) ပါဝင်ရပါမည်'
      });
    }

    // Call getMe directly with the tested token
    try {
      const response = await fetch(`https://api.telegram.org/bot${testToken}/getMe`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok && data.result) {
        const bot: TelegramBotInfo = {
          id: data.result.id,
          username: data.result.username || '',
          firstName: data.result.first_name || '',
          canJoinGroups: data.result.can_join_groups ?? true,
          canReadAllGroupMessages: data.result.can_read_all_group_messages ?? false,
          supportsInlineQueries: data.result.supports_inline_queries ?? false
        };

        // Save token and bot info to server store immediately!
        store.telegram.botToken = testToken;
        store.telegram.status = 'connected';
        store.telegram.connectedAt = new Date().toISOString();
        store.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
        store.telegram.botInfo = bot;
        saveStore();

        // Automatically call deleteWebhook so Long Polling works immediately with zero configuration!
        try {
          await fetch(`https://api.telegram.org/bot${testToken}/deleteWebhook?drop_pending_updates=false`);
        } catch {
          // ignore
        }

        return res.json({
          status: 'connected',
          message: `Telegram Bot [@${bot.username || bot.firstName}] သို့ တရားဝင် အောင်မြင်စွာ ချိတ်ဆက်ထားသည်`,
          bot
        });
      }

      if (response.status === 401 || response.status === 404) {
        return res.json({
          status: 'error',
          error_type: 'unauthorized',
          message: 'Telegram Bot Token မမှန်ကန်ပါ (401 Unauthorized)',
          details: 'Telegram BotFather တွင် /mybots သို့သွား၍ "API Token" -> "Revoke current token" နှိပ်ကာ Token အသစ် ရယူပေးပါ'
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

  // 3. Telegram Config GET (Sanitized, token never returned in raw plaintext)
  router.get('/telegram/config', (req: Request, res: Response) => {
    const token = getTelegramToken();
    res.json({
      hasToken: Boolean(token && token.length > 0),
      maskedToken: maskToken(token),
      channelId: store.telegram.channelId,
      accountName: store.telegram.accountName,
      webhookUrl: store.telegram.webhookUrl,
      status: store.telegram.status,
      statusMessage: store.telegram.statusMessage,
      connectedAt: store.telegram.connectedAt,
      bot: store.telegram.botInfo
    });
  });

  // 4. Telegram Config POST (Saves securely on server)
  router.post('/telegram/config', async (req: Request, res: Response) => {
    const { botToken, channelId, accountName, webhookUrl, clearToken } = req.body || {};

    if (channelId !== undefined) store.telegram.channelId = String(channelId).trim();
    if (accountName !== undefined) store.telegram.accountName = String(accountName).trim();
    if (webhookUrl !== undefined) store.telegram.webhookUrl = String(webhookUrl).trim();

    // Explicit clear requested
    if (clearToken === true) {
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
      delete store.telegram.botInfo;
      saveStore();

      return res.json({
        success: true,
        hasToken: false,
        maskedToken: '',
        status: store.telegram.status,
        statusMessage: store.telegram.statusMessage
      });
    }

    // If a new bot token is provided, clean and verify it
    if (botToken && typeof botToken === 'string' && botToken.trim()) {
      const cleaned = cleanTelegramToken(botToken);
      if (isValidTokenFormat(cleaned)) {
        store.telegram.botToken = cleaned;
        // Verify with getMe
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
          store.telegram.status = 'connected';
          store.telegram.connectedAt = new Date().toISOString();
          store.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
          store.telegram.botInfo = bot;

          // Clear any conflicting webhook so polling works out of the box
          try {
            await fetch(`https://api.telegram.org/bot${cleaned}/deleteWebhook?drop_pending_updates=false`);
          } catch {
            // ignore
          }
        } else {
          store.telegram.status = 'error';
          store.telegram.statusMessage = test.message;
        }
      }
    }

    saveStore();

    const currentToken = getTelegramToken();
    res.json({
      success: true,
      hasToken: Boolean(currentToken && currentToken.length > 0),
      maskedToken: maskToken(currentToken),
      status: store.telegram.status,
      statusMessage: store.telegram.statusMessage,
      connectedAt: store.telegram.connectedAt,
      bot: store.telegram.botInfo
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
    delete store.telegram.botInfo;
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

  // 6. Telegram Delete Webhook (Restores pure Long-Polling)
  router.post('/telegram/delete-webhook', async (req: Request, res: Response) => {
    const result = await callTelegramApi('deleteWebhook', 'POST', { drop_pending_updates: false });
    if (result.ok) {
      store.telegram.webhookUrl = '';
      saveStore();
    }
    return res.json(result);
  });

  // 7. Telegram Webhook Receiver Endpoint
  router.post('/telegram/webhook', (req: Request, res: Response) => {
    // 1. Verify Secret Token Header if configured
    const configuredSecret = getTelegramWebhookSecret();
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];

    if (configuredSecret && incomingSecret) {
      const incomingBuf = Buffer.from(incomingSecret as string);
      const configBuf = Buffer.from(configuredSecret);
      if (incomingBuf.length !== configBuf.length || !crypto.timingSafeEqual(incomingBuf, configBuf)) {
        return res.status(403).json({ error: 'Unauthorized secret token' });
      }
    }

    const update = req.body;
    processTelegramUpdate(update);

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
