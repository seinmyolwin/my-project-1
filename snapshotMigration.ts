import { createRestorePoint } from './restorePoints';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from './storage';

const MIGRATION_DONE_KEY = 'snapshot_migration_v2_done';

export async function runSnapshotMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;

  await createRestorePoint('before-migration');

  const settings3D = loadStoredData(STORAGE_KEYS.SETTINGS, { defaultMultiplier: 600, defaultCommissionRate: 10 });
  const settings2D = loadStoredData(STORAGE_KEYS.SETTINGS_2D, { defaultMultiplier: 80, defaultCommissionRate: 12 });

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

    const processItem = (item: any) => {
      // Purge Phone
      if (item.customerPhone) delete item.customerPhone;

      // Snapshot Logic
      if (!item.snapshotSource) {
        // No invented defaults: copy owner settings as-is. Missing values stay missing
        // and the record is flagged so settlement can refuse it until the owner sets them.
        let missing = false;
        if (key.includes('3d') || key === STORAGE_KEYS.VOUCHERS) {
          const c = settings3D.defaultCommissionRate, m = settings3D.defaultMultiplier;
          if (c == null || m == null) missing = true;
          item.lowerCommissionRate = c;
          item.payoutMultiplier = m;
        } else if (key.includes('2d') || key === STORAGE_KEYS.VOUCHERS_2D) {
          const c = settings2D.defaultCommissionRate, m = settings2D.defaultMultiplier;
          if (c == null || m == null) missing = true;
          item.lowerCommissionRate = c;
          item.payoutMultiplier = m;
        } else if (key.includes('football') || key === STORAGE_KEYS.SLIPS_FOOTBALL) {
          if (item.combinedOdds == null) missing = true;
          item.payoutOdds = item.combinedOdds;
        }
        item.snapshotSource = missing ? 'migrated-missing-settings' : 'migrated';
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
