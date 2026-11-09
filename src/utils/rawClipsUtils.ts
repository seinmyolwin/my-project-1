import { generateUUID } from './restorePoints';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone dedicated storage for original copied/pasted bet texts (မူရင်းစာသားများ)
 * Isolated from financial ledger, odds, and game calculation engines.
 */

export interface RawBetClip {
  id: string;
  category: '3d' | '2d' | 'football';
  roundId: string;
  roundName: string;
  date: string; // YYYY-MM-DD
  time: string; // hh:mm A
  timestamp: number;
  voucherNumber: string; // e.g. "ဘောင်ချာ (၁)", "ဘောင်ချာ (၂)", "V-0001"
  customerName: string;
  customerPhone?: string;
  rawText: string;
  itemCount: number;
  totalAmountPreview?: number;
  source?: 'batch_paste' | 'direct_paste' | 'telegram' | 'ocr';
}

const STORAGE_KEY = 'shwe_mingalar_copied_raw_texts';

/** All stored clips including tombstones (used by every write path). */
export function readAllRawClips(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read raw clips:', err);
  }
  return [];
}

/** Visible clips for the UI: tombstoned clips are hidden, customer phone never returned. */
export function getRawClips(): RawBetClip[] {
  return readAllRawClips()
    .filter((item: any) => item && !item.deletedAt)
    .map((item: any) => {
      if (item && 'customerPhone' in item) {
        const { customerPhone, ...clean } = item;
        return clean as RawBetClip;
      }
      return item as RawBetClip;
    });
}

/** Tombstones every stored clip matching `pred` (nothing is physically removed). */
function tombstoneRawClips(pred: (c: any) => boolean, reason: string): void {
  const nowIso = new Date().toISOString();
  const updated = readAllRawClips().map((c: any) =>
    c && !c.deletedAt && pred(c) ? { ...c, deletedAt: nowIso, deletedReason: reason } : c);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to tombstone raw clips:', err);
  }
}

export function saveRawClip(clipData: Omit<RawBetClip, 'id' | 'timestamp'>): RawBetClip {
  const clips = getRawClips();
  const { customerPhone, ...rest } = clipData;
  const newClip: RawBetClip = {
    ...rest,
    id: `clip-${generateUUID()}`,
    timestamp: Date.now()
  };

  const updated = [newClip, ...clips];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated', { detail: { newClip } }));
  } catch (err) {
    console.error('Failed to save raw clip:', err);
  }
  return newClip;
}

export function updateRawClipCustomerName(voucherNumberOrId: string, newCustomerName: string): void {
  try {
    const raw = readAllRawClips();
    const updated = raw.map((c: any) => {
      if (c && (c.voucherNumber === voucherNumberOrId || c.id === voucherNumberOrId)) {
        return { ...c, customerName: newCustomerName };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to update raw clip customer name:', err);
  }
}

export function deleteRawClipsByVoucherNumber(voucherNumber: string): void {
  tombstoneRawClips(c => c.voucherNumber === voucherNumber, 'voucher-deleted');
}

export function deleteRawClip(id: string): void {
  tombstoneRawClips(c => c.id === id, 'user-deleted');
}

export function deleteRawClipsByRound(roundId: string): void {
  tombstoneRawClips(c => c.roundId === roundId, 'round-deleted');
}

export function deleteRawClipsByDate(date: string): void {
  tombstoneRawClips(c => c.date === date, 'date-deleted');
}

export function clearAllRawClips(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to clear raw clips:', err);
  }
}
