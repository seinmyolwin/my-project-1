import { saveBatchTransactional } from './storage';

/**
 * Result structure of an atomic transaction
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rolledBack: boolean;
}

// Global in-memory submission cache with timestamps for idempotency
const recentSubmissionsCache = new Map<string, number>();

/**
 * Generates an idempotency fingerprint string for a voucher, settlement, or transaction.
 */
export function generateSubmissionFingerprint(context: string, payload: any): string {
  try {
    return `${context}:${JSON.stringify(payload)}`;
  } catch {
    return `${context}:${Date.now()}`;
  }
}

/**
 * Checks if a submission with the same fingerprint was executed within windowMs.
 * Automatically records the submission timestamp if not duplicate.
 */
export function isDuplicateSubmission(fingerprint: string, windowMs: number = 4000): boolean {
  const now = Date.now();
  const lastTime = recentSubmissionsCache.get(fingerprint);
  if (lastTime && (now - lastTime) < windowMs) {
    return true; // Duplicate detected within threshold!
  }
  recentSubmissionsCache.set(fingerprint, now);

  // Periodic cache cleanup
  if (recentSubmissionsCache.size > 200) {
    for (const [key, time] of recentSubmissionsCache.entries()) {
      if (now - time > windowMs * 2) {
        recentSubmissionsCache.delete(key);
      }
    }
  }
  return false;
}

/**
 * Executes a financial or ledger state mutation atomically.
 * Takes snapshots of target storage keys, attempts operation.
 * If any step or storage write fails, performs an automatic rollback of localStorage and notifies the caller.
 */
export function runAtomicTransaction<T>(
  action: () => { data: T; storageUpdates: Record<string, any> }
): TransactionResult<T> {
  try {
    const { data, storageUpdates } = action();
    const saveOk = saveBatchTransactional(storageUpdates);
    if (!saveOk) {
      return {
        success: false,
        rolledBack: true,
        error: 'Storage transaction failed. All financial changes were safely rolled back.'
      };
    }
    return {
      success: true,
      data,
      rolledBack: false
    };
  } catch (err: any) {
    console.error('Transaction execution failed:', err);
    return {
      success: false,
      rolledBack: true,
      error: err?.message || 'Transaction error occurred. Operations safely aborted.'
    };
  }
}
