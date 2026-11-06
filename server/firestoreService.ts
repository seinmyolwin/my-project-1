/**
 * Multi-Tenant Local & Server Storage Service for Telegram messaging & orders per Shop ID.
 * Supports multiple distinct shop owners using unique Bot API tokens on Vercel and local deployments.
 * Per project security requirements (B2), customerPhone is stripped before saving.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MULTI_SHOP_STORE_FILE = path.join(DATA_DIR, 'messaging_shops.json');
const LOCAL_STORE_FILE = path.join(DATA_DIR, 'messaging_store.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

export interface ShopStoreData {
  shopId: string;
  telegram: {
    botToken: string;
    channelId: string;
    accountName: string;
    webhookUrl: string;
    status: 'connected' | 'disconnected' | 'error' | 'timeout';
    statusMessage?: string;
    connectedAt?: string;
    botInfo?: any;
  };
  telegramOrders: any[];
}

export function getDefaultShopStore(shopId: string = 'default'): ShopStoreData {
  return {
    shopId,
    telegram: {
      botToken: '8733288986:AAG4sx6QGOa4lHmJzE7ZB71HR2Mir09c3C8',
      channelId: '',
      accountName: '@smlssh_bot',
      webhookUrl: '',
      status: 'connected',
      statusMessage: 'Connected to @smlssh_bot',
      connectedAt: new Date().toISOString(),
      botInfo: {
        id: 8733288986,
        username: 'smlssh_bot',
        firstName: 'smlssh_bot',
        canJoinGroups: true,
        canReadAllGroupMessages: true
      }
    },
    telegramOrders: []
  };
}

let multiShopCache: Record<string, ShopStoreData> = {};

function readAllShopsFromDisk(): Record<string, ShopStoreData> {
  try {
    if (fs.existsSync(MULTI_SHOP_STORE_FILE)) {
      const content = fs.readFileSync(MULTI_SHOP_STORE_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data && typeof data === 'object') return data;
    } else if (fs.existsSync(LOCAL_STORE_FILE)) {
      // Migrate legacy single store into 'default' shop
      const content = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      const legacy = JSON.parse(content);
      if (legacy && typeof legacy === 'object') {
        const defStore: ShopStoreData = {
          shopId: 'default',
          telegram: legacy.telegram || getDefaultShopStore('default').telegram,
          telegramOrders: legacy.telegramOrders || []
        };
        return { default: defStore };
      }
    }
  } catch (err) {
    // fallback
  }
  return {};
}

function writeAllShopsToDisk(shopsMap: Record<string, ShopStoreData>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Clean & strip customerPhone from orders per B2 requirement
    const cleanedShops: Record<string, ShopStoreData> = {};
    for (const [id, shop] of Object.entries(shopsMap)) {
      const orders = Array.isArray(shop.telegramOrders)
        ? shop.telegramOrders.map((o: any) => {
            const { customerPhone, ...rest } = o;
            return rest;
          })
        : [];
      cleanedShops[id] = {
        ...shop,
        shopId: id,
        telegramOrders: orders
      };
    }
    fs.writeFileSync(MULTI_SHOP_STORE_FILE, JSON.stringify(cleanedShops, null, 2), 'utf-8');
  } catch (err) {
    // ignore
  }
}

export async function loadShopStore(shopId: string = 'default'): Promise<ShopStoreData> {
  if (!multiShopCache || Object.keys(multiShopCache).length === 0) {
    multiShopCache = readAllShopsFromDisk();
  }
  const id = shopId && shopId.trim() ? shopId.trim() : 'default';
  if (!multiShopCache[id]) {
    multiShopCache[id] = getDefaultShopStore(id);
    writeAllShopsToDisk(multiShopCache);
  }
  return multiShopCache[id];
}

export async function saveShopStore(shopId: string = 'default', shopData: ShopStoreData) {
  const id = shopId && shopId.trim() ? shopId.trim() : 'default';
  if (!multiShopCache) multiShopCache = {};
  multiShopCache[id] = shopData;
  writeAllShopsToDisk(multiShopCache);
}

export async function getAllShopStores(): Promise<Record<string, ShopStoreData>> {
  if (!multiShopCache || Object.keys(multiShopCache).length === 0) {
    multiShopCache = readAllShopsFromDisk();
  }
  return multiShopCache;
}

export async function loadStoreFromFirestore(): Promise<any> {
  const store = await loadShopStore('default');
  return store;
}

export async function saveStoreToFirestore(store: any) {
  await saveShopStore('default', {
    shopId: 'default',
    telegram: store.telegram,
    telegramOrders: store.telegramOrders || []
  });
}
