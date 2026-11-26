/**
 * ID Migration Utility (Part 1)
 * Migrates old Date.now()+random IDs to UUID v4 while maintaining references.
 */
import { generateUUID, createRestorePoint } from './restorePoints';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from './storage';

const MIGRATION_DONE_KEY = 'id_migration_v1_done';
const MIGRATION_MAP_KEY = 'id_migration_map_v1';

export async function runIdMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;

  await createRestorePoint('before-migration');

  const newMap: Record<string, string> = {};

  // List of keys to scan
  const keysToScan = [
    STORAGE_KEYS.ROUNDS,
    STORAGE_KEYS.ROUNDS_2D,
    STORAGE_KEYS.VOUCHERS,
    STORAGE_KEYS.VOUCHERS_2D,
    STORAGE_KEYS.FORWARD_SLIPS,
    STORAGE_KEYS.FORWARD_SLIPS_2D,
    STORAGE_KEYS.MATCHES_FOOTBALL,
    STORAGE_KEYS.SLIPS_FOOTBALL,
    STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL,
    STORAGE_KEYS.LEAGUES_FOOTBALL,
    'shwe_mingalar_copied_raw_texts'
  ];

  // 1. Collect all existing IDs
  const collect = (data: any) => {
    if (!data) return;
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item && typeof item === 'object' && item.id && typeof item.id === 'string' && !item.id.includes('-')) {
          if (!newMap[item.id]) newMap[item.id] = generateUUID();
        }
        collect(item);
      });
    } else if (typeof data === 'object') {
      Object.values(data).forEach(collect);
    }
  };

  keysToScan.forEach(key => {
    const data = loadStoredData(key, []);
    collect(data);
  });

  // 2. Perform replacement
  const migrate = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map(migrate);
    } else if (typeof data === 'object') {
      const newNode: any = { ...data };
      for (const [key, val] of Object.entries(newNode)) {
        if (key.endsWith('Id') && typeof val === 'string' && newMap[val]) {
          newNode[key] = newMap[val];
        } else if (key === 'id' && typeof val === 'string' && newMap[val]) {
          newNode[key] = newMap[val];
        } else {
          newNode[key] = migrate(val);
        }
      }
      return newNode;
    }
    return data;
  };

  // Apply migration
  keysToScan.forEach(key => {
    const data = loadStoredData(key, []);
    const migratedData = migrate(data);
    saveStoredData(key, migratedData);
  });

  // Update active round IDs if their IDs were migrated
  [STORAGE_KEYS.ACTIVE_ROUND_ID, STORAGE_KEYS.ACTIVE_ROUND_ID_2D].forEach(activeKey => {
    const rawActive = loadStoredData<string>(activeKey, '');
    if (rawActive && newMap[rawActive]) {
      saveStoredData(activeKey, newMap[rawActive]);
    }
  });

  // 3. Final Verification (Orphans - warn only so boot is never blocked)
  const verify = (node: any): boolean => {
    if (!node) return true;
    if (Array.isArray(node)) {
      return node.every(verify);
    } else if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (key.endsWith('Id') && typeof val === 'string') {
          if (val && !val.includes('-') && !newMap[val]) {
            console.warn('[idMigration] Non-UUID reference preserved:', key, val);
          }
        }
        verify(val);
      }
    }
    return true;
  };

  keysToScan.forEach(key => verify(loadStoredData(key, [])));

  localStorage.setItem(MIGRATION_MAP_KEY, JSON.stringify(newMap));
  localStorage.setItem(MIGRATION_DONE_KEY, 'true');
}

/**
 * Non-destructive startup healer:
 * 1) Recovers empty primary ledger arrays from `${key}_backup` if backup has items.
 * 2) Re-maps any lingering legacy IDs found in `id_migration_map_v1`.
 */
export async function healMigratedReferencesAndBackups(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const ledgerArrayKeys = [
    STORAGE_KEYS.ROUNDS,
    STORAGE_KEYS.ROUNDS_2D,
    STORAGE_KEYS.VOUCHERS,
    STORAGE_KEYS.VOUCHERS_2D,
    STORAGE_KEYS.FORWARD_SLIPS,
    STORAGE_KEYS.FORWARD_SLIPS_2D,
    STORAGE_KEYS.MATCHES_FOOTBALL,
    STORAGE_KEYS.SLIPS_FOOTBALL,
    STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL,
    STORAGE_KEYS.LEAGUES_FOOTBALL,
  ];

  // 1. Heal empty/missing primary keys from *_backup mirrors
  for (const key of ledgerArrayKeys) {
    try {
      const primaryRaw = localStorage.getItem(key);
      const backupRaw = localStorage.getItem(`${key}_backup`);
      if (!backupRaw) continue;

      const backupParsed = JSON.parse(backupRaw);
      if (!Array.isArray(backupParsed) || backupParsed.length === 0) continue;

      let primaryEmpty = !primaryRaw;
      if (primaryRaw) {
        try {
          const primaryParsed = JSON.parse(primaryRaw);
          if (Array.isArray(primaryParsed) && primaryParsed.length === 0) {
            primaryEmpty = true;
          }
        } catch {
          primaryEmpty = true;
        }
      }

      if (primaryEmpty) {
        console.warn(`[healBackups] Recovering empty primary "${key}" from "${key}_backup" (${backupParsed.length} items).`);
        localStorage.setItem(key, backupRaw);
      }
    } catch {
      // ignore parse errors on individual keys
    }
  }

  // 2. Apply any stored id_migration_map_v1 mappings to unmigrated references
  let idMap: Record<string, string> = {};
  try {
    const mapRaw = localStorage.getItem(MIGRATION_MAP_KEY);
    if (mapRaw) {
      const parsed = JSON.parse(mapRaw);
      if (parsed && typeof parsed === 'object') idMap = parsed;
    }
  } catch {
    return;
  }

  if (Object.keys(idMap).length === 0) return;

  const remapNode = (node: any): { changed: boolean; value: any } => {
    if (!node) return { changed: false, value: node };
    if (Array.isArray(node)) {
      let anyChanged = false;
      const mapped = node.map((item) => {
        const res = remapNode(item);
        if (res.changed) anyChanged = true;
        return res.value;
      });
      return { changed: anyChanged, value: anyChanged ? mapped : node };
    }
    if (typeof node === 'object') {
      let objChanged = false;
      const out: any = { ...node };
      for (const [k, v] of Object.entries(out)) {
        if ((k === 'id' || k.endsWith('Id')) && typeof v === 'string' && idMap[v]) {
          out[k] = idMap[v];
          objChanged = true;
        } else if (v && typeof v === 'object') {
          const nested = remapNode(v);
          if (nested.changed) {
            out[k] = nested.value;
            objChanged = true;
          }
        }
      }
      return { changed: objChanged, value: objChanged ? out : node };
    }
    return { changed: false, value: node };
  };

  for (const key of [...ledgerArrayKeys, 'shwe_mingalar_copied_raw_texts']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const res = remapNode(parsed);
      if (res.changed) {
        saveStoredData(key, res.value);
      }
    } catch {
      // ignore
    }
  }

  for (const activeKey of [STORAGE_KEYS.ACTIVE_ROUND_ID, STORAGE_KEYS.ACTIVE_ROUND_ID_2D]) {
    try {
      const rawActive = loadStoredData<string>(activeKey, '');
      if (rawActive && idMap[rawActive]) {
        saveStoredData(activeKey, idMap[rawActive]);
      }
    } catch {
      // ignore
    }
  }
}

