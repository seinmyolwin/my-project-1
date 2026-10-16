import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Disable internal gRPC connection idle cancel noise in Node.js
setLogLevel('silent');

const CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_STORE_FILE = path.join(DATA_DIR, 'messaging_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

let firebaseConfig: any = {
  apiKey: "AIzaSyD7CoDay1qvWplIOZCEDiyWvsC8m61Zh9U",
  authDomain: "hypnotic-ridge-mvd6f.firebaseapp.com",
  projectId: "hypnotic-ridge-mvd6f",
  storageBucket: "hypnotic-ridge-mvd6f.firebasestorage.app",
  messagingSenderId: "105721214613",
  appId: "1:105721214613:web:7ff1c8e16599f40320cd9c",
  firestoreDatabaseId: "ai-studio-myproject1-c895993b-f8fd-42a8-a0bb-19ea802b687a"
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    firebaseConfig = JSON.parse(raw);
  } catch {
    // fallback to default
  }
}

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-myproject1-c895993b-f8fd-42a8-a0bb-19ea802b687a");
const STORE_DOC_REF = doc(db, 'store', 'messaging_data');

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

function loadLocalStore(): any | null {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data && typeof data === 'object') return data;
    }
  } catch (err) {
    // fallback
  }
  return null;
}

function saveLocalStore(store: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    // ignore
  }
}

export async function loadStoreFromFirestore(): Promise<any> {
  const localData = loadLocalStore();

  try {
    const docSnap = await getDoc(STORE_DOC_REF);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure expected structure
      if (data && data.telegram) {
        saveLocalStore(data);
        return data;
      }
    }
  } catch (err) {
    // If firestore is not reachable, gracefully fallback to local file
  }

  if (localData && localData.telegram) {
    return localData;
  }

  const def = getDefaultStore();
  saveLocalStore(def);
  return def;
}

export async function saveStoreToFirestore(store: any) {
  // Always persist locally first so state is never lost
  saveLocalStore(store);

  try {
    await setDoc(STORE_DOC_REF, store);
  } catch (err) {
    // Persisted locally, background firestore sync can retry
  }
}
