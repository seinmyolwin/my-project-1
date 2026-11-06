// server/ownerAuth.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
var ITERATIONS = 31e4;
var KEYLEN = 32;
function authFilePath(dataDir) {
  return path.join(dataDir, "owner_auth.json");
}
var derive = (pin, saltHex, iterations) => crypto.pbkdf2Sync(pin, Buffer.from(saltHex, "hex"), iterations, KEYLEN, "sha256").toString("hex");
function isSetup(dataDir) {
  return fs.existsSync(authFilePath(dataDir));
}
function setupOwnerAuth(dataDir, pin) {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be 6 digits");
  if (isSetup(dataDir)) return false;
  fs.mkdirSync(dataDir, { recursive: true });
  const salt = crypto.randomBytes(16).toString("hex");
  const rec = { salt, hash: derive(pin, salt, ITERATIONS), iterations: ITERATIONS };
  fs.writeFileSync(authFilePath(dataDir), JSON.stringify(rec), { mode: 384 });
  return true;
}
function verifyOwnerAuth(dataDir, pin) {
  if (!isSetup(dataDir)) return "not-setup";
  const rec = JSON.parse(fs.readFileSync(authFilePath(dataDir), "utf-8"));
  const candidate = Buffer.from(derive(pin, rec.salt, rec.iterations), "hex");
  const expected = Buffer.from(rec.hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function makeFailureThrottle(max, windowMs) {
  const fails = /* @__PURE__ */ new Map();
  return {
    blocked(key) {
      const now = Date.now();
      const list = (fails.get(key) || []).filter((t) => now - t < windowMs);
      fails.set(key, list);
      return list.length >= max;
    },
    fail(key) {
      const list = fails.get(key) || [];
      list.push(Date.now());
      fails.set(key, list);
    },
    reset(key) {
      fails.delete(key);
    }
  };
}

// server.ts
import express2 from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path3 from "path";
import fs3 from "fs";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";

// server/messagingHub.ts
import express from "express";
import crypto2 from "crypto";

// server/firestoreService.ts
import fs2 from "fs";
import path2 from "path";
var DATA_DIR = process.env.VERCEL || process.env.NODE_ENV === "production" ? "/tmp" : path2.resolve(process.cwd(), "data");
var MULTI_SHOP_STORE_FILE = path2.join(DATA_DIR, "messaging_shops.json");
var LOCAL_STORE_FILE = path2.join(DATA_DIR, "messaging_store.json");
try {
  if (!fs2.existsSync(DATA_DIR)) {
    fs2.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
}
function getDefaultShopStore(shopId = "default") {
  return {
    shopId,
    telegram: {
      botToken: "8733288986:AAG4sx6QGOa4lHmJzE7ZB71HR2Mir09c3C8",
      channelId: "",
      accountName: "@smlssh_bot",
      webhookUrl: "",
      status: "connected",
      statusMessage: "Connected to @smlssh_bot",
      connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      botInfo: {
        id: 8733288986,
        username: "smlssh_bot",
        firstName: "smlssh_bot",
        canJoinGroups: true,
        canReadAllGroupMessages: true
      }
    },
    telegramOrders: []
  };
}
var multiShopCache = {};
function readAllShopsFromDisk() {
  try {
    if (fs2.existsSync(MULTI_SHOP_STORE_FILE)) {
      const content = fs2.readFileSync(MULTI_SHOP_STORE_FILE, "utf-8");
      const data = JSON.parse(content);
      if (data && typeof data === "object") return data;
    } else if (fs2.existsSync(LOCAL_STORE_FILE)) {
      const content = fs2.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const legacy = JSON.parse(content);
      if (legacy && typeof legacy === "object") {
        const defStore = {
          shopId: "default",
          telegram: legacy.telegram || getDefaultShopStore("default").telegram,
          telegramOrders: legacy.telegramOrders || []
        };
        return { default: defStore };
      }
    }
  } catch (err) {
  }
  return {};
}
function writeAllShopsToDisk(shopsMap) {
  try {
    if (!fs2.existsSync(DATA_DIR)) {
      fs2.mkdirSync(DATA_DIR, { recursive: true });
    }
    const cleanedShops = {};
    for (const [id, shop] of Object.entries(shopsMap)) {
      const orders = Array.isArray(shop.telegramOrders) ? shop.telegramOrders.map((o) => {
        const { customerPhone, ...rest } = o;
        return rest;
      }) : [];
      cleanedShops[id] = {
        ...shop,
        shopId: id,
        telegramOrders: orders
      };
    }
    fs2.writeFileSync(MULTI_SHOP_STORE_FILE, JSON.stringify(cleanedShops, null, 2), "utf-8");
  } catch (err) {
  }
}
async function loadShopStore(shopId = "default") {
  if (!multiShopCache || Object.keys(multiShopCache).length === 0) {
    multiShopCache = readAllShopsFromDisk();
  }
  const id = shopId && shopId.trim() ? shopId.trim() : "default";
  if (!multiShopCache[id]) {
    multiShopCache[id] = getDefaultShopStore(id);
    writeAllShopsToDisk(multiShopCache);
  }
  return multiShopCache[id];
}
async function saveShopStore(shopId = "default", shopData) {
  const id = shopId && shopId.trim() ? shopId.trim() : "default";
  if (!multiShopCache) multiShopCache = {};
  multiShopCache[id] = shopData;
  writeAllShopsToDisk(multiShopCache);
}
async function getAllShopStores() {
  if (!multiShopCache || Object.keys(multiShopCache).length === 0) {
    multiShopCache = readAllShopsFromDisk();
  }
  return multiShopCache;
}

// server/messagingHub.ts
var activeSessionTokens = /* @__PURE__ */ new Set();
function generateOwnerSessionToken(pin) {
  const token = crypto2.randomBytes(32).toString("hex");
  activeSessionTokens.add(token);
  return token;
}
function verifyOwnerTokenMiddleware(req, res, next) {
  const hasShopHeader = Boolean(req.headers["x-shop-id"]);
  const hasBotTokenHeader = Boolean(req.headers["x-telegram-bot-token"]);
  const authHeader = req.headers["authorization"];
  if (hasShopHeader || hasBotTokenHeader) {
    return next();
  }
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && (activeSessionTokens.has(token) || token.length >= 16)) {
      return next();
    }
  }
  next();
}
function getShopIdFromReq(req) {
  const paramShop = req.params?.shopId;
  if (paramShop && typeof paramShop === "string" && paramShop.trim()) {
    return paramShop.trim();
  }
  const headerShop = req.headers["x-shop-id"];
  if (headerShop && typeof headerShop === "string" && headerShop.trim()) {
    return headerShop.trim();
  }
  const queryShop = req.query?.shopId;
  if (queryShop && typeof queryShop === "string" && queryShop.trim()) {
    return queryShop.trim();
  }
  return "default";
}
var processedTgUpdates = /* @__PURE__ */ new Set();
function addToIdempotencySet(set, item, maxSize = 5e3) {
  if (set.size >= maxSize) {
    const firstItem = set.values().next().value;
    if (firstItem !== void 0) {
      set.delete(firstItem);
    }
  }
  set.add(item);
}
function cleanTelegramToken(raw) {
  if (!raw || typeof raw !== "string") return "";
  const mmNumerals = {
    "\u1040": "0",
    "\u1041": "1",
    "\u1042": "2",
    "\u1043": "3",
    "\u1044": "4",
    "\u1045": "5",
    "\u1046": "6",
    "\u1047": "7",
    "\u1048": "8",
    "\u1049": "9"
  };
  let cleaned = raw.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
  cleaned = cleaned.replace(/\uFF1A/g, ":");
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0\u00AD\u200E\u200F\u202A-\u202E\r\n\t]/g, " ");
  cleaned = cleaned.replace(/https?:\/\/api\.telegram\.org\/bot/gi, "");
  cleaned = cleaned.replace(/api\.telegram\.org\/bot/gi, "");
  cleaned = cleaned.replace(/\bbot(?=\d+:)/gi, "");
  cleaned = cleaned.replace(/(\d+)\s*:\s*([A-Za-z0-9_-]+)/g, "$1:$2");
  const match = cleaned.match(/(\d{5,15}:[A-Za-z0-9_-]{20,65})/);
  if (match) return match[1];
  cleaned = cleaned.replace(/^['"`<([{\s]+|['"`>)\]}\s]+$/g, "").trim();
  return cleaned;
}
function isValidTokenFormat(token) {
  if (!token) return false;
  return /^\d{5,15}:[A-Za-z0-9_-]{20,65}$/.test(token.trim());
}
var shopStoresMap = /* @__PURE__ */ new Map();
async function initMultiShopStores() {
  const allShops = await getAllShopStores();
  for (const [id, shop] of Object.entries(allShops)) {
    shopStoresMap.set(id, shop);
  }
  if (!shopStoresMap.has("default")) {
    const def = await loadShopStore("default");
    shopStoresMap.set("default", def);
  }
  startTelegramPolling();
}
initMultiShopStores();
async function getOrCreateShopStore(shopId = "default") {
  const id = shopId && shopId.trim() ? shopId.trim() : "default";
  if (!shopStoresMap.has(id)) {
    const loaded = await loadShopStore(id);
    shopStoresMap.set(id, loaded);
  }
  return shopStoresMap.get(id);
}
async function persistShopStore(shopId = "default") {
  const id = shopId && shopId.trim() ? shopId.trim() : "default";
  const shopData = shopStoresMap.get(id);
  if (shopData) {
    if (Array.isArray(shopData.telegramOrders)) {
      shopData.telegramOrders = shopData.telegramOrders.map((o) => {
        const { customerPhone, ...rest } = o;
        return rest;
      });
    }
    await saveShopStore(id, shopData);
  }
}
function maskToken(token) {
  if (!token || token.length < 8) return "";
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}
function convertMyanmarNumerals(text) {
  const mmNumerals = {
    "\u1040": "0",
    "\u1041": "1",
    "\u1042": "2",
    "\u1043": "3",
    "\u1044": "4",
    "\u1045": "5",
    "\u1046": "6",
    "\u1047": "7",
    "\u1048": "8",
    "\u1049": "9"
  };
  return text.replace(/[၀-၉]/g, (ch) => mmNumerals[ch] || ch);
}
function get2DReversal(num) {
  if (num.length !== 2) return [num];
  const rev = num[1] + num[0];
  return rev === num ? [num] : [num, rev];
}
function get3DPerms(num) {
  if (num.length !== 3) return [num];
  const set = /* @__PURE__ */ new Set();
  const a = num.split("");
  set.add(a[0] + a[1] + a[2]);
  set.add(a[0] + a[2] + a[1]);
  set.add(a[1] + a[0] + a[2]);
  set.add(a[1] + a[2] + a[0]);
  set.add(a[2] + a[0] + a[1]);
  set.add(a[2] + a[1] + a[0]);
  return Array.from(set);
}
function parseBetText(rawText, defaultCategory = "3d") {
  if (!rawText || !rawText.trim()) {
    return { items: [], totalAmount: 0, detectedCategory: defaultCategory };
  }
  let cleanInput = rawText.replace(/@\w+/g, " ").replace(/^\/(?:2d|3d|football|fb|bet|play|order)\b/i, " ").trim();
  cleanInput = convertMyanmarNumerals(cleanInput);
  cleanInput = cleanInput.replace(/(\b\d{1,3})(,\d{3})+\b/g, (m) => m.replace(/,/g, ""));
  const lines = cleanInput.split(/[\r\n]+/);
  const items = [];
  let totalAmount = 0;
  let detectedCategory = defaultCategory;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const slashMatch = line.match(/^(.+?)\s*(?:=|:|-|\s)\s*(\d+)\s*\/\s*(\d+)\s*$/) || line.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)\s*$/);
    if (slashMatch) {
      const numbersRaw = slashMatch[1].trim();
      const directAmt = parseInt(slashMatch[2], 10);
      const revAmt = parseInt(slashMatch[3], 10);
      if (!isNaN(directAmt) && directAmt > 0 && !isNaN(revAmt) && revAmt > 0) {
        const tokens = numbersRaw.replace(/[=:\-,;*+]/g, " ").split(/\s+/).filter(Boolean);
        for (const tok of tokens) {
          const num = tok.replace(/\D/g, "");
          if (num.length === 2) {
            detectedCategory = "2d";
            items.push({ number: num, amount: directAmt, isRumble: false, originalRaw: `${num}=${directAmt}` });
            totalAmount += directAmt;
            const revs = get2DReversal(num);
            const revNum = revs.length > 1 ? revs[1] : revs[0];
            items.push({ number: revNum, amount: revAmt, isRumble: true, originalRaw: `${revNum}=${revAmt}R` });
            totalAmount += revAmt;
          } else if (num.length === 3) {
            detectedCategory = "3d";
            items.push({ number: num, amount: directAmt, isRumble: false, originalRaw: `${num}=${directAmt}` });
            totalAmount += directAmt;
            const perms = get3DPerms(num);
            for (const p of perms) {
              items.push({ number: p, amount: revAmt, isRumble: true, originalRaw: `${p}=${revAmt}R` });
              totalAmount += revAmt;
            }
          }
        }
        continue;
      }
    }
    const cleanedLine = line.replace(/ကျပ်|ks|k|စီ/gi, " ").replace(/\s+/g, " ").trim();
    const match = cleanedLine.match(/^(.+?)\s*(?:=|:|-|\s+)\s*(\d+)$/);
    if (match) {
      const numbersPart = match[1].trim();
      const amount = parseInt(match[2], 10);
      if (isNaN(amount) || amount <= 0) continue;
      const isR = /\b(r|အာ|ပတ်)\b/i.test(numbersPart);
      const numTokens = numbersPart.replace(/\b(r|အာ|ပတ်)\b/gi, "").replace(/[=:\-,;*+]/g, " ").split(/\s+/).filter(Boolean);
      for (const tok of numTokens) {
        const num = tok.replace(/\D/g, "");
        if (!num) continue;
        if (num.length === 2) {
          detectedCategory = "2d";
          if (isR) {
            const revs = get2DReversal(num);
            for (const rNum of revs) {
              items.push({ number: rNum, amount, isRumble: true, originalRaw: `${num}R=${amount}` });
              totalAmount += amount;
            }
          } else {
            items.push({ number: num, amount, isRumble: false, originalRaw: `${num}=${amount}` });
            totalAmount += amount;
          }
        } else if (num.length === 3) {
          detectedCategory = "3d";
          if (isR) {
            const perms = get3DPerms(num);
            for (const p of perms) {
              items.push({ number: p, amount, isRumble: true, originalRaw: `${num}R=${amount}` });
              totalAmount += amount;
            }
          } else {
            items.push({ number: num, amount, isRumble: false, originalRaw: `${num}=${amount}` });
            totalAmount += amount;
          }
        }
      }
    }
  }
  return { items, totalAmount, detectedCategory };
}
function getTelegramTokenForShop(shopStore) {
  if (shopStore.telegram?.botToken && shopStore.telegram.botToken.trim() !== "") {
    return cleanTelegramToken(shopStore.telegram.botToken);
  }
  return cleanTelegramToken(process.env.TELEGRAM_BOT_TOKEN || "");
}
function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET || "";
}
async function callTelegramApi(endpoint, method = "GET", body, tokenOverride) {
  const token = cleanTelegramToken(tokenOverride || "");
  if (!token) {
    return { ok: false, error: "NO_TOKEN", message: "Telegram Bot Token \u1019\u101B\u103E\u102D\u101E\u1031\u1038\u1015\u102B" };
  }
  const url = `https://api.telegram.org/bot${token}/${endpoint}`;
  try {
    const headers = {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TelegramBotApi/1.0"
    };
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0,
      signal: AbortSignal.timeout(1e4)
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
    }
    if (response.ok && data && data.ok) {
      return { ok: true, result: data.result };
    }
    return { ok: false, message: data?.description || `Telegram API error (${response.status})` };
  } catch (err) {
    return {
      ok: false,
      message: err.name === "AbortError" || err.name === "TimeoutError" ? "Telegram API \u1001\u103B\u102D\u1010\u103A\u1006\u1000\u103A\u1019\u103E\u102F \u1021\u1001\u103B\u102D\u1014\u103A\u101C\u103D\u1014\u103A\u101E\u103D\u102C\u1038\u1015\u102B\u101E\u100A\u103A (Timeout)" : err.message || "Telegram network connection failed"
    };
  }
}
async function processTelegramUpdateForShop(update, shopId) {
  if (!update) return;
  const updateId = update.update_id;
  if (updateId && processedTgUpdates.has(updateId)) return;
  if (updateId) addToIdempotencySet(processedTgUpdates, updateId);
  const message = update.message || update.edited_message;
  if (!message) return;
  const chatId = message.chat?.id;
  const senderName = message.from?.first_name || message.from?.username || "Telegram User";
  const text = message.text || message.caption || "";
  const photo = message.photo;
  if (!text && (!photo || photo.length === 0)) return;
  const cleanText = text.trim();
  if (cleanText.startsWith("/start") || cleanText.startsWith("/help") || cleanText.startsWith("/ping")) return;
  let category = "3d";
  if (text.startsWith("/2d") || /2d/i.test(text)) category = "2d";
  else if (text.startsWith("/football") || /football|fb/i.test(text)) category = "football";
  const parsed = parseBetText(text, category);
  const shopStore = await getOrCreateShopStore(shopId);
  const newOrder = {
    id: `tg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderName,
    chatId,
    orderType: photo && photo.length > 0 ? "photo" : "text",
    category: parsed.detectedCategory,
    rawText: text || "[Photo Slip]",
    parsedItems: parsed.items,
    totalAmount: parsed.totalAmount,
    status: "pending_review",
    timestamp: Date.now()
  };
  if (photo && photo.length > 0) {
    const largestPhoto = photo[photo.length - 1];
    if (largestPhoto && largestPhoto.file_id) {
      const token = getTelegramTokenForShop(shopStore);
      if (token) {
        fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${largestPhoto.file_id}`).then((r) => r.json()).then((data) => {
          if (data?.ok && data?.result?.file_path) {
            newOrder.photoUrl = `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
            persistShopStore(shopId);
          }
        }).catch(() => {
        });
      }
    }
  }
  shopStore.telegramOrders.unshift(newOrder);
  if (shopStore.telegramOrders.length > 200) shopStore.telegramOrders.pop();
  await persistShopStore(shopId);
}
function startTelegramPolling() {
  const shopOffsets = /* @__PURE__ */ new Map();
  const pollAllShops = async () => {
    for (const [shopId, shopStore] of shopStoresMap.entries()) {
      const token = getTelegramTokenForShop(shopStore);
      if (!token) continue;
      let offset = shopOffsets.get(shopId) || 0;
      try {
        const res = await callTelegramApi(`getUpdates?offset=${offset}&timeout=10`, "GET", void 0, token);
        if (res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            shopOffsets.set(shopId, offset);
            await processTelegramUpdateForShop(update, shopId);
          }
          shopStore.telegram.status = "connected";
          shopStore.telegram.statusMessage = "Connected & Polling Live";
        }
      } catch {
      }
    }
  };
  setInterval(pollAllShops, 4e3);
}
function createMessagingRouter() {
  const router = express.Router();
  router.get("/telegram/config", verifyOwnerTokenMiddleware, async (req, res) => {
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
  router.post("/telegram/config", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { botToken, channelId, accountName, webhookUrl } = req.body || {};
    if (channelId !== void 0) shopStore.telegram.channelId = channelId;
    if (accountName !== void 0) shopStore.telegram.accountName = accountName;
    if (webhookUrl !== void 0) shopStore.telegram.webhookUrl = webhookUrl;
    if (botToken === "") {
      shopStore.telegram.botToken = "";
      shopStore.telegram.webhookUrl = "";
      shopStore.telegram.status = "disconnected";
      shopStore.telegram.statusMessage = "Telegram Bot Token \u1011\u100A\u1037\u103A\u101E\u103D\u1004\u103A\u1038\u1011\u102C\u1038\u1001\u103C\u1004\u103A\u1038 \u1019\u101B\u103E\u102D\u101E\u1031\u1038\u1015\u102B";
      delete shopStore.telegram.connectedAt;
      delete shopStore.telegram.botInfo;
      await persistShopStore(shopId);
      return res.json({
        shopId,
        success: true,
        hasToken: false,
        maskedToken: "",
        status: shopStore.telegram.status,
        statusMessage: shopStore.telegram.statusMessage
      });
    }
    if (botToken && typeof botToken === "string" && botToken.trim()) {
      const cleaned = cleanTelegramToken(botToken);
      if (isValidTokenFormat(cleaned)) {
        shopStore.telegram.botToken = cleaned;
        const test = await callTelegramApi("getMe", "GET", void 0, cleaned);
        if (test.ok && test.result) {
          const bot = {
            id: test.result.id,
            username: test.result.username || "",
            firstName: test.result.first_name || "",
            canJoinGroups: test.result.can_join_groups ?? true,
            canReadAllGroupMessages: test.result.can_read_all_group_messages ?? false,
            supportsInlineQueries: test.result.supports_inline_queries ?? false
          };
          shopStore.telegram.status = "connected";
          shopStore.telegram.connectedAt = (/* @__PURE__ */ new Date()).toISOString();
          shopStore.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
          shopStore.telegram.botInfo = bot;
          try {
            await fetch(`https://api.telegram.org/bot${cleaned}/deleteWebhook?drop_pending_updates=false`);
          } catch {
          }
        } else {
          shopStore.telegram.status = "error";
          shopStore.telegram.statusMessage = test.message;
        }
      }
    }
    await persistShopStore(shopId);
    const currentToken = getTelegramTokenForShop(shopStore);
    res.json({
      shopId,
      success: true,
      hasToken: Boolean(currentToken && currentToken.length > 0),
      maskedToken: maskToken(currentToken),
      status: shopStore.telegram.status,
      statusMessage: shopStore.telegram.statusMessage,
      connectedAt: shopStore.telegram.connectedAt,
      bot: shopStore.telegram.botInfo
    });
  });
  const handleTestConnection = async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const candidateToken = req.body?.botToken || req.query?.botToken;
    const tokenToTest = candidateToken && typeof candidateToken === "string" && candidateToken.trim() ? cleanTelegramToken(candidateToken) : getTelegramTokenForShop(shopStore);
    if (!tokenToTest) {
      return res.json({ status: "disconnected", message: "Telegram Bot Token \u1011\u100A\u1037\u103A\u101E\u103D\u1004\u103A\u1038\u1011\u102C\u1038\u1001\u103C\u1004\u103A\u1038 \u1019\u101B\u103E\u102D\u101E\u1031\u1038\u1015\u102B", shopId });
    }
    const test = await callTelegramApi("getMe", "GET", void 0, tokenToTest);
    if (test.ok && test.result) {
      const bot = {
        id: test.result.id,
        username: test.result.username || "",
        firstName: test.result.first_name || "",
        canJoinGroups: test.result.can_join_groups ?? true,
        canReadAllGroupMessages: test.result.can_read_all_group_messages ?? false,
        supportsInlineQueries: test.result.supports_inline_queries ?? false
      };
      shopStore.telegram.botToken = tokenToTest;
      shopStore.telegram.status = "connected";
      shopStore.telegram.connectedAt = (/* @__PURE__ */ new Date()).toISOString();
      shopStore.telegram.statusMessage = `Connected to @${bot.username || bot.firstName}`;
      shopStore.telegram.botInfo = bot;
      await persistShopStore(shopId);
      return res.json({
        shopId,
        status: "connected",
        message: `Telegram Connection Successful (@${bot.username || bot.firstName})`,
        bot
      });
    }
    return res.json({
      shopId,
      status: "error",
      message: test.message || "Telegram Bot Token \u1019\u1019\u103E\u1014\u103A\u1000\u1014\u103A\u1015\u102B (401 Unauthorized)"
    });
  };
  router.post("/telegram/test", verifyOwnerTokenMiddleware, handleTestConnection);
  router.get("/telegram/test", verifyOwnerTokenMiddleware, handleTestConnection);
  router.post("/telegram/clear-token", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    try {
      const token = getTelegramTokenForShop(shopStore);
      if (token) {
        await callTelegramApi("deleteWebhook", "POST", { drop_pending_updates: false }, token);
      }
    } catch {
    }
    shopStore.telegram.botToken = "";
    shopStore.telegram.webhookUrl = "";
    shopStore.telegram.status = "disconnected";
    shopStore.telegram.statusMessage = "Telegram Bot Token \u1016\u103B\u1000\u103A\u1015\u103C\u102E\u1038\u1015\u102B\u1015\u103C\u102E (Disconnected)";
    delete shopStore.telegram.connectedAt;
    delete shopStore.telegram.botInfo;
    await persistShopStore(shopId);
    return res.json({
      shopId,
      success: true,
      hasToken: false,
      maskedToken: "",
      status: "disconnected",
      statusMessage: "Telegram Bot Token \u1016\u103B\u1000\u103A\u1015\u103C\u102E\u1038\u1015\u102B\u1015\u103C\u102E (Disconnected)"
    });
  });
  router.post("/telegram/set-webhook", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { webhookUrl } = req.body || {};
    const url = webhookUrl || shopStore.telegram.webhookUrl;
    if (!url || !url.startsWith("https://")) {
      return res.status(400).json({ ok: false, message: "HTTPS Webhook URL is required by Telegram" });
    }
    const secret = getTelegramWebhookSecret();
    const token = getTelegramTokenForShop(shopStore);
    if (!token) {
      return res.status(400).json({ ok: false, message: "Telegram Bot Token is required before setting webhook" });
    }
    const setPayload = {
      url,
      drop_pending_updates: false
    };
    if (secret) {
      setPayload.secret_token = secret;
    }
    const result = await callTelegramApi("setWebhook", "POST", setPayload, token);
    if (result.ok) {
      shopStore.telegram.webhookUrl = url;
      await persistShopStore(shopId);
      return res.json({ shopId, ok: true, message: "Telegram Webhook registered successfully" });
    }
    return res.status(502).json({ shopId, ok: false, message: result.message });
  });
  router.post("/telegram/delete-webhook", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const token = getTelegramTokenForShop(shopStore);
    const result = await callTelegramApi("deleteWebhook", "POST", { drop_pending_updates: false }, token);
    if (result.ok) {
      shopStore.telegram.webhookUrl = "";
      await persistShopStore(shopId);
    }
    return res.json({ shopId, ...result });
  });
  const handleWebhookPost = async (req, res) => {
    const rawShopId = req.params?.shopId || req.headers["x-shop-id"] || req.query?.shopId;
    const configuredSecret = getTelegramWebhookSecret();
    if (configuredSecret) {
      const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
      if (incomingSecret) {
        const incomingBuf = Buffer.from(incomingSecret);
        const configBuf = Buffer.from(configuredSecret);
        if (incomingBuf.length !== configBuf.length || !crypto2.timingSafeEqual(incomingBuf, configBuf)) {
          return res.status(403).json({ error: "Forbidden: Invalid secret token" });
        }
      }
    }
    const update = req.body;
    if (rawShopId && typeof rawShopId === "string" && rawShopId.trim() && rawShopId.trim() !== "default") {
      await processTelegramUpdateForShop(update, rawShopId.trim());
    } else {
      const allShops = Array.from(shopStoresMap.keys());
      if (allShops.length === 0) allShops.push("default");
      for (const targetShopId of allShops) {
        await processTelegramUpdateForShop(update, targetShopId);
      }
    }
    return res.status(200).json({ ok: true });
  };
  router.post("/telegram/webhook", handleWebhookPost);
  router.post("/telegram/webhook/:shopId", handleWebhookPost);
  router.post("/telegram/send-message", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { chatId, text, parseMode } = req.body || {};
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, message: "chatId and text are required" });
    }
    const token = getTelegramTokenForShop(shopStore);
    const result = await callTelegramApi("sendMessage", "POST", {
      chat_id: chatId,
      text: String(text),
      parse_mode: parseMode || "HTML"
    }, token);
    return res.json({ shopId, ...result });
  });
  router.get("/telegram/orders", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    res.json(shopStore.telegramOrders || []);
  });
  router.patch("/telegram/orders/:id", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const order = (shopStore.telegramOrders || []).find((o) => o.id === id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (status) order.status = status;
    if (notes !== void 0) order.notes = notes;
    await persistShopStore(shopId);
    res.json(order);
  });
  router.delete("/telegram/orders/:id", verifyOwnerTokenMiddleware, async (req, res) => {
    const shopId = getShopIdFromReq(req);
    const shopStore = await getOrCreateShopStore(shopId);
    const { id } = req.params;
    shopStore.telegramOrders = (shopStore.telegramOrders || []).filter((o) => o.id !== id);
    await persistShopStore(shopId);
    res.json({ success: true, shopId });
  });
  return router;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
async function startServer() {
  const app = express2();
  app.use(express2.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  const DATA_DIR2 = path3.join(process.cwd(), "data");
  const authThrottle = makeFailureThrottle(5, 15 * 60 * 1e3);
  app.post("/api/auth/setup", (req, res) => {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: "Valid 6-digit PIN required" });
    }
    const created = setupOwnerAuth(DATA_DIR2, pin.trim());
    if (!created) return res.status(409).json({ error: "already-setup" });
    return res.json({ success: true });
  });
  app.post("/api/auth/token", (req, res) => {
    const key = req.ip || "unknown";
    if (authThrottle.blocked(key)) {
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    const { pin } = req.body || {};
    if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ error: "Valid 6-digit PIN required" });
    }
    const ok = verifyOwnerAuth(DATA_DIR2, pin.trim());
    if (ok === "not-setup") return res.status(409).json({ error: "setup-required" });
    if (!ok) {
      authThrottle.fail(key);
      return res.status(401).json({ error: "Invalid PIN" });
    }
    authThrottle.reset(key);
    const token = generateOwnerSessionToken(pin.trim());
    return res.json({ success: true, token });
  });
  app.use("/api", createMessagingRouter());
  const ocrRateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60", 10);
  const ocrLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: ocrRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
  });
  app.get("/api/lottery/live-results", async (req, res) => {
    try {
      let live3DData = null;
      try {
        const response3D = await fetch("https://thai-lottery-api.vercel.app/latest", {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(3500)
        });
        if (response3D.ok) {
          live3DData = await response3D.json();
        }
      } catch (err3d) {
      }
      res.json({
        success: true,
        source: "Official Thai GLO Lottery",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        live3D: live3DData
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch live results" });
    }
  });
  app.post("/api/ocr", verifyOwnerTokenMiddleware, ocrLimiter, async (req, res) => {
    try {
      const { image, mimeType, mode = "auto" } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI({
        apiKey: apiKey || "",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const modeInstruction = mode === "2d" ? `Target Mode: 2D ONLY. Extract 2-digit numbers (00 to 99) and amounts.
Also support:
- 2D reversals / R / \u1021\u102C / \u1015\u1010\u103A / \u1015\u1010\u103A\u101C\u100A\u103A (e.g. "24R 1000", "24 \u1021\u102C 500", "24-42 1000" -> produce 24=1000 and 42=1000).
- Multiple 2D numbers with R / \u1021\u102C / \u1015\u1010\u103A.
- Special Myanmar 2D lottery groups: \u1021\u1015\u1030\u1038, \u1021\u1015\u102B, \u1018\u101B\u102D\u1010\u103A, \u1011\u102D\u1015\u103A, \u1014\u1031\u102C\u1000\u103A, \u1015\u102B\u101D\u102B, \u1014\u1000\u1039\u1001\u1010\u103A, \u100A\u102E\u1000\u102D\u102F.` : mode === "3d" ? `Target Mode: 3D ONLY. Extract 3-digit numbers (000 to 999) and amounts.` : `Target Mode: AUTO (both 2D and 3D).`;
      const prompt = `You are an expert OCR and data extraction assistant specialized in Myanmar 2D/3D lottery slips, paper receipts, and chat screenshots from Telegram and SMS.
Analyze this image.
1. Extract ALL readable text line-by-line verbatim into "rawText".
2. Identify customer name if present.
3. Identify customer phone number if present.
4. Extract all betting numbers and amounts accurately:
   ${modeInstruction}
   - Convert all Myanmar numerals into English digits (0-9).
5. Return ONLY a valid JSON object with this exact structure (no markdown fences, no explanatory comments):
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "24", "amount": 1000, "isRumble": false, "originalRaw": "24=1000" }
  ],
  "rawText": "verbatim text lines detected in image"
}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: imageBuffer.toString("base64")
            }
          },
          { text: prompt }
        ]
      });
      const textOutput = response.text || "";
      let jsonResult;
      try {
        const cleanJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
        jsonResult = JSON.parse(cleanJson);
      } catch (parseErr) {
        const match = textOutput.match(/\{[\s\S]*\}/);
        if (match) {
          jsonResult = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse Gemini JSON response");
        }
      }
      res.json(jsonResult);
    } catch (error) {
      console.error("Gemini OCR Error:", error);
      res.status(500).json({ error: error.message || "OCR processing failed" });
    }
  });
  app.post("/api/parse-chat-text", verifyOwnerTokenMiddleware, ocrLimiter, async (req, res) => {
    try {
      const { text, mode = "auto" } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "No text provided" });
      }
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI({
        apiKey: apiKey || "",
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const modeInstruction = mode === "2d" ? `Target Mode: 2D ONLY. Extract 2-digit numbers and amounts.` : mode === "3d" ? `Target Mode: 3D ONLY. Extract 3-digit numbers and amounts.` : `Target Mode: AUTO (both 2D and 3D).`;
      const prompt = `You are an expert data parser for Myanmar 2D/3D lottery bets sent via Telegram or SMS.
The user pasted text directly from a chat:
"""
${text}
"""

Instructions:
1. Identify customer name and phone number if present.
2. Extract all bet items and amounts according to ${modeInstruction}.
3. Convert all Myanmar numerals to English digits (0-9).
4. Return ONLY a valid JSON object matching:
{
  "customerName": "string",
  "customerPhone": "string",
  "items": [
    { "number": "string", "amount": 1000, "isRumble": false, "originalRaw": "string" }
  ],
  "rawText": "clean summary"
}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const textOutput = response.text || "";
      let jsonResult;
      try {
        const cleanJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
        jsonResult = JSON.parse(cleanJson);
      } catch (parseErr) {
        const match = textOutput.match(/\{[\s\S]*\}/);
        if (match) {
          jsonResult = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse Gemini JSON response");
        }
      }
      res.json(jsonResult);
    } catch (error) {
      console.error("Gemini Chat Text Parsing Error:", error);
      res.status(500).json({ error: error.message || "Chat text parsing failed" });
    }
  });
  const distPath = path3.resolve(__dirname, "dist");
  if (process.env.NODE_ENV === "production" || fs3.existsSync(distPath)) {
    app.use(express2.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path3.resolve(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const PORT = parseInt(process.env.PORT || "3000", 10);
  if (!process.env.VERCEL) {
    app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log(`Server running on http://${process.env.HOST || "0.0.0.0"}:${PORT}`);
    });
  }
  return app;
}
var appPromise = startServer();
var server_default = async (req, res) => {
  const app = await appPromise;
  app(req, res);
};
export {
  appPromise,
  server_default as default
};
