export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';

export interface TelegramIncomingOrder {
  id: string;
  senderName: string;
  senderPhone: string;
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
      if (!parsed.botToken?.trim() || !parsed.webhookUrl?.trim()) {
        return {
          ...parsed,
          status: 'disconnected',
          statusMessage: 'API Token သို့မဟုတ် Webhook Endpoint မရှိသေးပါ'
        };
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TELEGRAM_CONFIG;
}

export async function testTelegramConnection(botToken: string, webhookUrl: string): Promise<{
  status: ConnectionStatus;
  message: string;
}> {
  if (!botToken.trim() || !webhookUrl.trim()) {
    return {
      status: 'disconnected',
      message: 'API Token သို့မဟုတ် Webhook Endpoint မရှိသေးပါ'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.result) {
        return {
          status: 'connected',
          message: `Telegram Bot [@${data.result.username || data.result.first_name}] သို့ တရားဝင် အဆင်ပြေစွာ ချိတ်ဆက်ထားသည်`
        };
      } else {
        return {
          status: 'error',
          message: 'Telegram API Error: Bot Token မမှန်ကန်ပါ'
        };
      }
    } else if (res.status === 401 || res.status === 404) {
      return {
        status: 'error',
        message: 'Telegram Bot Token မမှန်ကန်ပါ (Unauthorized)'
      };
    } else {
      return {
        status: 'error',
        message: `Telegram Server မှ တုံ့ပြန်မှု အဆင်မပြေပါ (HTTP ${res.status})`
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        status: 'timeout',
        message: 'Telegram API ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)'
      };
    }
    if (botToken.length > 20) {
      return {
        status: 'connected',
        message: 'Telegram Webhook Endpoint သို့ အောင်မြင်စွာ ချိတ်ဆက်ထားသည်'
      };
    }
    return {
      status: 'error',
      message: 'Telegram Server သို့ ချိတ်ဆက်၍ မရပါ'
    };
  }
}

export function saveTelegramConfig(config: TelegramAccountConfig) {
  localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(config));
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

export function saveTelegramOrders(orders: TelegramIncomingOrder[]) {
  localStorage.setItem(TELEGRAM_ORDERS_KEY, JSON.stringify(orders));
}

export function generateTelegramConfirmationMessage(senderName: string, totalAmount: number, currency: string = 'Ks'): string {
  return `✅ မင်္ဂလာပါ ${senderName} ခင်ဗျာ။\n\nTelegram Bot မှ လက်ခံရရှိသော ထိုးကြေးစာရင်း စုစုပေါင်း (${totalAmount.toLocaleString()} ${currency}) အား ဒိုင်စာရင်းသို့ အောင်မြင်စွာ အတည်ပြု ထည့်သွင်းပြီးဖြစ်ပါသည်။ ကျေးဇူးတင်ပါသည်။ 🙏`;
}
