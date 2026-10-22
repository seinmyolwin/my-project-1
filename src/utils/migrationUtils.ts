/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Part 1 Data Migration & Snapshot Utility
 * Guarantees zero data loss, pre-migration snapshotting, idempotent cleanup
 * of sample agents, and strict non-retention of customer phone numbers.
 */

import { STORAGE_KEYS, saveBatchTransactional } from './storage';

export const SNAPSHOT_KEY = 'pre_migration_snapshot_v1';
export const MIGRATION_FLAG_KEY = 'part1_migration_completed_v1';

export const SAMPLE_MASTER_AGENT_NAMES = [
  'ကိုမင်းအောင် (ဒိုင်ကြီး)',
  'ဒေါ်ခင်သန်း (ရန်ကုန်ဒိုင်ချုပ်)',
  'ဦးဘုန်း (မန္တလေးဒိုင်ကြီး)',
  'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
  'ကိုစိုးနိုင်',
  'ကိုမင်းအောင်',
  'ဒေါ်ခင်သန်း',
  'ဦးဘုန်း'
];

export const SAMPLE_MASTER_AGENT_PHONES = [
  '09-790002222',
  '09-450003333',
  '09-250004444',
  '09-970001111'
];

/**
 * Takes snapshot of current localStorage prior to any mutations.
 * Never deleted or overwritten once created.
 */
export function takePreMigrationSnapshot(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    
    // If snapshot already exists, preserve it untouched
    if (localStorage.getItem(SNAPSHOT_KEY)) {
      return true;
    }

    const snapshotData: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        key.startsWith('3d_ledger_') ||
        key.startsWith('2d_ledger_') ||
        key.startsWith('football_ledger_') ||
        key === 'shwe_master_agents_list' ||
        key === 'bookie_custom_command_rules_v2' ||
        key.startsWith('shwe_mingalar_raw_') ||
        key === 'shwe_mingalar_copied_raw_texts' ||
        key.startsWith('shwe_mingalar_')
      ) {
        snapshotData[key] = localStorage.getItem(key);
      }
    }

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshotData));
    console.log('[Snapshot] Successfully captured pre_migration_snapshot_v1 with', Object.keys(snapshotData).length, 'keys');
    return true;
  } catch (err) {
    console.error('[Snapshot] Failed to capture pre_migration_snapshot_v1:', err);
    return false;
  }
}

/**
 * Strips customerPhone field from any voucher / slip / raw clip / order array
 */
export function stripCustomerPhoneFromList<T extends Record<string, any>>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (!item || typeof item !== 'object') return item;
    const { customerPhone, ...rest } = item;
    return rest as T;
  });
}

/**
 * Checks if a name or phone matches the sample master agent credentials
 */
export function isSampleMasterAgent(name?: string, phone?: string): boolean {
  if (name && SAMPLE_MASTER_AGENT_NAMES.some(s => s === name.trim())) return true;
  if (phone && SAMPLE_MASTER_AGENT_PHONES.some(p => p === phone.trim())) return true;
  return false;
}

/**
 * Runs Part 1 migration idempotently:
 * 1. Takes pre-migration snapshot
 * 2. Cleans sample master agents from shwe_master_agents_list and settings
 * 3. Strips customerPhone from all stored vouchers, slips, raw clips, and orders
 * 4. Saves changes atomically
 */
export function runPart1Migration(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    // 1. Mandatory snapshot first
    takePreMigrationSnapshot();

    const updates: Record<string, any> = {};

    // 2. Clean sample agents in shwe_master_agents_list
    const rawAgents = localStorage.getItem('shwe_master_agents_list');
    if (rawAgents) {
      try {
        const parsedAgents = JSON.parse(rawAgents);
        if (Array.isArray(parsedAgents)) {
          const filtered = parsedAgents.filter(
            (a: any) => !isSampleMasterAgent(a?.name, a?.phone)
          );
          updates['shwe_master_agents_list'] = filtered;
        }
      } catch {
        // ignore
      }
    }

    // 3. Clean defaultMasterAgent from 3D, 2D, Football settings
    const cleanSettingsAgent = (key: string) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          let changed = false;
          if (isSampleMasterAgent(s.defaultMasterAgentName, s.defaultMasterAgentPhone)) {
            delete s.defaultMasterAgentName;
            delete s.defaultMasterAgentPhone;
            changed = true;
          }
          if (changed) {
            updates[key] = s;
          }
        } catch {
          // ignore
        }
      }
    };

    cleanSettingsAgent(STORAGE_KEYS.SETTINGS);
    cleanSettingsAgent(STORAGE_KEYS.SETTINGS_2D);
    cleanSettingsAgent(STORAGE_KEYS.SETTINGS_FOOTBALL);

    // 4. Strip customerPhone from vouchers & slips
    const stripKey = (key: string) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const hasPhone = parsed.some((item: any) => item && 'customerPhone' in item);
            if (hasPhone) {
              updates[key] = stripCustomerPhoneFromList(parsed);
            }
          }
        } catch {
          // ignore
        }
      }
    };

    stripKey(STORAGE_KEYS.VOUCHERS);
    stripKey(`${STORAGE_KEYS.VOUCHERS}_backup`);
    stripKey(STORAGE_KEYS.VOUCHERS_2D);
    stripKey(`${STORAGE_KEYS.VOUCHERS_2D}_backup`);
    stripKey(STORAGE_KEYS.SLIPS_FOOTBALL);
    stripKey(`${STORAGE_KEYS.SLIPS_FOOTBALL}_backup`);
    stripKey('shwe_mingalar_copied_raw_texts');
    stripKey('shwe_mingalar_telegram_orders');

    // 5. Atomic save
    if (Object.keys(updates).length > 0) {
      saveBatchTransactional(updates);
      console.log('[Migration] Part 1 atomic batch save applied to keys:', Object.keys(updates));
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return true;
  } catch (err) {
    console.error('[Migration] Failed to run Part 1 migration:', err);
    return false;
  }
}
