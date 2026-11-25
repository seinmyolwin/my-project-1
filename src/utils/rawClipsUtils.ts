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
  imageDataUrl?: string;
  imageUrls?: string[];
  itemCount: number;
  totalAmountPreview?: number;
  source?: 'manual' | 'batch_paste' | 'direct_paste' | 'telegram' | 'ocr';
}

export interface StagedRawSource {
  id: string;
  source: 'manual' | 'batch_paste' | 'direct_paste' | 'ocr';
  rawText?: string;
  imageDataUrl?: string;
  itemIds: string[];
}

export function pruneStagedRawSources(
  sources: StagedRawSource[],
  removedIds: Set<string>
): StagedRawSource[] {
  if (removedIds.size === 0) return sources;
  return sources
    .map(src => ({
      ...src,
      itemIds: src.itemIds.filter(id => !removedIds.has(id))
    }))
    .filter(src => src.itemIds.length > 0);
}

export function retainStagedRawSources(
  sources: StagedRawSource[],
  keptIds: Set<string>
): StagedRawSource[] {
  if (keptIds.size === 0) return [];
  return sources
    .map(src => ({
      ...src,
      itemIds: src.itemIds.filter(id => keptIds.has(id))
    }))
    .filter(src => src.itemIds.length > 0);
}

export function buildClipPayloadFromStagedSources(
  sources: StagedRawSource[],
  savedItemIds: Set<string>,
  fallbackItems?: Array<{ number: string; amount: number; isRumble?: boolean; originalInput?: string }>
): {
  rawText: string;
  imageDataUrl?: string;
  imageUrls?: string[];
  source: RawBetClip['source'];
} {
  const relevant = sources.filter(src => src.itemIds.some(id => savedItemIds.has(id)));
  const texts = relevant.map(src => (src.rawText || '').trim()).filter(Boolean);
  const photos = relevant
    .map(src => (src.imageDataUrl || '').trim())
    .filter(Boolean);

  if (relevant.length > 0) {
    let source: RawBetClip['source'] = 'manual';
    if (photos.length > 0) {
      source = 'ocr';
    } else if (relevant.some(s => s.source === 'direct_paste')) {
      source = 'direct_paste';
    } else if (relevant.some(s => s.source === 'batch_paste')) {
      source = 'batch_paste';
    }

    return {
      rawText: texts.join('\n'),
      imageDataUrl: photos[0] || undefined,
      imageUrls: photos.length > 0 ? photos : undefined,
      source
    };
  }

  const fallbackText = (fallbackItems || [])
    .map(it => it.originalInput?.trim() || `${it.number}=${it.amount}${it.isRumble ? 'R' : ''}`)
    .filter(Boolean)
    .join('\n');

  return {
    rawText: fallbackText,
    source: 'manual'
  };
}

export async function compressImageForArchive(
  imageSrc: string,
  maxDimension = 1000,
  quality = 0.68
): Promise<string> {
  if (!imageSrc || typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageSrc;
  }
  if (!imageSrc.startsWith('data:image') && !imageSrc.startsWith('blob:')) {
    return imageSrc;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          resolve(imageSrc);
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
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

  let updated = [newClip, ...clips];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated', { detail: { newClip } }));
  } catch (err) {
    console.error('Failed to save raw clip (retrying after trimming oldest archived photos):', err);
    try {
      // Drop image payloads from oldest historical clips first to fit localStorage quota
      for (let i = updated.length - 1; i >= 1; i--) {
        if (updated[i].imageDataUrl || updated[i].imageUrls) {
          const { imageDataUrl, imageUrls, ...withoutImg } = updated[i];
          updated[i] = {
            ...withoutImg,
            rawText: withoutImg.rawText || '[ဓာတ်ပုံမှတ်တမ်း - Storage ပြည့်သဖြင့် ရှင်းထားပါသည်]'
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated', { detail: { newClip } }));
            return newClip;
          } catch {
            // continue trimming older photos
          }
        }
      }
    } catch (retryErr) {
      console.error('Failed to save raw clip even after pruning:', retryErr);
    }
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

export function deleteRawClipsByDateRange(
  category: '3d' | '2d' | 'football',
  startDate: string,
  endDate: string
): number {
  const safeStart = startDate <= endDate ? startDate : endDate;
  const safeEnd = startDate <= endDate ? endDate : startDate;
  const all = readAllRawClips();
  const count = all.filter(
    (c: any) =>
      c &&
      !c.deletedAt &&
      c.category === category &&
      typeof c.date === 'string' &&
      c.date >= safeStart &&
      c.date <= safeEnd
  ).length;
  if (count > 0) {
    tombstoneRawClips(
      (c) =>
        c.category === category &&
        typeof c.date === 'string' &&
        c.date >= safeStart &&
        c.date <= safeEnd,
      'date-range-deleted'
    );
  }
  return count;
}

export function clearRawClipsByCategory(category: '3d' | '2d' | 'football'): void {
  tombstoneRawClips(c => c.category === category, 'category-cleared');
}

export function clearAllRawClips(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
  } catch (err) {
    console.error('Failed to clear raw clips:', err);
  }
}

export function findRawClipForVoucher(
  category: '3d' | '2d' | 'football',
  voucherNumber: string,
  options?: { roundId?: string; date?: string; customerName?: string; slipId?: string; clips?: RawBetClip[] }
): RawBetClip | null {
  const vNoLower = (voucherNumber || '').trim().toLowerCase();
  const fbFallback = options?.slipId ? `fb-${options.slipId}`.toLowerCase() : '';
  if (!vNoLower && !fbFallback) return null;

  const source = options?.clips || getRawClips();
  const candidates = source.filter((c) => {
    if (c.category !== category) return false;
    const clipVNo = (c.voucherNumber || '').trim().toLowerCase();
    return (vNoLower && clipVNo === vNoLower) || (fbFallback && clipVNo === fbFallback);
  });

  if (candidates.length === 0) return null;

  return (
    (options?.roundId ? candidates.find((c) => c.roundId === options.roundId) : undefined) ||
    (options?.date ? candidates.find((c) => c.date === options.date) : undefined) ||
    (options?.customerName
      ? candidates.find((c) => (c.customerName || '').trim() === options.customerName?.trim())
      : undefined) ||
    candidates[0]
  );
}

