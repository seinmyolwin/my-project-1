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

export const DEFAULT_TELEGRAM_CONFIG: TelegramAccountConfig = {
  botToken: '',
  channelId: '',
  accountName: '',
  webhookUrl: '',
  status: 'disconnected',
  statusMessage: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ',
  hasServerToken: false
};

import { getStoredOwnerPassword } from './securityUtils';

async function getAuthHeaders(): Promise<Record<string, string>> {
  let token = sessionStorage.getItem('rhmg_server_session_token');
  if (!token) {
    const storedPin = getStoredOwnerPassword();
    if (storedPin) {
      try {
        const res = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: storedPin })
        });
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
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
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
  const match = cleaned.match(/(\d{7,12}:[A-Za-z0-9_-]{25,50})/);
  if (match) return match[1];
  cleaned = cleaned.replace(/^['"`<([{\s]+|['"`>)\]}\s]+$/g, '').trim();
  return cleaned;
}

export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;
  return /^\d{7,12}:[A-Za-z0-9_-]{25,50}$/.test(token);
}

export function getTelegramConfig(): TelegramAccountConfig {
  try {
    const raw = localStorage.getItem(TELEGRAM_CONFIG_KEY);
    if (raw) {
      const parsed: TelegramAccountConfig = JSON.parse(raw);
      return {
        ...parsed,
        botToken: cleanTelegramToken(parsed.botToken || '')
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_TELEGRAM_CONFIG;
}

export async function syncTelegramConfig(): Promise<TelegramAccountConfig | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/telegram/config', {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const current = getTelegramConfig();

      const updated: TelegramAccountConfig = {
        ...current,
        channelId: data.channelId ?? current.channelId,
        accountName: data.accountName ?? current.accountName,
        webhookUrl: data.webhookUrl ?? current.webhookUrl,
        status: data.status || current.status || 'disconnected',
        statusMessage: data.statusMessage || current.statusMessage,
        connectedAt: data.connectedAt || current.connectedAt,
        hasServerToken: Boolean(data.hasToken),
        botInfo: data.bot || current.botInfo
      };

      if (!data.hasToken && current.botToken && isValidTokenFormat(current.botToken)) {
        const postHeaders = await getAuthHeaders();
        fetch('/api/telegram/config', {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({
            botToken: current.botToken,
            channelId: current.channelId,
            accountName: current.accountName,
            webhookUrl: current.webhookUrl
          })
        }).catch(() => {});
      }

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
  return null;
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

  try {
    const headers = await getAuthHeaders();
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
    botToken: cleanedToken
  };

  try {
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }

  const headers = await getAuthHeaders();
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
      webhookUrl: '',
      status: 'disconnected',
      statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)',
      hasServerToken: false,
      botInfo: undefined
    };
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(updated));

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
    const headers = await getAuthHeaders();
    const res = await fetch('/api/telegram/orders', {
      headers,
      signal: AbortSignal.timeout(5000)
    });
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

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId, text })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateTelegramOrderOnServer(
  id: string,
  updates: { status?: 'pending_review' | 'approved' | 'rejected'; notes?: string }
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
  return `✅ မင်္ဂလာပါ ${senderName} ခင်ဗျာ။\n\nTelegram Bot မှ လက်ခံရရှိသော ထိုးကြေးစာရင်း စုစုပေါင်း (${totalAmount.toLocaleString()} ${currency}) အား ဒိုင်စာရင်းသို့ အောင်မြင်စွာ အတည်ပြု ထည့်သွင်းပြီးဖြစ်ပါသည်။ ကျေးဇူးတင်ပါသည်။ 🙏`;
}
