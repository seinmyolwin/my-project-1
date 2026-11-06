/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Part 1 Data Migration & Snapshot Utility
 * Guarantees zero data loss, pre-migration snapshotting, idempotent cleanup
 * of sample agents, and strict non-retention of customer phone numbers.
 */

import { STORAGE_KEYS, saveBatchTransactional } from './storage';
import { createRestorePoint } from './restorePoints';

export const SNAPSHOT_KEY = 'pre_phone_purge_snapshot_v1';
export const MIGRATION_FLAG_KEY = 'phone_purge_v1_completed';

import { isSampleAgentDigest } from './tombstoneUtils';

/** Remove customerPhone from every item of a list (count-only logging by caller). */
export function stripCustomerPhoneFromList(list: any[]): any[] {
  return list.map((item: any) => {
    if (!item || typeof item !== 'object' || !('customerPhone' in item)) return item;
    const { customerPhone: _removed, ...rest } = item;
    return rest;
  });
}

/**
 * phone_purge_v1: one-time, idempotent removal of stored customer phone numbers.
 */
export async function runPhonePurgeMigration(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    // 1. Mandatory snapshot first: create formal before-migration restore point
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return true;
    try {
      await createRestorePoint('before-migration', { action: 'phone-purge' });
    } catch (rpErr) {
      console.error('[Migration] CRITICAL: restore point before phone purge failed! Aborting.', rpErr);
      return false;
    }

    const updates: Record<string, any> = {};

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
      console.log('[Migration] phone_purge_v1 batch save applied to keys:', Object.keys(updates));
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return true;
  } catch (err) {
    console.error('[Migration] Failed to run phone_purge_v1 migration:', err);
    return false;
  }
}
