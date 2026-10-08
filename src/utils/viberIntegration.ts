import { convertMyanmarToEnglishDigits, getPermutations, formatAmount } from './lotteryUtils';
import { parseSlipImageText } from './imageOcrUtils';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';

export interface ViberAccountConfig {
  botToken: string;
  accountName: string;
  phoneNumber: string;
  webhookUrl: string;
  status: ConnectionStatus;
  statusMessage?: string;
  connectedAt?: string;
  autoReceive: boolean;
  autoReplyConfirmation: boolean;
  hasServerToken?: boolean;
}

export interface ViberParsedBetItem {
  id: string;
  number: string;
  amount: number;
  betType: 'straight' | 'rumble';
  isRumble?: boolean;
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
  parsedItems: ViberParsedBetItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  notes?: string;
  rejectionReason?: string;
  approvedVoucherNo?: string;
  verifiedAt?: string;
}

export const VIBER_STORAGE = {
  CONFIG: 'rhmg_viber_config_v1',
  ORDERS: 'rhmg_viber_orders_v1'
};

export const DEFAULT_VIBER_CONFIG: ViberAccountConfig = {
  botToken: '',
  accountName: 'ရွှေမင်္ဂလာ Viber စာရင်းလက်ခံစနစ်',
  phoneNumber: '09-798889900',
  webhookUrl: '',
  status: 'disconnected',
  statusMessage: 'Viber Bot Token သို့မဟုတ် Webhook Endpoint မရှိသေးပါ',
  autoReceive: true,
  autoReplyConfirmation: true
};

export async function testViberConnection(botToken: string, webhookUrl: string): Promise<{
  status: ConnectionStatus;
  message: string;
}> {
  try {
    const res = await fetch('/api/viber/test', {
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
        message: data.message || 'Viber connection response received'
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        status: 'error',
        message: 'Viber API Key / Token မမှန်ကန်ပါ (Unauthorized)'
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
        message: 'Viber API ချိတ်ဆက်မှု အချိန်လွန်သွားပါသည် (Timeout)'
      };
    }
    return {
      status: 'error',
      message: 'စနစ်ဆာဗာ (Backend) သို့ ချိတ်ဆက်၍ မရပါ'
    };
  }
}

export const INITIAL_SAMPLE_VIBER_ORDERS: ViberIncomingOrder[] = [
  {
    id: 'viber-ord-1',
    senderName: 'ဒေါ်ခင်မျိုးသက်',
    senderPhone: '09-450012345',
    orderType: 'text',
    category: '3d',
    rawText: '853=10000, 358R=2000, 789=5000 ပါရှင့်။ ငွေ KPay လွှဲပြီးပါပြီ',
    receivedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    status: 'pending_review',
    parsedItems: [
      { id: 'item-1', number: '853', amount: 10000, betType: 'straight' },
      { id: 'item-2', number: '358', amount: 2000, betType: 'rumble', isRumble: true },
      { id: 'item-3', number: '789', amount: 5000, betType: 'straight' }
    ],
    subtotal: 17000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 17000,
    notes: 'KPay ငွေလွှဲပြီး'
  },
  {
    id: 'viber-ord-2',
    senderName: 'ကိုအောင်ဇော်',
    senderPhone: '09-790112288',
    orderType: 'text',
    category: '2d',
    rawText: '၂၄=၁၅၀၀၀, ၄၂=၁၅၀၀၀, ၈၂=၂၀၀၀၀, ၅၅=၅၀၀၀',
    receivedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    status: 'pending_review',
    parsedItems: [
      { id: 'item-1', number: '24', amount: 15000, betType: 'straight' },
      { id: 'item-2', number: '42', amount: 15000, betType: 'straight' },
      { id: 'item-3', number: '82', amount: 20000, betType: 'straight' },
      { id: 'item-4', number: '55', amount: 5000, betType: 'straight' }
    ],
    subtotal: 55000,
    discountPercent: 5,
    discountAmount: 2750,
    netPayable: 52250,
    notes: 'Viber Chat မှတိုက်ရိုက်'
  }
];

export function getViberConfig(): ViberAccountConfig {
  try {
    const raw = localStorage.getItem(VIBER_STORAGE.CONFIG);
    if (!raw) return DEFAULT_VIBER_CONFIG;
    const parsed: ViberAccountConfig = JSON.parse(raw);
    return {
      ...parsed,
      botToken: '' // Never restore plain bot token from localStorage
    };
  } catch {
    return DEFAULT_VIBER_CONFIG;
  }
}

/**
 * Sync Viber config from backend server
 */
export async function syncViberConfig(): Promise<ViberAccountConfig | null> {
  try {
    const res = await fetch('/api/viber/config', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const current = getViberConfig();
      const updated: ViberAccountConfig = {
        ...current,
        accountName: data.accountName || current.accountName,
        phoneNumber: data.phoneNumber || current.phoneNumber,
        webhookUrl: data.webhookUrl || current.webhookUrl,
        status: data.status || 'disconnected',
        statusMessage: data.statusMessage,
        connectedAt: data.connectedAt,
        hasServerToken: Boolean(data.hasToken)
      };
      saveViberConfig(updated);
      return updated;
    }
  } catch {
    // network failure to backend
  }
  return null;
}

export function saveViberConfig(config: ViberAccountConfig): void {
  try {
    // Sanitize: client localStorage stores config WITHOUT raw botToken
    const sanitized = {
      ...config,
      botToken: ''
    };
    localStorage.setItem(VIBER_STORAGE.CONFIG, JSON.stringify(sanitized));
  } catch {
    // ignore
  }

  // Push secret and configuration securely to backend
  if (config.botToken || config.accountName || config.phoneNumber || config.webhookUrl) {
    fetch('/api/viber/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        botToken: config.botToken ? config.botToken.trim() : undefined,
        accountName: config.accountName,
        phoneNumber: config.phoneNumber,
        webhookUrl: config.webhookUrl
      })
    }).catch(() => {
      // offline fallback
    });
  }
}

export function getViberOrders(): ViberIncomingOrder[] {
  try {
    const raw = localStorage.getItem(VIBER_STORAGE.ORDERS);
    if (!raw) return INITIAL_SAMPLE_VIBER_ORDERS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_SAMPLE_VIBER_ORDERS;
  }
}

export function saveViberOrders(orders: ViberIncomingOrder[]): void {
  try {
    localStorage.setItem(VIBER_STORAGE.ORDERS, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export async function fetchViberOrdersFromServer(): Promise<ViberIncomingOrder[] | null> {
  try {
    const res = await fetch('/api/viber/orders', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const orders = await res.json();
      if (Array.isArray(orders) && orders.length > 0) {
        saveViberOrders(orders);
        return orders;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function updateViberOrderOnServer(
  id: string,
  updates: {
    status?: 'pending_review' | 'approved' | 'rejected';
    notes?: string;
    rejectionReason?: string;
    approvedVoucherNo?: string;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/viber/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteViberOrderOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/viber/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendViberMessage(receiver: string, text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/viber/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver, text })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Parses raw Viber message text into structured bet items based on category (3D / 2D / Football)
 */
export function parseViberBetText(
  rawText: string,
  category: '3d' | '2d' | 'football' = '3d'
): {
  items: ViberParsedBetItem[];
  subtotal: number;
  detectedCategory: '3d' | '2d' | 'football';
  customerNotes: string;
} {
  const converted = convertMyanmarToEnglishDigits(rawText || '');
  const items: ViberParsedBetItem[] = [];
  let detectedCategory = category;

  // Split by line or common delimiters (, ; / \n +)
  const tokens = converted.split(/[\n,;+\t|]/);
  let notesCollector: string[] = [];

  for (let token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    // Check if token contains non-bet chatter/notes
    if (trimmed.includes('ငွေ') || trimmed.includes('KPay') || trimmed.includes('wave') || trimmed.includes('ရှင်') || trimmed.includes('ပါ')) {
      notesCollector.push(trimmed);
    }

    // Pattern: number + optional R + separator + amount
    // e.g. 123=1000, 123R=500, 123-500, 123:1000, 24/5000, 853 1000
    const match = trimmed.match(/(\d{2,3})\s*(r|R|ပတ်|ခွေ)?\s*[:=\-*\/x\s]\s*(\d+)/i);

    if (match) {
      const num = match[1];
      const isRumble = !!match[2];
      const amt = parseInt(match[3], 10) || 0;

      if (num.length === 2) {
        detectedCategory = '2d';
      } else if (num.length === 3) {
        detectedCategory = '3d';
      }

      if (amt > 0) {
        items.push({
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          betType: isRumble ? 'rumble' : 'straight',
          isRumble
        });
      }
    } else {
      // Check simple 2-digit or 3-digit number amounts like "789 500"
      const parts = trimmed.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && /^\d{2,3}$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
        const num = parts[0];
        const amt = parseInt(parts[1], 10) || 0;
        if (amt > 0) {
          if (num.length === 2) detectedCategory = '2d';
          if (num.length === 3) detectedCategory = '3d';
          items.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            betType: 'straight'
          });
        }
      }
    }
  }

  // Calculate Subtotal (considering permutations for R)
  let subtotal = 0;
  items.forEach(it => {
    if (it.isRumble && it.number.length === 3) {
      const count = getPermutations(it.number).length;
      subtotal += it.amount * count;
    } else {
      subtotal += it.amount;
    }
  });

  return {
    items,
    subtotal,
    detectedCategory,
    customerNotes: notesCollector.join('; ')
  };
}

/**
 * Generates an automated polite Myanmar confirmation text to copy/send back to Viber
 */
export function generateViberConfirmationMessage(
  order: ViberIncomingOrder,
  voucherNo: string,
  appName: string = 'ရွှေမင်္ဂလာ'
): string {
  const is3D = order.category === '3d';
  const is2D = order.category === '2d';
  const categoryTitle = is3D ? 'အိုးစည်လေး' : is2D ? 'ဇီးကွက်' : 'ပစ်တိုင်းထောင်';

  const lines = [
    `✨ 【 ${appName} - ${categoryTitle} စာရင်းအတည်ပြုလွှာ 】 ✨`,
    `👤 လူကြီးမင်းအမည်: ${order.senderName}`,
    `📱 ဖုန်း: ${order.senderPhone}`,
    `🧾 ဘောင်ချာအမှတ်: ${voucherNo}`,
    `⏰ အတည်ပြုချိန်: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `--------------------------------`,
    `📝 ထိုးထားသော ဂဏန်းစာရင်းများ:`
  ];

  order.parsedItems.forEach((it, idx) => {
    const rTag = it.isRumble ? ' (ပတ်လည်)' : '';
    lines.push(` ${idx + 1}. [ ${it.number}${rTag} ] = ${formatAmount(it.amount)} Ks`);
  });

  lines.push(`--------------------------------`);
  lines.push(`💰 စုစုပေါင်း ကျသင့်ငွေ: ${formatAmount(order.netPayable)} Ks`);
  lines.push(`✅ စာရင်းအား အောင်မြင်စွာ အတည်ပြု မှတ်တမ်းတင်ပြီးပါပြီ။ ကံကောင်းပါစေရှင်/ခင်ဗျာ 🙏`);

  return lines.join('\n');
}

/**
 * Generates a polite rejection notice for Viber
 */
export function generateViberRejectionMessage(
  order: ViberIncomingOrder,
  reason: string,
  appName: string = 'ရွှေမင်္ဂလာ'
): string {
  return [
    `⚠️ 【 ${appName} - စာရင်းလက်မခံနိုင်ခြင်း အသိပေးချက် 】`,
    `လူကြီးမင်း ${order.senderName} ၏ အော်ဒါအား အောက်ပါအကြောင်းကြောင့် လက်မခံနိုင်ပါသဖြင့် အနူးအညွတ် တောင်းပန်အပ်ပါသည်-`,
    `အကြောင်းပြချက်: ${reason || 'ဂဏန်းပိတ်ထားခြင်း သို့မဟုတ် ပွဲပိတ်ချိန်လွန်သွားခြင်း'}`,
    `ကျေးဇူးတင်ပါသည် 🙏`
  ].join('\n');
}
