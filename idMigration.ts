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

  // 3. Final Verification (Orphans)
  const verify = (node: any): boolean => {
    if (!node) return true;
    if (Array.isArray(node)) {
      return node.every(verify);
    } else if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (key.endsWith('Id') && typeof val === 'string') {
          if (!val.includes('-') && !newMap[val]) {
            console.error('Orphaned reference found:', key, val);
            return false;
          }
        }
        if (!verify(val)) return false;
      }
    }
    return true;
  };

  if (!keysToScan.every(key => verify(loadStoredData(key, [])))) {
    throw new Error('Migration failed: Orphaned references found.');
  }

  localStorage.setItem(MIGRATION_MAP_KEY, JSON.stringify(newMap));
  localStorage.setItem(MIGRATION_DONE_KEY, 'true');
}
