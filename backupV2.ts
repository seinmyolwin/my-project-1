import { PeriodClosing } from '../types';
import { STORAGE_KEYS, loadStoredData } from './storage';
import { generateContentHash } from './hashUtils';

// Helper to generate canonical entity snapshot
const getCanonicalEntities = () => {
  // Logic to gather all entities (rounds, vouchers, slips, matches, leagues, etc.)
  // and sort them to ensure consistent hashing.
  return {
    rounds: JSON.parse(localStorage.getItem(STORAGE_KEYS.ROUNDS) || '[]').sort((a: any, b: any) => a.id.localeCompare(b.id)),
    vouchers: JSON.parse(localStorage.getItem(STORAGE_KEYS.VOUCHERS) || '[]').sort((a: any, b: any) => a.id.localeCompare(b.id)),
    // ... add all relevant entities for all games
  };
};

export const createBackupV2 = async (
  passphrase: string,
  deviceShortCode: string,
  exportSequence: number
) => {
  const data = {
    schemaVersion: 2,
    deviceShortCode,
    exportSequence,
    exportedAt: new Date().toISOString(),
    periods: loadStoredData(STORAGE_KEYS.PERIOD_CLOSINGS, []),
    appVersion: '3.0',
    entities: getCanonicalEntities()
  };

  const totalsHash = await generateContentHash(data.entities);
  const finalData = { ...data, totalsHash };

  // Encryption: PBKDF2 -> AES-GCM
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const passwordKey = await crypto.subtle.importKey(
    'raw', encoder.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encoder.encode(JSON.stringify(finalData))
  );

  // Return base64 encoded salt::iv::encrypted
  return btoa(String.fromCharCode(...salt)) + '::' + 
         btoa(String.fromCharCode(...iv)) + '::' + 
         btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};
