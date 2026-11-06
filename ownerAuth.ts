import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Server-side owner PIN verification. The server stores only a salted PBKDF2 hash.
 * Setup is first-come (one-time); after that every token request must match the hash.
 */
const ITERATIONS = 310000;
const KEYLEN = 32;

export interface OwnerAuthRecord { salt: string; hash: string; iterations: number }

export function authFilePath(dataDir: string): string {
  return path.join(dataDir, 'owner_auth.json');
}

const derive = (pin: string, saltHex: string, iterations: number) =>
  crypto.pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), iterations, KEYLEN, 'sha256').toString('hex');

export function isSetup(dataDir: string): boolean {
  return fs.existsSync(authFilePath(dataDir));
}

/** One-time setup. Returns false if already set up. */
export function setupOwnerAuth(dataDir: string, pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be 6 digits');
  if (isSetup(dataDir)) return false;
  fs.mkdirSync(dataDir, { recursive: true });
  const salt = crypto.randomBytes(16).toString('hex');
  const rec: OwnerAuthRecord = { salt, hash: derive(pin, salt, ITERATIONS), iterations: ITERATIONS };
  fs.writeFileSync(authFilePath(dataDir), JSON.stringify(rec), { mode: 0o600 });
  return true;
}

export function verifyOwnerAuth(dataDir: string, pin: string): boolean | 'not-setup' {
  if (!isSetup(dataDir)) return 'not-setup';
  const rec: OwnerAuthRecord = JSON.parse(fs.readFileSync(authFilePath(dataDir), 'utf-8'));
  const candidate = Buffer.from(derive(pin, rec.salt, rec.iterations), 'hex');
  const expected = Buffer.from(rec.hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Simple in-memory failure throttle: `max` failures per window per key. */
export function makeFailureThrottle(max: number, windowMs: number) {
  const fails = new Map<string, number[]>();
  return {
    blocked(key: string): boolean {
      const now = Date.now();
      const list = (fails.get(key) || []).filter(t => now - t < windowMs);
      fails.set(key, list);
      return list.length >= max;
    },
    fail(key: string) {
      const list = fails.get(key) || [];
      list.push(Date.now());
      fails.set(key, list);
    },
    reset(key: string) { fails.delete(key); },
  };
}
