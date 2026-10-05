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
}

const TELEGRAM_CONFIG_KEY = 'shwe_mingalar_telegram_config';
const TELEGRAM_ORDERS_KEY = 'shwe_mingalar_telegram_orders';

export function getTelegramConfig(): TelegramAccountConfig {
  try {
    const raw = localStorage.getItem(TELEGRAM_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    botToken: '',
    channelId: '@shwemingalar_channel',
    accountName: 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့',
    webhookUrl: 'https://telegram.shwemingalar.app/webhook/bot'
  };
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
