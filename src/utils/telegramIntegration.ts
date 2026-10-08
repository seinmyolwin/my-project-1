export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';

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

export interface TelegramAccountConfig {
  botToken: string;
  channelId: string;
  accountName: string;
  webhookUrl: string;
  status: ConnectionStatus;
  statusMessage?: string;
  connectedAt?: string;
  hasServerToken?: boolean;
}

const TELEGRAM_CONFIG_KEY = 'shwe_mingalar_telegram_config';
const TELEGRAM_ORDERS_KEY = 'shwe_mingalar_telegram_orders';

export const DEFAULT_TELEGRAM_CONFIG: TelegramAccountConfig = {
  botToken: '',
  channelId: '@shwemingalar_channel',
  accountName: 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
  webhookUrl: '',
  status: 'disconnected',
  statusMessage: 'Telegram Bot Token သို့မဟုတ် Webhook Endpoint မရှိသေးပါ'
};

export function getTelegramConfig(): TelegramAccountConfig {
  try {
    const raw = localStorage.getItem(TELEGRAM_CONFIG_KEY);
    if (raw) {
      const parsed: TelegramAccountConfig = JSON.parse(raw);
      // Ensure botToken is never stored in plain text in browser
      return {
        ...parsed,
        botToken: parsed.botToken ? '' : ''
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_TELEGRAM_CONFIG;
}

/**
 * Fetch server-side status & configuration for Telegram
 */
export async function syncTelegramConfig(): Promise<TelegramAccountConfig | null> {
  try {
    const res = await fetch('/api/telegram/config', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const current = getTelegramConfig();
      const updated: TelegramAccountConfig = {
        ...current,
        channelId: data.channelId || current.channelId,
        accountName: data.accountName || current.accountName,
        webhookUrl: data.webhookUrl || current.webhookUrl,
        status: data.status || 'disconnected',
        statusMessage: data.statusMessage,
        connectedAt: data.connectedAt,
        hasServerToken: Boolean(data.hasToken)
      };
      saveTelegramConfig(updated);
      return updated;
    }
  } catch {
    // network failure to backend
  }
  return null;
}

/**
 * Test Telegram connection via backend endpoint
 * Tokens NEVER go to api.telegram.org directly from the browser!
 */
export async function testTelegramConnection(botToken: string, webhookUrl: string): Promise<{
  status: ConnectionStatus;
  message: string;
}> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        botToken: botToken.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      return {
        status: data.status || 'disconnected',
        message: data.message || 'Telegram connection response received'
      };
    }

    if (res.status === 401 || res.status === 404) {
      return {
        status: 'error',
        message: 'Telegram Bot Token မမှန်ကန်ပါ (Unauthorized)'
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

/**
 * Save configuration to server-side endpoint and client cache
 * Never stores real botToken in browser localStorage
 */
export function saveTelegramConfig(config: TelegramAccountConfig): void {
  try {
    // Sanitize: client localStorage stores config WITHOUT raw botToken
    const sanitized = {
      ...config,
      botToken: '' // Never store real bot token in localStorage
    };
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore
  }

  // Push secret and configuration securely to backend
  if (config.botToken || config.channelId || config.accountName || config.webhookUrl) {
    fetch('/api/telegram/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        botToken: config.botToken ? config.botToken.trim() : undefined,
        channelId: config.channelId,
        accountName: config.accountName,
        webhookUrl: config.webhookUrl
      })
    }).catch(() => {
      // offline fallback
    });
  }
}

export function getTelegramOrders(): TelegramIncomingOrder[] {
  try {
    const raw = localStorage.getItem(TELEGRAM_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [
    {
      id: 'tg-sample-1',
      senderName: 'ကိုအောင်မျိုး',
      senderPhone: '09-450011223',
      orderType: 'text',
      category: '3d',
      rawText: '123=1000\n456=500\n789R=1000',
      parsedItems: [
        { number: '123', amount: 1000, isRumble: false, originalRaw: '123=1000' },
        { number: '456', amount: 500, isRumble: false, originalRaw: '456=500' },
        { number: '789', amount: 1000, isRumble: true, originalRaw: '789R=1000' }
      ],
      totalAmount: 2500,
      status: 'pending_review',
      timestamp: Date.now() - 3600000,
      notes: 'Telegram Bot မှ အလိုအလျောက် ဝင်ရောက်လာသော အမှာစာ'
    }
  ];
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
    const res = await fetch('/api/telegram/orders', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const orders = await res.json();
      if (Array.isArray(orders) && orders.length > 0) {
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
    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`/api/telegram/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteTelegramOrderOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/telegram/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function generateTelegramConfirmationMessage(senderName: string, totalAmount: number, currency: string = 'Ks'): string {
  return `✅ မင်္ဂလာပါ ${senderName} ခင်ဗျာ။\n\nTelegram Bot မှ လက်ခံရရှိသော ထိုးကြေးစာရင်း စုစုပေါင်း (${totalAmount.toLocaleString()} ${currency}) အား ဒိုင်စာရင်းသို့ အောင်မြင်စွာ အတည်ပြု ထည့်သွင်းပြီးဖြစ်ပါသည်။ ကျေးဇူးတင်ပါသည်။ 🙏`;
}
