/**
 * Backup v2 cryptography: PBKDF2-SHA256 (310000 iterations, 16-byte random salt)
 * deriving an AES-256-GCM key (12-byte random IV). WebCrypto only.
 * Payload format: "SMG2::<base64 salt>::<base64 iv>::<base64 ciphertext>"
 */

export const V2_PREFIX = 'SMG2::';
const PBKDF2_ITERATIONS = 310000;

const toB64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const fromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const deriveKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const isV2Payload = (s: string): boolean => s.startsWith(V2_PREFIX);

export async function encryptBackupV2(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${V2_PREFIX}${toB64(salt)}::${toB64(iv)}::${toB64(new Uint8Array(ct))}`;
}

/** Throws if the passphrase is wrong or the payload was altered (GCM tag check). */
export async function decryptBackupV2(payload: string, passphrase: string): Promise<string> {
  if (!isV2Payload(payload)) throw new Error('Not a v2 payload');
  const parts = payload.slice(V2_PREFIX.length).split('::');
  if (parts.length !== 3) throw new Error('Malformed v2 payload');
  const salt = fromB64(parts[0]);
  const iv = fromB64(parts[1]);
  const ct = fromB64(parts[2]);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return new TextDecoder().decode(pt);
}
