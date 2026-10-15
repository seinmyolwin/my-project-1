import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: "hypnotic-ridge-mvd6f",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORE_DOC_REF = doc(db, 'store', 'messaging_data');

export async function loadStoreFromFirestore(): Promise<any> {
  try {
    const docSnap = await getDoc(STORE_DOC_REF);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    console.error('Failed to read messaging store from Firestore:', err);
  }
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

export async function saveStoreToFirestore(store: any) {
  try {
    await setDoc(STORE_DOC_REF, store);
  } catch (err) {
    console.error('Failed to persist messaging store to Firestore:', err);
  }
}
