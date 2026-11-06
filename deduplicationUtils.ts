/**
 * Deduplication utilities for 2D, 3D and Football betting vouchers and forward slips.
 * Ensures that identical vouchers (matching voucher number, customer name, total stake, and bet numbers)
 * are NEVER added twice during backup restores, Excel imports, or round updates.
 */

import { Voucher, TwoDVoucher, FootballSlip, ForwardSlip, TwoDForwardSlip, FootballForwardSlip } from '../types';

/**
 * Normalizes 2D items into a canonical sorted string: e.g. "24:1000:straight|42:500:rumble"
 */
export function normalize2DItems(items: any[] = []): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map(i => {
      const num = String(i.number || '').trim().padStart(2, '0');
      const amt = Number(i.amount) || 0;
      const type = String(i.betType || 'straight').toLowerCase();
      return `${num}:${amt}:${type}`;
    })
    .sort()
    .join('|');
}

/**
 * Normalizes 3D items into a canonical sorted string: e.g. "123:2000:straight|789:1000:rumble"
 */
export function normalize3DItems(items: any[] = []): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map(i => {
      const num = String(i.number || '').trim().padStart(3, '0');
      const amt = Number(i.amount) || 0;
      const type = String(i.betType || 'straight').toLowerCase();
      return `${num}:${amt}:${type}`;
    })
    .sort()
    .join('|');
}

/**
 * Normalizes Football selections into a canonical sorted string
 */
export function normalizeFootballSelections(selections: any[] = []): string {
  if (!Array.isArray(selections) || selections.length === 0) return '';
  return selections
    .map(s => {
      const match = String(s.matchId || s.matchSummary || '').trim().toLowerCase();
      const choice = String(s.choiceLabel || s.betType || '').trim().toLowerCase();
      const odds = Number(s.odds) || 0;
      return `${match}:${choice}:${odds}`;
    })
    .sort()
    .join('|');
}

function extractDateKey(roundId?: string, createdAt?: string, roundDate?: string): string {
  if (roundDate && /^\d{4}-\d{2}-\d{2}/.test(roundDate)) {
    return roundDate.slice(0, 10);
  }
  if (roundId) {
    const match = roundId.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  if (createdAt) {
    return createdAt.slice(0, 10);
  }
  return '';
}

/**
 * Generates fingerprints for a 2D voucher.
 * Matching rules:
 * - idKey: exact ID
 * - voucherNoKey: round + voucherNo
 * - contentKey: date/round + minute + customer + stake + items (strictly disabled if customerName is empty)
 */
export function get2DVoucherSignatures(v: TwoDVoucher): { idKey: string; voucherNoKey?: string; contentKey?: string } {
  const dateKey = extractDateKey(v.roundId, v.createdAt);
  const custName = (v.customerName || '').trim().toLowerCase();
  const subtotal = Number(v.subtotal) || Number(v.netPayable) || 0;
  const itemsStr = normalize2DItems(v.items);
  const vNo = (v.voucherNo || '').trim().toUpperCase();

  const idKey = v.id ? `id::${v.id}` : '';
  const roundOrDate = v.roundId || dateKey;
  const voucherNoKey = (vNo && roundOrDate) ? `vno::${roundOrDate}::${vNo}` : undefined;

  // Rule B2: contentKey (date+customer+stake+items) must NOT be used if customerName is blank.
  // When customerName is present, it must match down to the minute (createdAt.slice(0, 16)).
  let contentKey: string | undefined = undefined;
  const minuteStr = v.createdAt ? v.createdAt.slice(0, 16) : '';
  if (custName && minuteStr) {
    contentKey = `content::${roundOrDate}::${minuteStr}::${custName}::${subtotal}::${itemsStr}`;
  }

  return { idKey, voucherNoKey, contentKey };
}

/**
 * Generates fingerprints for a 3D voucher
 */
export function get3DVoucherSignatures(v: Voucher): { idKey: string; voucherNoKey?: string; contentKey?: string } {
  const dateKey = extractDateKey(v.roundId, v.createdAt);
  const custName = (v.customerName || '').trim().toLowerCase();
  const subtotal = Number(v.subtotal) || Number(v.netPayable) || 0;
  const itemsStr = normalize3DItems(v.items);
  const vNo = (v.voucherNo || '').trim().toUpperCase();

  const idKey = v.id ? `id::${v.id}` : '';
  const roundOrDate = v.roundId || dateKey;
  const voucherNoKey = (vNo && roundOrDate) ? `vno::${roundOrDate}::${vNo}` : undefined;

  let contentKey: string | undefined = undefined;
  const minuteStr = v.createdAt ? v.createdAt.slice(0, 16) : '';
  if (custName && minuteStr) {
    contentKey = `content::${roundOrDate}::${minuteStr}::${custName}::${subtotal}::${itemsStr}`;
  }

  return { idKey, voucherNoKey, contentKey };
}

/**
 * Generates fingerprints for a Football slip
 */
export function getFootballSlipSignatures(s: FootballSlip): { idKey: string; voucherNoKey?: string; contentKey?: string } {
  const dateKey = extractDateKey(undefined, s.createdAt, s.roundDate);
  const custName = (s.customerName || '').trim().toLowerCase();
  const stake = Number(s.stakeAmount) || Number(s.netPayable) || 0;
  const selStr = normalizeFootballSelections(s.selections);
  const sNo = (s.slipNo || '').trim().toUpperCase();

  const idKey = s.id ? `id::${s.id}` : '';
  const voucherNoKey = (sNo && dateKey) ? `sno::${dateKey}::${sNo}` : undefined;

  let contentKey: string | undefined = undefined;
  const minuteStr = s.createdAt ? s.createdAt.slice(0, 16) : '';
  if (custName && minuteStr) {
    contentKey = `content::${dateKey}::${minuteStr}::${custName}::${stake}::${selStr}`;
  }

  return { idKey, voucherNoKey, contentKey };
}

export interface DedupeResult<T> {
  cleaned: T[]; // Active non-tombstone records
  updated: T[]; // All records (existing records with duplicates tombstoned)
  duplicates: T[]; // Duplicate records that were tombstoned
  duplicateCount: number;
}

/**
 * Identifies duplicate 2D vouchers and flags them with tombstones (deletedAt) instead of hard deletion.
 */
export function markDuplicate2DVouchers(vouchers: TwoDVoucher[]): DedupeResult<TwoDVoucher> {
  if (!Array.isArray(vouchers) || vouchers.length === 0) {
    return { cleaned: [], updated: [], duplicates: [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  const updated: TwoDVoucher[] = [];
  const duplicates: TwoDVoucher[] = [];
  const now = new Date().toISOString();

  for (const v of vouchers) {
    if (!v) continue;

    // Already tombstoned records remain as tombstoned
    if (v.deletedAt) {
      updated.push(v);
      continue;
    }

    const { idKey, voucherNoKey, contentKey } = get2DVoucherSignatures(v);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      const tombstoned: TwoDVoucher = {
        ...v,
        deletedAt: now,
        deletedReason: 'duplicate',
        deletedBy: 'manual-clean'
      };
      duplicates.push(tombstoned);
      updated.push(tombstoned);
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      updated.push(v);
    }
  }

  const cleaned = updated.filter(v => !v.deletedAt);
  return { cleaned, updated, duplicates, duplicateCount: duplicates.length };
}

export function cleanDuplicate2DVouchers(vouchers: TwoDVoucher[]): DedupeResult<TwoDVoucher> {
  return markDuplicate2DVouchers(vouchers);
}

/**
 * Identifies duplicate 3D vouchers and flags them with tombstones (deletedAt) instead of hard deletion.
 */
export function markDuplicate3DVouchers(vouchers: Voucher[]): DedupeResult<Voucher> {
  if (!Array.isArray(vouchers) || vouchers.length === 0) {
    return { cleaned: [], updated: [], duplicates: [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  const updated: Voucher[] = [];
  const duplicates: Voucher[] = [];
  const now = new Date().toISOString();

  for (const v of vouchers) {
    if (!v) continue;

    if (v.deletedAt) {
      updated.push(v);
      continue;
    }

    const { idKey, voucherNoKey, contentKey } = get3DVoucherSignatures(v);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      const tombstoned: Voucher = {
        ...v,
        deletedAt: now,
        deletedReason: 'duplicate',
        deletedBy: 'manual-clean'
      };
      duplicates.push(tombstoned);
      updated.push(tombstoned);
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      updated.push(v);
    }
  }

  const cleaned = updated.filter(v => !v.deletedAt);
  return { cleaned, updated, duplicates, duplicateCount: duplicates.length };
}

export function cleanDuplicate3DVouchers(vouchers: Voucher[]): DedupeResult<Voucher> {
  return markDuplicate3DVouchers(vouchers);
}

/**
 * Identifies duplicate Football slips and flags them with tombstones (deletedAt) instead of hard deletion.
 */
export function markDuplicateFootballSlips(slips: FootballSlip[]): DedupeResult<FootballSlip> {
  if (!Array.isArray(slips) || slips.length === 0) {
    return { cleaned: [], updated: [], duplicates: [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  const updated: FootballSlip[] = [];
  const duplicates: FootballSlip[] = [];
  const now = new Date().toISOString();

  for (const s of slips) {
    if (!s) continue;

    if (s.deletedAt) {
      updated.push(s);
      continue;
    }

    const { idKey, voucherNoKey, contentKey } = getFootballSlipSignatures(s);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      const tombstoned: FootballSlip = {
        ...s,
        deletedAt: now,
        deletedReason: 'duplicate',
        deletedBy: 'manual-clean'
      };
      duplicates.push(tombstoned);
      updated.push(tombstoned);
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      updated.push(s);
    }
  }

  const cleaned = updated.filter(s => !s.deletedAt);
  return { cleaned, updated, duplicates, duplicateCount: duplicates.length };
}

export function cleanDuplicateFootballSlips(slips: FootballSlip[]): DedupeResult<FootballSlip> {
  return markDuplicateFootballSlips(slips);
}

/**
 * Merges incoming 2D vouchers into existing vouchers without inserting duplicates.
 * Preserves existing vouchers intact without running auto-clean.
 */
export function merge2DVouchersNoDuplicates(
  existingVouchers: TwoDVoucher[],
  incomingVouchers: TwoDVoucher[]
): { merged: TwoDVoucher[]; addedCount: number; duplicateCount: number } {
  const baseCleaned = existingVouchers || [];

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const v of baseCleaned) {
    if (!v || v.deletedAt) continue;
    const { idKey, voucherNoKey, contentKey } = get2DVoucherSignatures(v);
    if (idKey) seenIds.add(idKey);
    if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
    if (contentKey) seenContents.add(contentKey);
  }

  const toAdd: TwoDVoucher[] = [];
  let duplicateCount = 0;

  for (const v of incomingVouchers) {
    if (!v) continue;
    const { idKey, voucherNoKey, contentKey } = get2DVoucherSignatures(v);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      duplicateCount++;
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      toAdd.push(v);
    }
  }

  return {
    merged: [...toAdd, ...baseCleaned],
    addedCount: toAdd.length,
    duplicateCount
  };
}

/**
 * Merges incoming 3D vouchers into existing vouchers without inserting duplicates.
 * Preserves existing vouchers intact without running auto-clean.
 */
export function merge3DVouchersNoDuplicates(
  existingVouchers: Voucher[],
  incomingVouchers: Voucher[]
): { merged: Voucher[]; addedCount: number; duplicateCount: number } {
  const baseCleaned = existingVouchers || [];

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const v of baseCleaned) {
    if (!v || v.deletedAt) continue;
    const { idKey, voucherNoKey, contentKey } = get3DVoucherSignatures(v);
    if (idKey) seenIds.add(idKey);
    if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
    if (contentKey) seenContents.add(contentKey);
  }

  const toAdd: Voucher[] = [];
  let duplicateCount = 0;

  for (const v of incomingVouchers) {
    if (!v) continue;
    const { idKey, voucherNoKey, contentKey } = get3DVoucherSignatures(v);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      duplicateCount++;
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      toAdd.push(v);
    }
  }

  return {
    merged: [...toAdd, ...baseCleaned],
    addedCount: toAdd.length,
    duplicateCount
  };
}

/**
 * Merges incoming Football slips into existing slips without inserting duplicates.
 * Preserves existing slips intact without running auto-clean.
 */
export function mergeFootballSlipsNoDuplicates(
  existingSlips: FootballSlip[],
  incomingSlips: FootballSlip[]
): { merged: FootballSlip[]; addedCount: number; duplicateCount: number } {
  const baseCleaned = existingSlips || [];

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const s of baseCleaned) {
    if (!s || s.deletedAt) continue;
    const { idKey, voucherNoKey, contentKey } = getFootballSlipSignatures(s);
    if (idKey) seenIds.add(idKey);
    if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
    if (contentKey) seenContents.add(contentKey);
  }

  const toAdd: FootballSlip[] = [];
  let duplicateCount = 0;

  for (const s of incomingSlips) {
    if (!s) continue;
    const { idKey, voucherNoKey, contentKey } = getFootballSlipSignatures(s);

    let isDuplicate = false;
    if (idKey && seenIds.has(idKey)) {
      isDuplicate = true;
    } else if (voucherNoKey && seenVoucherNos.has(voucherNoKey)) {
      isDuplicate = true;
    } else if (contentKey && seenContents.has(contentKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      duplicateCount++;
    } else {
      if (idKey) seenIds.add(idKey);
      if (voucherNoKey) seenVoucherNos.add(voucherNoKey);
      if (contentKey) seenContents.add(contentKey);
      toAdd.push(s);
    }
  }

  return {
    merged: [...toAdd, ...baseCleaned],
    addedCount: toAdd.length,
    duplicateCount
  };
}

/**
 * Untombstones a voucher or slip by resetting deletedAt to null (Rule B3).
 */
export function untombstoneItem<T extends { id: string; deletedAt?: string | null; deletedReason?: string; deletedBy?: string }>(
  items: T[],
  id: string
): T[] {
  return items.map(item => {
    if (item.id === id) {
      return {
        ...item,
        deletedAt: null,
        deletedReason: undefined,
        deletedBy: undefined
      };
    }
    return item;
  });
}
