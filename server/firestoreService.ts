import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD7CoDay1qvWplIOZCEDiyWvsC8m61Zh9U",
  authDomain: "hypnotic-ridge-mvd6f.firebaseapp.com",
  projectId: "hypnotic-ridge-mvd6f",
  storageBucket: "hypnotic-ridge-mvd6f.firebasestorage.app",
  messagingSenderId: "105721214613",
  appId: "1:105721214613:web:7ff1c8e16599f40320cd9c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-myproject1-c895993b-f8fd-42a8-a0bb-19ea802b687a");

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
