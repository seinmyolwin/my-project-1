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

export function getRawClips(): RawBetClip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          if (item && 'customerPhone' in item) {
            const { customerPhone, ...clean } = item;
            return clean as RawBetClip;
          }
          return item as RawBetClip;
        });
      }
    }
  } catch (err) {
    console.error('Failed to read raw clips:', err);
  }
  return [];
}

export function saveRawClip(clipData: Omit<RawBetClip, 'id' | 'timestamp'>): RawBetClip {
  const clips = getRawClips();
  const { customerPhone, ...rest } = clipData;
  const newClip: RawBetClip = {
    ...rest,
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function deleteRawClipsByVoucherNumber(voucherNumber: string): void {
  const clips = getRawClips();
  const updated = clips.filter(c => c.voucherNumber !== voucherNumber);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to delete raw clips by voucher number:', err);
  }
}

export function deleteRawClip(id: string): void {
  const clips = getRawClips();
  const updated = clips.filter(c => c.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated', { detail: { deletedId: id } }));
  } catch (err) {
    console.error('Failed to delete raw clip:', err);
  }
}

export function deleteRawClipsByRound(roundId: string): void {
  const clips = getRawClips();
  const updated = clips.filter(c => c.roundId !== roundId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to delete raw clips by round:', err);
  }
}

export function deleteRawClipsByDate(date: string): void {
  const clips = getRawClips();
  const updated = clips.filter(c => c.date !== date);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to delete raw clips by date:', err);
  }
}

export function clearAllRawClips(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to clear raw clips:', err);
  }
}
