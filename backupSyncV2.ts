/**
 * Backup v2 (sync-capable): full export of every ledger/aux key, UUID merge with
 * tombstones, restore modes (fresh / merge / replace), preview, device sequence check.
 * Passphrase is the owner PIN (6 digits); payload is AES-GCM via cryptoBackup.ts.
 */
import { encryptBackupV2, decryptBackupV2 } from './cryptoBackup';
import { computeSha256Digest } from './tombstoneUtils';
import { createRestorePoint } from './restorePoints';
import { getDeviceShortCode } from './deviceId';

export const EXPORT_SEQUENCE_KEY = 'export_sequence_v1';
export const lastImportedKey = (shortCode: string) => `last_imported_sequence_${shortCode}`;

/** Every key that carries business data. Telegram config and security keys are intentionally excluded. */
export const V2_ENTITY_KEYS: string[] = [
  '3d_ledger_rounds_v1', '3d_ledger_vouchers_v1', '3d_ledger_limits_v1', '3d_ledger_blocked_v1',
  '3d_ledger_forward_slips_v1', '3d_ledger_settings_v1', '3d_ledger_active_round_id_v1',
  '2d_ledger_rounds_v1', '2d_ledger_vouchers_v1', '2d_ledger_limits_v1', '2d_ledger_blocked_v1',
  '2d_ledger_forward_slips_v1', '2d_ledger_settings_v1', '2d_ledger_active_round_id_v1',
  '2d_ledger_deleted_rounds_v1',
  'football_ledger_matches_v1', 'football_ledger_slips_v1', 'football_ledger_forward_slips_v1',
  'football_ledger_settings_v1', 'football_ledger_active_date_v1', 'football_ledger_leagues_v1',
  'period_closings_v1',
  'shwe_master_agents_list', 'shwe_customer_commissions_v1',
  'shwe_mingalar_copied_raw_texts', 'bookie_custom_command_rules_v2',
  'id_migration_map_v1',
];

/** Arrays whose records carry `id` and optional `updatedAt`/`deletedAt`. */
const RECORD_ARRAY_KEYS = new Set<string>([
  '3d_ledger_rounds_v1', '3d_ledger_vouchers_v1', '3d_ledger_forward_slips_v1',
  '2d_ledger_rounds_v1', '2d_ledger_vouchers_v1', '2d_ledger_forward_slips_v1', '2d_ledger_deleted_rounds_v1',
  'football_ledger_matches_v1', 'football_ledger_slips_v1', 'football_ledger_forward_slips_v1',
  'football_ledger_leagues_v1', 'period_closings_v1', 'shwe_mingalar_copied_raw_texts',
]);

const LEDGER_KEYS = V2_ENTITY_KEYS.filter(k => !k.startsWith('shwe_') && !k.startsWith('bookie_') && k !== 'id_migration_map_v1');

/** Remove customer phone numbers and bot tokens from a stored raw value. */
export function scrubRaw(raw: string): string {
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  const clean = (v: any): any => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const k of Object.keys(v)) {
        if (k === 'customerPhone' || k === 'botToken') continue;
        o[k] = clean(v[k]);
      }
      return o;
    }
    return v;
  };
  return JSON.stringify(clean(parsed));
}

const readRaw = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};

export function buildEntities(): Record<string, string> {
  const entities: Record<string, string> = {};
  for (const k of V2_ENTITY_KEYS) {
    const raw = readRaw(k);
    if (raw !== null) entities[k] = scrubRaw(raw);
  }
  return entities;
}

function countRecords(entities: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const k of Object.keys(entities)) {
    try {
      const v = JSON.parse(entities[k]);
      counts[k] = Array.isArray(v) ? v.length : 1;
    } catch { counts[k] = 1; }
  }
  return counts;
}

function nextExportSequence(): number {
  const n = Number(readRaw(EXPORT_SEQUENCE_KEY) || '0') + 1;
  localStorage.setItem(EXPORT_SEQUENCE_KEY, String(n));
  return n;
}

/** Full v2 payload string (SMG2::…) ready to be armored. Increments the export sequence. */
export async function exportPayloadV2Full(passphrase: string): Promise<{ encrypted: string; checksum: string }> {
  const entities = buildEntities();
  const shortCode = getDeviceShortCode();
  const exportSequence = nextExportSequence();
  const entitiesJson = JSON.stringify(entities);
  const manifest = {
    schemaVersion: 2,
    appVersion: '3.0',
    deviceShortCode: shortCode,
    exportSequence,
    exportedAt: new Date().toISOString(),
    counts: countRecords(entities),
    totalsHash: await computeSha256Digest(entitiesJson),
  };
  const plaintext = JSON.stringify({ manifest, entities });
  const encrypted = await encryptBackupV2(plaintext, passphrase || 'NO_PIN');
  return { encrypted, checksum: checksumOf(plaintext) };
}

/** Same checksum function the armored reader uses, applied to the v2 plaintext. */
export function checksumOf(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function parseV2Plaintext(json: string): { manifest: any; entities: Record<string, string> } {
  const obj = JSON.parse(json);
  if (!obj || !obj.manifest || obj.manifest.schemaVersion !== 2 || !obj.entities || typeof obj.entities !== 'object') {
    throw new Error('Backup v2 schema မှားယွင်းနေပါသည်');
  }
  return { manifest: obj.manifest, entities: obj.entities };
}

// ---------- restore ----------

type Rec = { id: string; updatedAt?: string; deletedAt?: string | null; status?: string; [k: string]: any };

const parseArr = (raw: string | null | undefined): Rec[] => {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};
const ts = (r: Rec) => Date.parse(r.updatedAt || '') || 0;
const isClosedRecord = (r: Rec) => r.status === 'settled' || r.status === 'closed';

/** Merge two record lists by id. Tombstones propagate when they are not older than the other side. */
export function mergeRecords(local: Rec[], incoming: Rec[]) {
  const map = new Map<string, Rec>();
  const stats = { added: 0, same: 0, updated: 0, protected: 0, tombstoned: 0 };
  for (const r of local) if (r && r.id) map.set(r.id, r);
  for (const b of incoming) {
    if (!b || !b.id) continue;
    const l = map.get(b.id);
    if (!l) { map.set(b.id, b); stats.added++; continue; }
    if (JSON.stringify(l) === JSON.stringify(b)) { stats.same++; continue; }
    if (isClosedRecord(l) && !isClosedRecord(b)) { stats.protected++; continue; }
    if (l.deletedAt || b.deletedAt) {
      const winner = ts(b) >= ts(l) ? b : l;
      map.set(b.id, winner);
      if (winner.deletedAt) stats.tombstoned++; else stats.updated++;
      continue;
    }
    if (ts(b) > ts(l)) { map.set(b.id, b); stats.updated++; }
    else stats.protected++;
  }
  return { merged: Array.from(map.values()), stats };
}

export interface RestorePreview { added: number; same: number; updated: number; protectedCount: number; tombstones: number; ledgerNotEmpty: boolean }

export function previewRestore(entities: Record<string, string>): RestorePreview {
  const p: RestorePreview = { added: 0, same: 0, updated: 0, protectedCount: 0, tombstones: 0, ledgerNotEmpty: false };
  for (const k of LEDGER_KEYS) {
    const local = readRaw(k);
    if (local && local !== '[]' && local !== '{}' && local !== 'null') p.ledgerNotEmpty = true;
  }
  for (const k of Object.keys(entities)) {
    if (!RECORD_ARRAY_KEYS.has(k)) continue;
    const { stats } = mergeRecords(parseArr(readRaw(k)), parseArr(entities[k]));
    p.added += stats.added; p.same += stats.same; p.updated += stats.updated;
    p.protectedCount += stats.protected; p.tombstones += stats.tombstoned;
  }
  return p;
}

export type RestoreMode = 'fresh' | 'merge' | 'replace';

export function applyRestore(entities: Record<string, string>, mode: RestoreMode): number {
  let written = 0;
  for (const k of Object.keys(entities)) {
    if (RECORD_ARRAY_KEYS.has(k) && mode === 'merge') {
      const { merged } = mergeRecords(parseArr(readRaw(k)), parseArr(entities[k]));
      localStorage.setItem(k, JSON.stringify(merged));
    } else if (mode === 'merge' && readRaw(k) !== null) {
      continue; // settings/limits/blocked/active ids: keep local values in merge mode
    } else {
      localStorage.setItem(k, entities[k]);
    }
    written++;
  }
  return written;
}

/** Full restore flow with owner confirmations. Returns a human message. */
export async function restoreV2Flow(json: string, passphrase: string): Promise<{ success: boolean; message: string }> {
  const { manifest, entities } = parseV2Plaintext(json);
  const hashNow = await computeSha256Digest(JSON.stringify(entities));
  if (manifest.totalsHash && hashNow !== manifest.totalsHash) {
    return { success: false, message: 'Backup ဒေတာ hash မကိုက်ညီပါ (ဖိုင် ပြင်ထားနိုင်သည်)' };
  }

  const shortCode = String(manifest.deviceShortCode || 'UNKNOWN');
  const last = Number(readRaw(lastImportedKey(shortCode)) || '0');
  if (typeof window !== 'undefined' && manifest.exportSequence < last) {
    const ok = window.confirm(`ဤဖိုင်သည် ဟောင်းသော backup ဖြစ်နိုင်ပါသည် (sequence ${manifest.exportSequence} < ${last})။ ဆက်လုပ်မလား?`);
    if (!ok) return { success: false, message: 'ဖျက်သိမ်းလိုက်ပါသည်' };
  }

  const pv = previewRestore(entities);
  const summary = `ဝင်မယ်: ${pv.added} | ထပ်ပြီးသား: ${pv.same} | ပြင်မယ်: ${pv.updated} | ပိတ်ပြီးသား ကာလ (မထိ): ${pv.protectedCount} | ဖျက်ထားသော မှတ်တမ်း: ${pv.tombstones}`;

  let mode: RestoreMode;
  if (!pv.ledgerNotEmpty) {
    mode = 'fresh';
    if (!window.confirm(`ဒေတာသစ် (အလွတ်) ထဲသို့ သွင်းမည်။\n${summary}\nဆက်မလား?`)) return { success: false, message: 'ပယ်ဖျက်ပါသည်' };
  } else if (window.confirm(`ရှိပြီးသား ဒေတာနှင့် ပေါင်းစည်းမည် (OK) — Cancel ဖြင့် အစားထိုးမုဒ် ရွေးနိုင်\n${summary}`)) {
    mode = 'merge';
  } else if (window.confirm('လက်ရှိ ဒေတာ အားလုံးကို backup ဖြင့် အစားထိုးမည်။ သေချာပါသလား?')) {
    mode = 'replace';
  } else {
    return { success: false, message: 'ပယ်ဖျက်ပါသည်' };
  }

  await createRestorePoint('before-import', { source: 'backup-v2', mode });
  const written = applyRestore(entities, mode);
  localStorage.setItem(lastImportedKey(shortCode), String(Math.max(last, Number(manifest.exportSequence) || 0)));
  return { success: true, message: `Backup v2 (${mode}) ပြန်သွင်းပြီးပါပြီ — ${written} ခု` };
}

// ---------- B2: auto-backup at period close ----------

export const AUTO_DONE_PREFIX = 'auto_backup_done_v1_';

/** Monday (local, 00:00) of the week containing `d`, as YYYY-MM-DD. */
export function weekKeyOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export interface DuePeriod { game: '2D' | 'FB' | '3D'; periodKey: string; flag: string }

/**
 * Pure: which periods are due for an automatic backup at `now`.
 *  - 2D: week closes Friday 16:25 (local)
 *  - Football: week closes Sunday 23:00 (local)
 *  - 3D: each round whose status is no longer 'open' (closed/settled)
 */
export function computeDuePeriods(now: Date, rounds3d: Array<{ id: string; status?: string; drawDate?: string }>, doneFlags: Set<string>): DuePeriod[] {
  const out: DuePeriod[] = [];
  const wk = weekKeyOf(now);
  const day = now.getDay(); // 0 Sun .. 5 Fri
  const mins = now.getHours() * 60 + now.getMinutes();
  const isAfterFri = (day === 5 && mins >= 16 * 60 + 25) || day === 6 || day === 0;
  if (isAfterFri) {
    const flag2d = `${AUTO_DONE_PREFIX}2D_${wk}`;
    if (!doneFlags.has(flag2d)) out.push({ game: '2D', periodKey: wk, flag: flag2d });
  }
  const isAfterSun = day === 0 && mins >= 23 * 60;
  if (isAfterSun) {
    const flagFb = `${AUTO_DONE_PREFIX}FB_${wk}`;
    if (!doneFlags.has(flagFb)) out.push({ game: 'FB', periodKey: wk, flag: flagFb });
  }
  for (const r of rounds3d) {
    if (!r || !r.id || r.status === 'open' || !r.status) continue;
    const flag3 = `${AUTO_DONE_PREFIX}3D_${r.id}`;
    if (!doneFlags.has(flag3)) out.push({ game: '3D', periodKey: `${r.drawDate || 'nodate'}_${r.id}`, flag: flag3 });
  }
  return out;
}

const DIR_DB = 'shwe_backup_settings';
const openDb = (): Promise<IDBDatabase | null> => new Promise(resolve => {
  try {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DIR_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});

export async function storeAutoBackupFolder(handle: any): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'auto_dir');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getAutoBackupFolder(): Promise<any | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('auto_dir');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/** Run once per tick: create due auto backups (restore point always; file when a folder was granted). */
export async function runAutoBackupIfDue(pin: string, exportArmored: (pin: string) => Promise<string>): Promise<number> {
  if (typeof localStorage === 'undefined') return 0;
  const flags = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(AUTO_DONE_PREFIX)) flags.add(k);
  }
  const rounds = parseArr(readRaw('3d_ledger_rounds_v1')) as any[];
  const due = computeDuePeriods(new Date(), rounds, flags);
  if (due.length === 0) return 0;

  let folder: any = null;
  try { folder = await getAutoBackupFolder(); } catch { folder = null; }
  const shortCode = getDeviceShortCode();
  let done = 0;
  for (const p of due) {
    try {
      await createRestorePoint('auto', { game: p.game, periodKey: p.periodKey });
      if (folder) {
        const perm = await folder.queryPermission?.({ mode: 'readwrite' });
        if (perm !== 'granted') await folder.requestPermission?.({ mode: 'readwrite' });
        const content = await exportArmored(pin);
        const seq = readRaw(EXPORT_SEQUENCE_KEY) || '0';
        const name = `SMG_${p.game}_${p.periodKey}_${shortCode}_${seq}.rhmg`;
        const fh = await folder.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(content);
        await w.close();
        pruneOldAutoFiles(folder);
      }
      localStorage.setItem(p.flag, new Date().toISOString());
      done++;
    } catch (err: any) {
      localStorage.setItem('auto_backup_last_error', String(err?.message || err));
    }
  }
  return done;
}

/** Keeps the newest N auto files in the folder when `auto_backup_keep_v1` is configured. No default is applied. */
async function pruneOldAutoFiles(folder: any) {
  const keepRaw = readRaw('auto_backup_keep_v1');
  if (!keepRaw) return;
  const keep = Number(keepRaw);
  if (!Number.isFinite(keep) || keep < 1) return;
  const names: string[] = [];
  for await (const [name] of folder.entries()) if (String(name).startsWith('SMG_')) names.push(String(name));
  names.sort();
  const excess = names.length - keep;
  for (let i = 0; i < excess; i++) await folder.removeEntry(names[i]);
}

/** Starts the 60s auto-backup tick. Skipped entirely when no owner PIN is set (no PIN = no encrypted auto file). */
export function startAutoBackupTimer(getPin: () => string, exportArmored: (pin: string) => Promise<string>): () => void {
  if (typeof window === 'undefined') return () => {};
  const tick = async () => {
    const pin = getPin();
    if (!pin) return;
    try { await runAutoBackupIfDue(pin, exportArmored); } catch { /* recorded inside */ }
  };
  tick();
  const id = window.setInterval(tick, 60000);
  return () => window.clearInterval(id);
}
