export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';

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

export interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
  supportsInlineQueries?: boolean;
}

export interface TelegramAccountConfig {
  shopId?: string;
  botToken: string;
  channelId: string;
  accountName: string;
  webhookUrl: string;
  status: ConnectionStatus;
  statusMessage?: string;
  connectedAt?: string;
  hasServerToken?: boolean;
  botInfo?: TelegramBotInfo;
}

const TELEGRAM_CONFIG_KEY = 'shwe_mingalar_telegram_config';
const TELEGRAM_ORDERS_KEY = 'shwe_mingalar_telegram_orders';
const SHOP_ID_KEY = 'shwe_mingalar_shop_id';
const CHAT_ID_KEY = 'shwe_mingalar_chat_id';

export const DEFAULT_TELEGRAM_CONFIG: TelegramAccountConfig = {
  botToken: '8733288986:AAG4sx6QGOa4lHmJzE7ZB71HR2Mir09c3C8',
  channelId: '',
  accountName: '@smlssh_bot',
  webhookUrl: '',
  status: 'connected',
  statusMessage: 'Connected to @smlssh_bot',
  hasServerToken: true,
  botInfo: {
    id: 8733288986,
    username: 'smlssh_bot',
    firstName: 'smlssh_bot',
    canJoinGroups: true,
    canReadAllGroupMessages: true
  }
};

import { getStoredOwnerPassword } from './securityUtils';

export function getShopId(): string {
  try {
    let id = localStorage.getItem(SHOP_ID_KEY);
    if (!id || !id.trim()) {
      id = 'shop_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(SHOP_ID_KEY, id);
    }
    return id;
  } catch {
    return 'default_shop';
  }
}

export function setShopId(newShopId: string): string {
  try {
    const cleanId = newShopId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (cleanId) {
      localStorage.setItem(SHOP_ID_KEY, cleanId);
      return cleanId;
    }
  } catch {
    // ignore
  }
  return getShopId();
}

export function getPersonalChatId(): string {
  try {
    return localStorage.getItem(CHAT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setPersonalChatId(chatId: string): void {
  try {
    localStorage.setItem(CHAT_ID_KEY, chatId.trim());
  } catch {
    // ignore
  }
}

async function getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  if (forceRefresh) {
    sessionStorage.removeItem('rhmg_server_session_token');
  }
  let token = sessionStorage.getItem('rhmg_server_session_token');
  if (!token) {
    const storedPin = getStoredOwnerPassword();
    if (storedPin) {
      try {
        let res = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: storedPin })
        });
        if (res.status === 409) {
          await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: storedPin })
          });
          res = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: storedPin })
          });
        }
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            token = data.token;
            sessionStorage.setItem('rhmg_server_session_token', token);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const config = getTelegramConfig();
  const currentShopId = getShopId();
  const personalToken = cleanTelegramToken(config.botToken || '');
  const personalChatId = config.channelId || getPersonalChatId();

  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-shop-id': currentShopId,
    ...(personalToken ? { 'x-telegram-bot-token': personalToken } : {}),
    ...(personalChatId ? { 'x-telegram-chat-id': personalChatId } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
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

export function getTelegramConfig(): TelegramAccountConfig {
  try {
    const raw = localStorage.getItem(TELEGRAM_CONFIG_KEY);
    if (raw) {
      const parsed: TelegramAccountConfig = JSON.parse(raw);
      return {
        ...parsed,
        shopId: parsed.shopId || getShopId(),
        channelId: parsed.channelId || getPersonalChatId(),
        botToken: cleanTelegramToken(parsed.botToken || '')
      };
    }
  } catch {
    // ignore
  }
  return {
    ...DEFAULT_TELEGRAM_CONFIG,
    shopId: getShopId(),
    channelId: getPersonalChatId()
  };
}

export async function syncTelegramConfig(): Promise<TelegramAccountConfig | null> {
  try {
    let headers = await getAuthHeaders();
    let res = await fetch('/api/telegram/config', {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (res.status === 401) {
      headers = await getAuthHeaders(true);
      res = await fetch('/api/telegram/config', {
        headers,
        signal: AbortSignal.timeout(5000)
      });
    }
    if (res.ok) {
      const data = await res.json();
      const current = getTelegramConfig();

      const updated: TelegramAccountConfig = {
        ...current,
        shopId: data.shopId || getShopId(),
        channelId: current.channelId || data.channelId || getPersonalChatId(),
        accountName: data.accountName ?? current.accountName,
        webhookUrl: data.webhookUrl ?? current.webhookUrl,
        status: current.botToken && isValidTokenFormat(current.botToken) ? 'connected' : (data.status || current.status || 'disconnected'),
        statusMessage: data.statusMessage || current.statusMessage,
        connectedAt: data.connectedAt || current.connectedAt,
        hasServerToken: Boolean(data.hasToken || current.botToken),
        botInfo: data.bot || current.botInfo
      };

      try {
        localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }

      return updated;
    }
  } catch {
    // network failure to backend
  }
  return getTelegramConfig();
}

export async function testTelegramConnection(candidateToken: string, webhookUrl?: string): Promise<{
  status: ConnectionStatus;
  message: string;
  bot?: TelegramBotInfo;
  errorType?: string;
  details?: string;
}> {
  const cleaned = cleanTelegramToken(candidateToken);

  if (cleaned.startsWith('@') || (!cleaned.includes(':') && cleaned.length > 0)) {
    return {
      status: 'error',
      errorType: 'format_username',
      message: '⚠️ ထည့်သွင်းထားသည်မှာ Bot Username (@name) ဖြစ်နေပါသည်။ BotFather မှ ပေးသော နံပါတ်နှင့်စသည့် Token (ဥပမာ 123456789:ABCdef...) ကို ထည့်ပေးပါ'
    };
  }

  if (cleaned && !isValidTokenFormat(cleaned)) {
    return {
      status: 'error',
      errorType: 'format_invalid',
      message: '⚠️ Bot Token ပုံစံ မမှန်ကန်ပါ။ ရှေ့တွင် Bot ID ဂဏန်း ၈ လုံးမှ ၁၁ လုံးနှင့် colon (:) ပါဝင်ရပါမည်'
    };
  }

  // 1. Try Direct Telegram API verification from client browser using personal token
  if (cleaned) {
    try {
      const directRes = await fetch(`https://api.telegram.org/bot${cleaned}/getMe`, {
        signal: AbortSignal.timeout(6000)
      });
      if (directRes.ok) {
        const data = await directRes.json();
        if (data && data.ok && data.result) {
          const bot: TelegramBotInfo = {
            id: data.result.id,
            username: data.result.username || '',
            firstName: data.result.first_name || '',
            canJoinGroups: data.result.can_join_groups ?? true,
            canReadAllGroupMessages: data.result.can_read_all_group_messages ?? false,
            supportsInlineQueries: data.result.supports_inline_queries ?? false
          };
          return {
            status: 'connected',
            message: `Telegram Connection Successful (@${bot.username || bot.firstName}) [Verified via Local Keys]`,
            bot
          };
        }
      }
    } catch {
      // fallback to backend test proxy
    }
  }

  // 2. Fallback to backend test API signed with client headers
  try {
    const headers = await getAuthHeaders();
    if (cleaned) headers['x-telegram-bot-token'] = cleaned;

    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        botToken: cleaned || undefined,
        webhookUrl: webhookUrl?.trim() || undefined
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      return {
        status: data.status || 'disconnected',
        message: data.message || 'Telegram connection response received',
        bot: data.bot,
        errorType: data.error_type,
        details: data.details
      };
    }

    if (res.status === 401 || res.status === 404) {
      return {
        status: 'error',
        errorType: 'unauthorized',
        message: 'Telegram Bot Token မမှန်ကန်ပါ (401 Unauthorized)',
        details: 'BotFather (/mybots -> API Token -> Revoke) တွင် Token အသစ် ရယူပေးပါ'
      };
    }

    return {
      status: 'error',
      message: `ဆာဗာမှ အမှားတုံ့ပြန်ချက် ရရှိပါသည် (HTTP ${res.status})`
    };
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return {
        status: 'timeout',
        message: 'Telegram API စစ်ဆေးမှု အချိန်လွန်သွားပါသည် (Timeout)'
      };
    }
    return {
      status: 'error',
      message: 'စနစ်ဆာဗာ (Backend) သို့ ချိတ်ဆက်၍ မရပါ'
    };
  }
}

export async function saveTelegramConfig(config: TelegramAccountConfig): Promise<void> {
  const cleanedToken = cleanTelegramToken(config.botToken);

  const toSave: TelegramAccountConfig = {
    ...config,
    shopId: config.shopId || getShopId(),
    botToken: cleanedToken
  };

  if (config.channelId) {
    setPersonalChatId(config.channelId);
  }

  try {
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }

  const headers = await getAuthHeaders();
  if (cleanedToken) headers['x-telegram-bot-token'] = cleanedToken;
  if (config.channelId) headers['x-telegram-chat-id'] = config.channelId;

  fetch('/api/telegram/config', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      botToken: cleanedToken || undefined,
      channelId: config.channelId,
      accountName: config.accountName,
      webhookUrl: config.webhookUrl
    })
  }).catch(() => {});
}

export async function clearTelegramToken(): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders();
    await fetch('/api/telegram/clear-token', {
      method: 'POST',
      headers
    });

    const current = getTelegramConfig();
    const updated: TelegramAccountConfig = {
      ...current,
      botToken: '',
      channelId: '',
      webhookUrl: '',
      status: 'disconnected',
      statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)',
      hasServerToken: false,
      botInfo: undefined
    };
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(updated));
    localStorage.removeItem(CHAT_ID_KEY);

    return { success: true, message: 'Telegram Bot Token ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ' };
  } catch (err: any) {
    console.error('Failed to clear telegram token:', err);
  }
  return { success: true, message: 'Telegram Bot Token ကို ဖျက်ပြီးပါပြီ' };
}

export async function deleteTelegramWebhook(): Promise<{ ok: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/telegram/delete-webhook', {
      method: 'POST',
      headers
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, message: 'Webhook ကို ဖျက်သိမ်းပြီး Polling စနစ်ဖြင့် တိုက်ရိုက် ရယူပါမည်' };
    }
    return { ok: false, message: data?.description || 'Webhook delete failed' };
  } catch {
    return { ok: false, message: 'Server connection failed' };
  }
}

export function getTelegramOrders(): TelegramIncomingOrder[] {
  try {
    const raw = localStorage.getItem(TELEGRAM_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveTelegramOrders(orders: TelegramIncomingOrder[]): void {
  try {
    localStorage.setItem(TELEGRAM_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export async function fetchTelegramOrdersFromServer(): Promise<TelegramIncomingOrder[] | null> {
  try {
    let headers = await getAuthHeaders();
    let res = await fetch('/api/telegram/orders', {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (res.status === 401) {
      headers = await getAuthHeaders(true);
      res = await fetch('/api/telegram/orders', {
        headers,
        signal: AbortSignal.timeout(5000)
      });
    }
    if (res.ok) {
      const orders = await res.json();
      if (Array.isArray(orders)) {
        saveTelegramOrders(orders);
        return orders;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  tokenOverride?: string
): Promise<boolean> {
  const config = getTelegramConfig();
  const tokenToUse = cleanTelegramToken(tokenOverride || config.botToken || '');
  const targetChat = chatId || config.channelId || getPersonalChatId();

  // 1. Direct Telegram API call signed with user's local token
  if (tokenToUse && targetChat) {
    try {
      const directRes = await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: String(text),
          parse_mode: 'HTML'
        })
      });
      if (directRes.ok) {
        const data = await directRes.json();
        if (data && data.ok) return true;
      }
    } catch {
      // Direct call fallback to backend
    }
  }

  // 2. Backend proxy call with signed client headers
  try {
    const headers = await getAuthHeaders();
    if (tokenToUse) headers['x-telegram-bot-token'] = tokenToUse;
    if (targetChat) headers['x-telegram-chat-id'] = String(targetChat);

    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId: targetChat, text })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateTelegramOrderOnServer(
  id: string,
  updates: { status?: 'pending_review' | 'approved' | 'rejected'; notes?: string; parsedItems?: any[]; totalAmount?: number }
): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/telegram/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteTelegramOrderOnServer(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/telegram/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function registerTelegramWebhook(webhookUrl?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/telegram/set-webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify({ webhookUrl: webhookUrl?.trim() || undefined }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, message: data.message || 'Telegram Server သို့ Webhook အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ!' };
    }
    return {
      ok: false,
      message: data?.message || `Webhook ချိတ်ဆက်မှု မအောင်မြင်ပါ (HTTP ${res.status})`
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.name === 'AbortError' ? 'ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)' : 'ဆာဗာသို့ ချိတ်ဆက်၍ မရပါ'
    };
  }
}

export function generateTelegramConfirmationMessage(senderName: string, totalAmount: number, currency: string = 'Ks'): string {
  return `မင်္ဂလာပါ ${senderName} ခင်ဗျာ။\n\nလက်ခံရရှိသော ထိုးကြေးစာရင်း စုစုပေါင်း (${totalAmount.toLocaleString()} ${currency}) အား စာရင်းသို့ အောင်မြင်စွာ အတည်ပြု ထည့်သွင်းပြီးဖြစ်ပါသည်။ ကျေးဇူးတင်ပါသည်။`;
}
