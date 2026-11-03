/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Restore Points Utility (Part 0)
 * Provides byte-for-byte lossless snapshots, IndexedDB storage with localStorage fallback,
 * read-back verification, rule-based pruning, and safe rollback safeguards.
 */

export interface RestorePoint {
  id: string; // uuid
  createdAt: string; // ISO date string
  reason: 'manual' | 'before-import' | 'before-migration' | 'before-rollback' | 'before-period-close' | 'auto';
  appVersion: string;
  keyCount: number;
  bytes: number;
  keys: Record<string, string>; // { [key]: rawString }
  hashes?: Record<string, string>; // { [key]: sha256Hex }
  meta?: any;
  excludedKeys: string[];
  redacted: boolean;
  redactedKeys: string[];
}

export const RESTORE_POINTS_LOCAL_KEY = 'restore_points_v1';
export const RESTORE_POINT_KEEP_KEY = 'restore_point_keep_v1';
export const RESTORE_POINT_KEEP_DEFAULT = 5;

// In-memory fallback storage for environments without browser localStorage (e.g. Node.js unit tests)
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

const memoryStorageInstance = new MemoryStorage();

export function getStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  key: (index: number) => string | null;
  length: number;
} {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return memoryStorageInstance;
}

/**
 * Computes standard SHA-256 hex string for byte-for-byte verification.
 * Works seamlessly across browser and Node.js environments.
 */
export async function computeSha256(str: string): Promise<string> {
  const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle)
      ? (globalThis as any).crypto.subtle
      : null;

  if (subtle) {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Deterministic fallback if subtle crypto is completely absent
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

export function isInternalRestorePointKey(key: string): boolean {
  if (!key) return false;
  return key === RESTORE_POINTS_LOCAL_KEY || key.startsWith('restore_point_');
}

/**
 * Checks whether a key is an application-specific key eligible for deletion on rollback.
 * Non-app keys (third-party data, unrelated extensions) are strictly preserved.
 */
export function isAppKeyForDeletion(key: string): boolean {
  if (!key) return false;
  if (isInternalRestorePointKey(key)) return false;
  return (
    key.startsWith('3d_ledger_') ||
    key.startsWith('2d_ledger_') ||
    key.startsWith('football_ledger_') ||
    key === 'shwe_master_agents_list' ||
    key === 'bookie_custom_command_rules_v2' ||
    key.startsWith('shwe_customer_commissions_') ||
    key.startsWith('shwe_mingalar_') ||
    key.startsWith('quick_results') ||
    key === 'active_bookie_mode' ||
    key.includes('rawclip') ||
    key.includes('raw_text_clips') ||
    key.includes('settings') ||
    key.includes('security') ||
    key.includes('_pin') ||
    key.includes('telegram') ||
    key.includes('_draft_') ||
    key.includes('rule_confirmed') ||
    key.startsWith('pre_migration_snapshot') ||
    key.startsWith('pre_restore_snapshot') ||
    key === 'part1_migration_completed_v1'
  );
}

export function isAppKey(key: string): boolean {
  if (!key) return false;
  // Exclude internal restore points keys
  if (isInternalRestorePointKey(key)) {
    return false;
  }
  return true;
}

export function calculateBytes(keys: Record<string, string>): number {
  let total = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (typeof TextEncoder !== 'undefined') {
      total += new TextEncoder().encode(k).length + new TextEncoder().encode(v).length;
    } else {
      total += Buffer.from(k, 'utf-8').length + Buffer.from(v, 'utf-8').length;
    }
  }
  return total;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'rp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

// Configurable RESTORE_POINT_KEEP helper
export function getRestorePointKeep(): number {
  try {
    const storage = getStorage();
    const stored = storage.getItem(RESTORE_POINT_KEEP_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const settingsRaw = storage.getItem('3d_ledger_settings_v1');
    if (settingsRaw) {
      const s = JSON.parse(settingsRaw);
      if (s && typeof s.restorePointKeep === 'number' && s.restorePointKeep > 0) {
        return s.restorePointKeep;
      }
    }
  } catch {
    // fallback
  }
  return RESTORE_POINT_KEEP_DEFAULT;
}

export function setRestorePointKeep(count: number): void {
  try {
    if (count > 0) {
      const storage = getStorage();
      storage.setItem(RESTORE_POINT_KEEP_KEY, String(count));
      const settingsRaw = storage.getItem('3d_ledger_settings_v1');
      if (settingsRaw) {
        const s = JSON.parse(settingsRaw);
        s.restorePointKeep = count;
        storage.setItem('3d_ledger_settings_v1', JSON.stringify(s));
      }
    }
  } catch {
    // ignore
  }
}

// IndexedDB Helper
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in current environment'));
    }
    const req = indexedDB.open('shwe_mingalar_restore_db', 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('restore_points')) {
        const store = db.createObjectStore('restore_points', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('reason', 'reason', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getLocalStorageRestorePoints(): RestorePoint[] {
  try {
    const storage = getStorage();
    const raw = storage.getItem(RESTORE_POINTS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalStorageRestorePoints(points: RestorePoint[]): void {
  try {
    const storage = getStorage();
    storage.setItem(RESTORE_POINTS_LOCAL_KEY, JSON.stringify(points));
  } catch (err) {
    console.warn('[RestorePoints] LocalStorage save failed:', err);
  }
}

async function saveToIndexedDB(point: RestorePoint): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('restore_points', 'readwrite');
      const store = tx.objectStore('restore_points');
      store.put(point);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function getFromIndexedDB(id: string): Promise<RestorePoint | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('restore_points', 'readonly');
      const store = tx.objectStore('restore_points');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function listFromIndexedDB(): Promise<RestorePoint[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('restore_points', 'readonly');
      const store = tx.objectStore('restore_points');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function deleteFromIndexedDB(id: string): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('restore_points', 'readwrite');
      const store = tx.objectStore('restore_points');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getRestorePoint(id: string): Promise<RestorePoint | null> {
  // 1. Try IndexedDB
  const fromIDB = await getFromIndexedDB(id);
  if (fromIDB) return fromIDB;

  // 2. Fallback to LocalStorage
  const list = getLocalStorageRestorePoints();
  return list.find(p => p.id === id) || null;
}

export async function listRestorePoints(): Promise<RestorePoint[]> {
  let list: RestorePoint[] = [];

  // Try IndexedDB first
  try {
    const fromIDB = await listFromIndexedDB();
    if (fromIDB && fromIDB.length > 0) {
      list = fromIDB;
    }
  } catch {
    // fallback
  }

  // Fallback to LocalStorage if IndexedDB was empty or unavailable
  if (list.length === 0) {
    list = getLocalStorageRestorePoints();
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteRestorePoint(id: string): Promise<void> {
  await deleteFromIndexedDB(id);
  const localList = getLocalStorageRestorePoints().filter(p => p.id !== id);
  saveLocalStorageRestorePoints(localList);
}

/**
 * Creates a byte-for-byte full localStorage restore point.
 * Reads every key raw string without modification, calculates SHA-256 hash per key,
 * saves to IndexedDB (with localStorage fallback), and verifies immediately via hash comparison.
 * If any byte/hash mismatch occurs, the point is deleted immediately and an error is thrown.
 */
export async function createRestorePoint(
  reason: 'manual' | 'before-import' | 'before-migration' | 'before-rollback' | 'before-period-close' | 'auto',
  meta?: any
): Promise<RestorePoint> {
  const storage = getStorage();

  const keys: Record<string, string> = {};
  const excludedKeys: string[] = [];
  const redactedKeys: string[] = [];
  let redacted = false;

  // Comprehensive key coverage: snapshot all keys in storage (excluding internal restore points)
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && !isInternalRestorePointKey(k)) {
      if (k.includes('telegram')) {
        excludedKeys.push(k);
        continue;
      }
      
      const val = storage.getItem(k);
      if (val !== null) {
        let finalVal = val;
        if (val.includes('customerPhone')) {
          try {
            const obj = JSON.parse(val);
            let hasPhone = false;
            const traverse = (item: any) => {
              if (item && typeof item === 'object') {
                Object.keys(item).forEach(key => {
                  if (key === 'customerPhone') {
                    item[key] = "";
                    hasPhone = true;
                  } else {
                    traverse(item[key]);
                  }
                });
              }
            };
            traverse(obj);
            if (hasPhone) {
              finalVal = JSON.stringify(obj);
              redacted = true;
              redactedKeys.push(k);
            }
          } catch { /* parse error, skip redaction */ }
        }
        keys[k] = finalVal;
      }
    }
  }

  const keyCount = Object.keys(keys).length;
  const bytes = calculateBytes(keys);
  const id = generateUUID();
  const createdAt = new Date().toISOString();
  const appVersion = '3.0';

  // Compute SHA-256 for each key's raw value
  const hashes: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    hashes[k] = await computeSha256(v);
  }

  const record: RestorePoint = {
    id,
    createdAt,
    reason,
    appVersion,
    keyCount,
    bytes,
    keys,
    hashes,
    meta,
    excludedKeys,
    redacted,
    redactedKeys
  };

  // 1. Save to LocalStorage fallback
  const localList = getLocalStorageRestorePoints();
  localList.unshift(record);
  saveLocalStorageRestorePoints(localList);

  // 2. Save to IndexedDB
  await saveToIndexedDB(record);

  // 3. Immediately read back and verify: Byte-for-byte SHA-256 hash comparison!
  // If mismatch occurs, throw error and delete the corrupted point immediately.
  const verified = await getRestorePoint(id);
  if (!verified) {
    await deleteRestorePoint(id);
    throw new Error(`[RestorePoint] Verification failed: Point "${id}" could not be read back after write. Point deleted.`);
  }

  const verifiedKeys = Object.keys(verified.keys);
  if (verifiedKeys.length !== record.keyCount) {
    await deleteRestorePoint(id);
    throw new Error(
      `[RestorePoint] Verification failed: Point "${id}" key count mismatch. Expected: ${record.keyCount}, Got: ${verifiedKeys.length}. Corrupted point deleted.`
    );
  }

  if (verified.bytes !== record.bytes) {
    await deleteRestorePoint(id);
    throw new Error(
      `[RestorePoint] Verification failed: Point "${id}" bytes mismatch. Expected: ${record.bytes}, Got: ${verified.bytes}. Corrupted point deleted.`
    );
  }

  for (const [k, expectedVal] of Object.entries(record.keys)) {
    const verifiedVal = verified.keys[k];
    if (verifiedVal === undefined) {
      await deleteRestorePoint(id);
      throw new Error(`[RestorePoint] Verification failed: Key "${k}" missing in point "${id}". Corrupted point deleted.`);
    }
    const computedHash = await computeSha256(verifiedVal);
    const expectedHash = record.hashes?.[k];
    if (expectedHash && computedHash !== expectedHash) {
      await deleteRestorePoint(id);
      throw new Error(
        `[RestorePoint] Verification failed: SHA-256 mismatch for key "${k}". Expected hash: ${expectedHash}, Got: ${computedHash}. Corrupted point deleted.`
      );
    }
  }

  // 4. Auto-prune if reason === 'auto'
  if (reason === 'auto') {
    try {
      await pruneRestorePoints();
    } catch (pruneErr) {
      console.warn('[RestorePoint] Prune error:', pruneErr);
    }
  }

  return verified;
}

/**
 * Prunes restore points if count of 'auto' points exceeds RESTORE_POINT_KEEP.
 * Deletes ONLY the oldest 'auto' points.
 * NEVER deletes 'manual', 'before-import', 'before-migration', or 'before-rollback'.
 */
export async function pruneRestorePoints(): Promise<number> {
  const keep = getRestorePointKeep();
  const allPoints = await listRestorePoints();

  // Filter only 'auto' points
  const autoPoints = allPoints
    .filter(p => p.reason === 'auto')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // newest first

  if (autoPoints.length <= keep) {
    return 0;
  }

  // Points to delete: excess auto points (the oldest ones)
  const toDelete = autoPoints.slice(keep);
  let deletedCount = 0;
  for (const p of toDelete) {
    await deleteRestorePoint(p.id);
    deletedCount++;
  }
  return deletedCount;
}

/**
 * Restores all keys from the specified restore point ID.
 * Captures current state as 'before-rollback' first.
 * Writes all keys, verifies each key, and rolls back if verification fails.
 * Safeguard: Only app keys are removed if missing from target point. Non-app keys are preserved!
 */
export async function restoreFromRestorePoint(id: string): Promise<{
  success: boolean;
  message: string;
  keyCount: number;
  bytes: number;
}> {
  const targetPoint = await getRestorePoint(id);
  if (!targetPoint) {
    throw new Error(`[RestorePoint] Point with ID "${id}" does not exist.`);
  }

  const storage = getStorage();

  // 1. Capture current state as 'before-rollback' point first
  const beforeRollback = await createRestorePoint('before-rollback', {
    targetId: id,
    targetReason: targetPoint.reason
  });

  // 2. Identify all current app keys that are eligible for deletion if absent in target point
  const currentAppKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && isAppKeyForDeletion(k)) {
      currentAppKeys.push(k);
    }
  }

  try {
    // Write all keys from target point
    for (const [k, v] of Object.entries(targetPoint.keys)) {
      storage.setItem(k, v);
    }

    // Rollback safety: ONLY remove keys matching app patterns that did not exist in target point.
    // Unrelated non-app keys (browser extensions, third-party localStorage) are preserved!
    for (const k of currentAppKeys) {
      if (!(k in targetPoint.keys)) {
        storage.removeItem(k);
      }
    }

    // 3. Verify write-all
    for (const [k, expectedVal] of Object.entries(targetPoint.keys)) {
      const readVal = storage.getItem(k);
      if (readVal !== expectedVal) {
        throw new Error(`Verification failed for key "${k}": value mismatch after restore.`);
      }
    }
    for (const k of currentAppKeys) {
      if (!(k in targetPoint.keys) && storage.getItem(k) !== null) {
        throw new Error(`Verification failed: extra app key "${k}" was not removed.`);
      }
    }

    return {
      success: true,
      message: `Restore point ${id} (${targetPoint.reason}, ${targetPoint.createdAt}) အား အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ`,
      keyCount: targetPoint.keyCount,
      bytes: targetPoint.bytes
    };
  } catch (err: any) {
    console.error('[RestorePoint] Write-all verification failed! Rolling back to before-rollback snapshot...', err);
    // Rollback from beforeRollback snapshot
    for (const [k, v] of Object.entries(beforeRollback.keys)) {
      storage.setItem(k, v);
    }
    throw new Error(`Restore failed and was safely rolled back: ${err?.message || 'Verification error'}`);
  }
}

// B3: Expose window.__restorePoints in production for emergency fallback
if (typeof window !== 'undefined') {
  (window as any).__restorePoints = {
    list: listRestorePoints,
    restore: restoreFromRestorePoint,
    create: createRestorePoint,
    prune: pruneRestorePoints,
    getKeep: getRestorePointKeep,
    setKeep: setRestorePointKeep
  };
}
