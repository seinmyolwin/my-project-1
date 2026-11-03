import { createRestorePoint } from './restorePoints';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from './storage';

const MIGRATION_DONE_KEY = 'snapshot_migration_v2_done';

export async function runSnapshotMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;

  await createRestorePoint('before-migration');

  const keysToScan = [
    STORAGE_KEYS.VOUCHERS,
    STORAGE_KEYS.VOUCHERS_2D,
    STORAGE_KEYS.SLIPS_FOOTBALL,
    STORAGE_KEYS.FORWARD_SLIPS,
    STORAGE_KEYS.FORWARD_SLIPS_2D,
    STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL,
    'shwe_mingalar_copied_raw_texts',
    'shwe_master_agents_list'
  ];

  keysToScan.forEach(key => {
    let data = loadStoredData(key, []);
    if (!data) return;

    // Purge Phone and Add Snapshots
    const processItem = (item: any) => {
      // Purge Phone
      if (item.customerPhone) delete item.customerPhone;
      
      // Snapshot Logic (if missing)
      if (!item.snapshotSource) {
        if (key.includes('FOOTBALL') || key.includes('SLIPS_FOOTBALL')) {
          item.payoutOdds = 1.9; // Default fallback
        } else {
          item.lowerCommissionRate = 0;
          item.payoutMultiplier = 80; // Should be fetched from settings ideally
        }
        item.snapshotSource = 'migrated';
      }
      return item;
    };

    if (Array.isArray(data)) {
        data = data.map(processItem);
    } else if (typeof data === 'object') {
        processItem(data);
    }

    saveStoredData(key, data);
  });

  localStorage.setItem(MIGRATION_DONE_KEY, 'true');
}
