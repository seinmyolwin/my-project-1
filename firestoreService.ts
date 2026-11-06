/**
 * Local file storage service for Telegram messaging store & orders.
 * Per project security requirements (B2), bot tokens and orders are stored purely locally
 * in data/messaging_store.json (which is gitignored) and never uploaded to Firestore.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_STORE_FILE = path.join(DATA_DIR, 'messaging_store.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

function getDefaultStore() {
  return {
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
}

export async function loadStoreFromFirestore(): Promise<any> {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data && typeof data === 'object') return data;
    }
  } catch (err) {
    // fallback
  }

  const def = getDefaultStore();
  saveStoreToFirestore(def);
  return def;
}

export async function saveStoreToFirestore(store: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Strip customerPhone from orders before saving (B2 requirement)
    if (store && Array.isArray(store.telegramOrders)) {
      store.telegramOrders = store.telegramOrders.map((o: any) => {
        const { customerPhone, ...rest } = o;
        return rest;
      });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    // ignore
  }
}
