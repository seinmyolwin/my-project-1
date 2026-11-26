/**
 * ID Migration & Tablet Update Recovery Utility
 * Migrates old Date.now()+random IDs to UUID v4 while maintaining references,
 * and safely heals any orphaned references or missing closed/settled records
 * caused by prior startup race conditions or quota limits.
 */
import {
  generateUUID,
  createRestorePoint,
  listRestorePoints,
  offloadLocalRestorePointsToIndexedDB
} from './restorePoints';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from './storage';

const MIGRATION_DONE_KEY = 'id_migration_v1_done';
const MIGRATION_MAP_KEY = 'id_migration_map_v1';
const FORWARD_ALL_RESTORE_CHECK_KEY = 'forward_all_restore_check_v1';

const ALL_ENTITY_KEYS = [
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

const CRITICAL_ARRAY_KEYS = [
  STORAGE_KEYS.ROUNDS,
  STORAGE_KEYS.ROUNDS_2D,
  STORAGE_KEYS.VOUCHERS,
  STORAGE_KEYS.VOUCHERS_2D,
  STORAGE_KEYS.FORWARD_SLIPS,
  STORAGE_KEYS.FORWARD_SLIPS_2D,
  STORAGE_KEYS.MATCHES_FOOTBALL,
  STORAGE_KEYS.SLIPS_FOOTBALL,
  STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL
];

function readMigrationMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MIGRATION_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readRawArray(key: string): any[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function remapNodeWithMap(data: any, map: Record<string, string>): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => remapNodeWithMap(item, map));
  }
  if (typeof data === 'object') {
    const newNode: any = { ...data };
    for (const [key, val] of Object.entries(newNode)) {
      if ((key === 'id' || key.endsWith('Id')) && typeof val === 'string' && map[val]) {
        newNode[key] = map[val];
      } else {
        newNode[key] = remapNodeWithMap(val, map);
      }
    }
    return newNode;
  }
  return data;
}

export async function runIdMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;

  try {
    await createRestorePoint('before-migration', { action: 'id-migration' });
  } catch (rpErr) {
    console.warn('[idMigration] Pre-migration restore point skipped/warned:', rpErr);
  }

  const newMap: Record<string, string> = readMigrationMap();

  // 1. Collect all existing legacy non-UUID IDs across primary keys
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

  ALL_ENTITY_KEYS.forEach(key => {
    const data = loadStoredData(key, []);
    collect(data);
  });

  // 2. Apply migration cleanly without ever throwing on legacy/deleted orphan references
  ALL_ENTITY_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const data = loadStoredData(key, []);
    const migratedData = remapNodeWithMap(data, newMap);
    saveStoredData(key, migratedData);
  });

  // Migrate active round IDs if they were legacy IDs
  [STORAGE_KEYS.ACTIVE_ROUND_ID, STORAGE_KEYS.ACTIVE_ROUND_ID_2D].forEach(activeKey => {
    const activeVal = loadStoredData<string>(activeKey, '');
    if (activeVal && newMap[activeVal]) {
      saveStoredData(activeKey, newMap[activeVal]);
    }
  });

  try {
    localStorage.setItem(MIGRATION_MAP_KEY, JSON.stringify(newMap));
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
  } catch (err) {
    console.warn('[idMigration] Failed to persist migration flag:', err);
  }
}

function mergePreferMoreCompleteRound(primaryItem: any, backupItem: any): any {
  if (!primaryItem) return backupItem;
  if (!backupItem) return primaryItem;
  if (primaryItem.reopenedForEdit) return primaryItem;

  const primaryClosedOrSettled = primaryItem.status === 'settled' || primaryItem.status === 'closed';
  const backupClosedOrSettled = backupItem.status === 'settled' || backupItem.status === 'closed';

  // If primary lost its settled/closed status or winningNumber while backup preserved it, restore it
  if (backupClosedOrSettled && !primaryClosedOrSettled && !primaryItem.winningNumber) {
    return {
      ...primaryItem,
      ...backupItem
    };
  }
  if (!primaryItem.winningNumber && backupItem.winningNumber && !primaryItem.reopenedForEdit) {
    return {
      ...primaryItem,
      winningNumber: backupItem.winningNumber,
      status: backupItem.status || primaryItem.status,
      settledAt: backupItem.settledAt || primaryItem.settledAt,
      firstSettledAt: backupItem.firstSettledAt || primaryItem.firstSettledAt,
      multiplier: backupItem.multiplier ?? primaryItem.multiplier,
      toddMultiplier: backupItem.toddMultiplier ?? primaryItem.toddMultiplier
    };
  }
  return primaryItem;
}

/**
 * Idempotent startup healing that runs BEFORE React data contexts mount:
 * 1. Frees bloated localStorage restore_points_v1 into IndexedDB.
 * 2. Re-links any stale pre-migration IDs left behind by the prior provider mount race.
 * 3. Safely restores non-deleted closed/settled records missing from primary if present in _backup.
 * 4. Restores legitimate "Forwarded all" slips if deleted by the prior forward_all_*_cleanup_v1 filter.
 */
export async function healMigratedReferencesAndBackups(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // 1. Reclaim tablet localStorage space from legacy restore_points_v1
    await offloadLocalRestorePointsToIndexedDB();

    const oldToNew = readMigrationMap();
    const hasMap = Object.keys(oldToNew).length > 0;

    // 2. Recover any missing non-deleted records from *_backup into primary
    for (const key of CRITICAL_ARRAY_KEYS) {
      const primary = readRawArray(key);
      const backup = readRawArray(`${key}_backup`);
      if (!backup || backup.length === 0) continue;

      if (primary === null) {
        saveStoredData(key, hasMap ? remapNodeWithMap(backup, oldToNew) : backup);
        continue;
      }

      // Normalize IDs when comparing so pre-migration IDs in _backup aren't duplicated
      const normalizeId = (id: any) => (typeof id === 'string' && oldToNew[id] ? oldToNew[id] : id);
      const primaryById = new Map<string, number>();
      primary.forEach((item, idx) => {
        if (item && typeof item === 'object' && item.id) {
          primaryById.set(String(normalizeId(item.id)), idx);
        }
      });

      const nextPrimary = [...primary];
      let modified = false;

      for (const backupItem of backup) {
        if (!backupItem || typeof backupItem !== 'object' || !backupItem.id) continue;
        if (backupItem.deletedAt) continue;

        const normId = String(normalizeId(backupItem.id));
        const existingIdx = primaryById.get(normId);
        if (existingIdx === undefined) {
          // Only restore if primary does not contain it (neither active nor tombstoned)
          const mappedItem = hasMap ? remapNodeWithMap(backupItem, oldToNew) : backupItem;
          nextPrimary.push(mappedItem);
          primaryById.set(normId, nextPrimary.length - 1);
          modified = true;
        } else if (key === STORAGE_KEYS.ROUNDS || key === STORAGE_KEYS.ROUNDS_2D || key === STORAGE_KEYS.MATCHES_FOOTBALL) {
          const merged = mergePreferMoreCompleteRound(nextPrimary[existingIdx], backupItem);
          if (merged !== nextPrimary[existingIdx]) {
            nextPrimary[existingIdx] = merged;
            modified = true;
          }
        }
      }

      if (modified) {
        saveStoredData(key, nextPrimary);
      }
    }

    // 3. Re-link any stale IDs left behind by the prior mount race using id_migration_map_v1
    if (hasMap) {
      const newToOld: Record<string, string> = {};
      for (const [oldId, newId] of Object.entries(oldToNew)) {
        newToOld[newId] = oldId;
      }

      // Pass A: Normalize all entity `id` fields first and deduplicate (preferring settled/closed rounds)
      const normalizedStore = new Map<string, any[]>();
      const entityChanged = new Map<string, boolean>();

      for (const key of ALL_ENTITY_KEYS) {
        const arr = readRawArray(key);
        if (!arr || arr.length === 0) continue;

        let changed = false;
        const byId = new Map<string, number>();
        const normalized: any[] = [];
        const isRoundLike =
          key === STORAGE_KEYS.ROUNDS ||
          key === STORAGE_KEYS.ROUNDS_2D ||
          key === STORAGE_KEYS.MATCHES_FOOTBALL;

        for (const item of arr) {
          if (!item || typeof item !== 'object') {
            normalized.push(item);
            continue;
          }
          let updated = item;
          if (typeof item.id === 'string' && oldToNew[item.id]) {
            updated = { ...item, id: oldToNew[item.id] };
            changed = true;
          }

          if (updated.id && typeof updated.id === 'string') {
            const existingIdx = byId.get(updated.id);
            if (existingIdx !== undefined) {
              changed = true;
              if (isRoundLike) {
                normalized[existingIdx] = mergePreferMoreCompleteRound(normalized[existingIdx], updated);
              }
              continue;
            }
            byId.set(updated.id, normalized.length);
          }
          normalized.push(updated);
        }

        normalizedStore.set(key, normalized);
        entityChanged.set(key, changed);
      }

      // Collect parent IDs AFTER Pass A normalization so parent sets are exact
      const collectNormalizedIds = (key: string): Set<string> => {
        const arr = normalizedStore.get(key) || [];
        const s = new Set<string>();
        arr.forEach(item => {
          if (item?.id) s.add(String(item.id));
        });
        return s;
      };

      const roundIds3D = collectNormalizedIds(STORAGE_KEYS.ROUNDS);
      const roundIds2D = collectNormalizedIds(STORAGE_KEYS.ROUNDS_2D);
      const matchIdsFB = collectNormalizedIds(STORAGE_KEYS.MATCHES_FOOTBALL);
      const slipIdsFB = collectNormalizedIds(STORAGE_KEYS.SLIPS_FOOTBALL);

      // Pass B: Resolve child reference fields against normalized parent sets
      const resolveRef = (val: any, parentIds?: Set<string>): any => {
        if (typeof val !== 'string') return val;
        if (oldToNew[val]) {
          if (!parentIds || parentIds.has(oldToNew[val]) || !parentIds.has(val)) {
            return oldToNew[val];
          }
        }
        if (newToOld[val] && parentIds && !parentIds.has(val) && parentIds.has(newToOld[val])) {
          return newToOld[val];
        }
        return val;
      };

      for (const key of ALL_ENTITY_KEYS) {
        const arr = normalizedStore.get(key);
        if (!arr || arr.length === 0) continue;

        let changed = entityChanged.get(key) || false;
        const healed = arr.map(item => {
          if (!item || typeof item !== 'object') return item;
          let updated: any = null;
          const ensureCopy = () => {
            if (!updated) updated = { ...item };
            return updated;
          };

          if (typeof item.roundId === 'string') {
            const pSet =
              key === STORAGE_KEYS.VOUCHERS || key === STORAGE_KEYS.FORWARD_SLIPS
                ? roundIds3D
                : key === STORAGE_KEYS.VOUCHERS_2D || key === STORAGE_KEYS.FORWARD_SLIPS_2D
                ? roundIds2D
                : undefined;
            const nextRef = resolveRef(item.roundId, pSet);
            if (nextRef !== item.roundId) {
              ensureCopy().roundId = nextRef;
              changed = true;
            }
          }
          if (typeof item.matchId === 'string') {
            const nextRef = resolveRef(item.matchId, matchIdsFB);
            if (nextRef !== item.matchId) {
              ensureCopy().matchId = nextRef;
              changed = true;
            }
          }
          if (typeof item.slipId === 'string') {
            const nextRef = resolveRef(item.slipId, slipIdsFB);
            if (nextRef !== item.slipId) {
              ensureCopy().slipId = nextRef;
              changed = true;
            }
          }
          if (Array.isArray(item.selections)) {
            let selChanged = false;
            const nextSelections = item.selections.map((sel: any) => {
              if (sel && typeof sel.matchId === 'string') {
                const nextRef = resolveRef(sel.matchId, matchIdsFB);
                if (nextRef !== sel.matchId) {
                  selChanged = true;
                  return { ...sel, matchId: nextRef };
                }
              }
              return sel;
            });
            if (selChanged) {
              ensureCopy().selections = nextSelections;
              changed = true;
            }
          }

          return updated || item;
        });

        if (changed) {
          saveStoredData(key, healed);
        }
      }

      [STORAGE_KEYS.ACTIVE_ROUND_ID, STORAGE_KEYS.ACTIVE_ROUND_ID_2D].forEach(activeKey => {
        const activeVal = loadStoredData<string>(activeKey, '');
        if (activeVal && oldToNew[activeVal]) {
          saveStoredData(activeKey, oldToNew[activeVal]);
        }
      });
    }

    // 4. Recover legitimate "Forwarded all" slips deleted by prior forward_all_*_cleanup_v1 migration
    const hadForwardCleanup =
      localStorage.getItem('forward_all_3d_cleanup_v1') === 'true' ||
      localStorage.getItem('forward_all_2d_cleanup_v1') === 'true';

    if (hadForwardCleanup && localStorage.getItem(FORWARD_ALL_RESTORE_CHECK_KEY) !== 'true') {
      try {
        const points = await listRestorePoints();
        const isForwardAllNote = (notes: any) =>
          notes === 'ရှိသမျှအကွက်အားလုံး အထက်ဒိုင်တင်ခြင်း' || notes === 'Forwarded all bets';

        const recoverForKey = (fwdKey: string) => {
          const current = readRawArray(fwdKey) || [];
          const existingIds = new Set(current.map(x => x?.id).filter(Boolean));
          let added = false;

          for (const pt of points) {
            const rawSnap = pt.keys?.[fwdKey];
            if (!rawSnap) continue;
            try {
              const parsedSnap = JSON.parse(rawSnap);
              if (!Array.isArray(parsedSnap)) continue;
              for (const item of parsedSnap) {
                if (!item || item.deletedAt || !isForwardAllNote(item.notes)) continue;
                const mapped = hasMap ? remapNodeWithMap(item, oldToNew) : item;
                if (mapped.id && !existingIds.has(mapped.id)) {
                  current.push(mapped);
                  existingIds.add(mapped.id);
                  added = true;
                }
              }
            } catch {
              // ignore malformed snapshot slice
            }
          }

          if (added) {
            saveStoredData(fwdKey, current);
          }
        };

        recoverForKey(STORAGE_KEYS.FORWARD_SLIPS);
        recoverForKey(STORAGE_KEYS.FORWARD_SLIPS_2D);
        localStorage.setItem(FORWARD_ALL_RESTORE_CHECK_KEY, 'true');
      } catch (err) {
        console.warn('[dataRecovery] Forward-all recovery check skipped:', err);
      }
    }
  } catch (err) {
    console.warn('[dataRecovery] Startup healing encountered a non-fatal warning:', err);
  }
}

