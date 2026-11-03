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

  const oldMap: Record<string, string> = {};
  const newMap: Record<string, string> = {};

  // 1. Collect all existing IDs
  const collect = (data: any) => {
    if (!data) return;
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.id && !item.id.includes('-')) { // Old ID heuristic
          if (!newMap[item.id]) newMap[item.id] = generateUUID();
        }
        collect(item);
      });
    } else if (typeof data === 'object') {
      Object.values(data).forEach(collect);
    }
  };

  // List of keys to scan
  const keysToScan = [
    STORAGE_KEYS.VOUCHERS,
    STORAGE_KEYS.VOUCHERS_2D,
    STORAGE_KEYS.SLIPS_FOOTBALL,
    STORAGE_KEYS.MATCHES_FOOTBALL,
    'shwe_mingalar_copied_raw_texts'
  ];

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
  const verify = (data: any, root: any): boolean => {
    const check = (node: any) => {
      if (!node) return true;
      if (typeof node === 'object') {
        for (const [key, val] of Object.entries(node)) {
          if (key.endsWith('Id') && typeof val === 'string') {
             // If it looks like an old ID (heuristic) and not in our map, it's an orphan
             if (!val.includes('-') && !newMap[val]) {
               console.error('Orphaned reference found:', key, val);
               return false;
             }
          }
          if (!check(val)) return false;
        }
      } else if (Array.isArray(node)) {
        return node.every(check);
      }
      return true;
    };
    return check(data);
  };

  if (!keysToScan.every(key => verify(loadStoredData(key, []), null))) {
    throw new Error('Migration failed: Orphaned references found.');
  }

  localStorage.setItem(MIGRATION_MAP_KEY, JSON.stringify(newMap));
  localStorage.setItem(MIGRATION_DONE_KEY, 'true');
}
