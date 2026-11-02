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
 * Returns:
 * 1. idKey: exact ID
 * 2. voucherNoKey: round + voucherNo
 * 3. contentKey: date/round + customer + stake + items (identifies same voucher even if re-numbered)
 */
export function get2DVoucherSignatures(v: TwoDVoucher): { idKey: string; voucherNoKey?: string; contentKey: string } {
  const dateKey = extractDateKey(v.roundId, v.createdAt);
  const custName = (v.customerName || '').trim().toLowerCase();
  const subtotal = Number(v.subtotal) || Number(v.netPayable) || 0;
  const itemsStr = normalize2DItems(v.items);
  const vNo = (v.voucherNo || '').trim().toUpperCase();

  const idKey = v.id ? `id::${v.id}` : '';
  const voucherNoKey = vNo ? `vno::${v.roundId || dateKey}::${vNo}` : undefined;
  const contentKey = `content::${v.roundId || dateKey}::${custName}::${subtotal}::${itemsStr}`;

  return { idKey, voucherNoKey, contentKey };
}

/**
 * Generates fingerprints for a 3D voucher
 */
export function get3DVoucherSignatures(v: Voucher): { idKey: string; voucherNoKey?: string; contentKey: string } {
  const dateKey = extractDateKey(v.roundId, v.createdAt);
  const custName = (v.customerName || '').trim().toLowerCase();
  const subtotal = Number(v.subtotal) || Number(v.netPayable) || 0;
  const itemsStr = normalize3DItems(v.items);
  const vNo = (v.voucherNo || '').trim().toUpperCase();

  const idKey = v.id ? `id::${v.id}` : '';
  const voucherNoKey = vNo ? `vno::${v.roundId || dateKey}::${vNo}` : undefined;
  const contentKey = `content::${v.roundId || dateKey}::${custName}::${subtotal}::${itemsStr}`;

  return { idKey, voucherNoKey, contentKey };
}

/**
 * Generates fingerprints for a Football slip
 */
export function getFootballSlipSignatures(s: FootballSlip): { idKey: string; voucherNoKey?: string; contentKey: string } {
  const dateKey = extractDateKey(undefined, s.createdAt, s.roundDate);
  const custName = (s.customerName || '').trim().toLowerCase();
  const stake = Number(s.stakeAmount) || Number(s.netPayable) || 0;
  const selStr = normalizeFootballSelections(s.selections);
  const sNo = (s.slipNo || '').trim().toUpperCase();

  const idKey = s.id ? `id::${s.id}` : '';
  const voucherNoKey = sNo ? `sno::${dateKey}::${sNo}` : undefined;
  const contentKey = `content::${dateKey}::${custName}::${stake}::${selStr}`;

  return { idKey, voucherNoKey, contentKey };
}

/**
 * Deduplicates an existing array of 2D vouchers, removing any duplicates
 */
export function cleanDuplicate2DVouchers(vouchers: TwoDVoucher[]): { cleaned: TwoDVoucher[]; duplicateCount: number } {
  if (!Array.isArray(vouchers) || vouchers.length <= 1) {
    return { cleaned: vouchers || [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();
  const cleaned: TwoDVoucher[] = [];
  let duplicateCount = 0;

  for (const v of vouchers) {
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
      cleaned.push(v);
    }
  }

  return { cleaned, duplicateCount };
}

/**
 * Deduplicates an existing array of 3D vouchers, removing any duplicates
 */
export function cleanDuplicate3DVouchers(vouchers: Voucher[]): { cleaned: Voucher[]; duplicateCount: number } {
  if (!Array.isArray(vouchers) || vouchers.length <= 1) {
    return { cleaned: vouchers || [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();
  const cleaned: Voucher[] = [];
  let duplicateCount = 0;

  for (const v of vouchers) {
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
      cleaned.push(v);
    }
  }

  return { cleaned, duplicateCount };
}

/**
 * Deduplicates an existing array of Football slips, removing any duplicates
 */
export function cleanDuplicateFootballSlips(slips: FootballSlip[]): { cleaned: FootballSlip[]; duplicateCount: number } {
  if (!Array.isArray(slips) || slips.length <= 1) {
    return { cleaned: slips || [], duplicateCount: 0 };
  }

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();
  const cleaned: FootballSlip[] = [];
  let duplicateCount = 0;

  for (const s of slips) {
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
      cleaned.push(s);
    }
  }

  return { cleaned, duplicateCount };
}

/**
 * Merges incoming 2D vouchers into existing vouchers without inserting duplicates.
 */
export function merge2DVouchersNoDuplicates(
  existingVouchers: TwoDVoucher[],
  incomingVouchers: TwoDVoucher[]
): { merged: TwoDVoucher[]; addedCount: number; duplicateCount: number } {
  const { cleaned: baseCleaned } = cleanDuplicate2DVouchers(existingVouchers);

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const v of baseCleaned) {
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
 */
export function merge3DVouchersNoDuplicates(
  existingVouchers: Voucher[],
  incomingVouchers: Voucher[]
): { merged: Voucher[]; addedCount: number; duplicateCount: number } {
  const { cleaned: baseCleaned } = cleanDuplicate3DVouchers(existingVouchers);

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const v of baseCleaned) {
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
 */
export function mergeFootballSlipsNoDuplicates(
  existingSlips: FootballSlip[],
  incomingSlips: FootballSlip[]
): { merged: FootballSlip[]; addedCount: number; duplicateCount: number } {
  const { cleaned: baseCleaned } = cleanDuplicateFootballSlips(existingSlips);

  const seenIds = new Set<string>();
  const seenVoucherNos = new Set<string>();
  const seenContents = new Set<string>();

  for (const s of baseCleaned) {
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
