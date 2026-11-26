/**
 * Reconstructs missing 2D / 3D customer vouchers directly from archived raw texts
 * (`shwe_mingalar_copied_raw_texts`) when ledger voucher storage was cleared or lost
 * while Raw Text Archive clips remained intact.
 */
import { RawBetClip, readAllRawClips } from './rawClipsUtils';
import { parseTwoDBatchInput } from './twoDLotteryUtils';
import { parseQuickBetText } from './lotteryUtils';
import { STORAGE_KEYS, loadStoredData, saveMultipleAtomic } from './storage';
import { createRestorePoint, generateUUID } from './restorePoints';
import { TwoDDrawRound, TwoDVoucher, TwoDVoucherItem, DrawRound, Voucher, VoucherItem } from '../types';

export interface RecoverableRawClipEntry {
  clip: RawBetClip;
  parsedItemsCount: number;
  parsedTotalAmount: number;
  unparseable: boolean;
}

export interface RecoverableRawClipGroup {
  groupKey: string;
  category: '2d' | '3d';
  date: string;
  roundId: string;
  roundName: string;
  entries: RecoverableRawClipEntry[];
  parseableCount: number;
  unparseableCount: number;
  totalAmount: number;
}

export interface MissingRawClipScanResult {
  groups: RecoverableRawClipGroup[];
  totalMissingClips: number;
  totalParseableClips: number;
  totalAmount: number;
}

const infer2DSession = (clip: RawBetClip): 'morning' | 'evening' => {
  const rid = (clip.roundId || '').toLowerCase();
  const rname = (clip.roundName || '').toLowerCase();
  const t = (clip.time || '').toLowerCase();
  if (rid.includes('morn') || rname.includes('မနက်') || rname.includes('12:01') || t.includes('am')) {
    return 'morning';
  }
  if (rid.includes('eve') || rname.includes('ညနေ') || rname.includes('4:30') || rname.includes('04:30')) {
    return 'evening';
  }
  const dt = new Date(clip.timestamp || Date.now());
  return dt.getHours() < 13 ? 'morning' : 'evening';
};

export function parseClipTo2DItems(rawText: string): TwoDVoucherItem[] {
  if (!rawText || !rawText.trim()) return [];
  const res = parseTwoDBatchInput(rawText);
  const rawItems = Array.isArray(res) ? res : res.items;
  return rawItems
    .filter((it) => it && /^\d{2}$/.test(String(it.number).trim()) && Number(it.amount) > 0)
    .map((it) => ({
      number: String(it.number).trim().padStart(2, '0'),
      amount: Math.round(Number(it.amount)),
      betType: it.betType || 'straight'
    }));
}

export function parseClipTo3DItems(rawText: string): VoucherItem[] {
  if (!rawText || !rawText.trim()) return [];
  const res = parseQuickBetText(rawText);
  return (res.items || [])
    .filter((it) => it && /^\d{3}$/.test(String(it.number).trim()) && Number(it.amount) > 0)
    .map((it) => ({
      number: String(it.number).trim().padStart(3, '0'),
      amount: Math.round(Number(it.amount)),
      betType: it.betType || 'straight'
    }));
}

export function findMissingVouchersFromRawClips(filterCategory?: '2d' | '3d'): MissingRawClipScanResult {
  const allClips = readAllRawClips().filter((c: any) => c && !c.deletedAt) as RawBetClip[];
  const existing2D = loadStoredData<TwoDVoucher[]>(STORAGE_KEYS.VOUCHERS_2D, []).filter(
    (v) => v && !v.deletedAt && v.status !== 'cancelled'
  );
  const existing3D = loadStoredData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter(
    (v) => v && !v.deletedAt && v.status !== 'cancelled'
  );

  const existing2DVoucherNos = new Set(existing2D.map((v) => (v.voucherNo || '').trim().toLowerCase()).filter(Boolean));
  const existing3DVoucherNos = new Set(existing3D.map((v) => (v.voucherNo || '').trim().toLowerCase()).filter(Boolean));

  const groupMap = new Map<string, RecoverableRawClipGroup>();

  for (const clip of allClips) {
    if (clip.category !== '2d' && clip.category !== '3d') continue;
    if (filterCategory && clip.category !== filterCategory) continue;

    const vNoNorm = (clip.voucherNumber || '').trim().toLowerCase();
    if (clip.category === '2d' && vNoNorm && existing2DVoucherNos.has(vNoNorm)) continue;
    if (clip.category === '3d' && vNoNorm && existing3DVoucherNos.has(vNoNorm)) continue;

    let parsedItemsCount = 0;
    let parsedTotalAmount = 0;

    if (clip.category === '2d') {
      const items = parseClipTo2DItems(clip.rawText || '');
      parsedItemsCount = items.length;
      parsedTotalAmount = items.reduce((s, it) => s + it.amount, 0);
    } else {
      const items = parseClipTo3DItems(clip.rawText || '');
      parsedItemsCount = items.length;
      parsedTotalAmount = items.reduce((s, it) => s + it.amount, 0);
    }

    const unparseable = parsedItemsCount === 0 || parsedTotalAmount <= 0;
    const gKey = `${clip.category}|${clip.date}|${clip.roundId || clip.roundName}`;

    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, {
        groupKey: gKey,
        category: clip.category,
        date: clip.date || '',
        roundId: clip.roundId || '',
        roundName: clip.roundName || `${clip.date} (${clip.category.toUpperCase()})`,
        entries: [],
        parseableCount: 0,
        unparseableCount: 0,
        totalAmount: 0
      });
    }

    const grp = groupMap.get(gKey)!;
    grp.entries.push({ clip, parsedItemsCount, parsedTotalAmount, unparseable });
    if (unparseable) {
      grp.unparseableCount++;
    } else {
      grp.parseableCount++;
      grp.totalAmount += parsedTotalAmount;
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  let totalMissingClips = 0;
  let totalParseableClips = 0;
  let totalAmount = 0;
  for (const g of groups) {
    totalMissingClips += g.entries.length;
    totalParseableClips += g.parseableCount;
    totalAmount += g.totalAmount;
  }

  return { groups, totalMissingClips, totalParseableClips, totalAmount };
}

export async function rebuildVouchersFromRawClips(options?: {
  category?: '2d' | '3d';
  groupKey?: string;
}): Promise<{
  success: boolean;
  recovered2D: number;
  recovered3D: number;
  skippedUnparseable: number;
  totalAmount: number;
  message: string;
}> {
  const scan = findMissingVouchersFromRawClips(options?.category);
  const targetGroups = options?.groupKey
    ? scan.groups.filter((g) => g.groupKey === options.groupKey)
    : scan.groups;

  const targetEntries = targetGroups.flatMap((g) => g.entries);
  const parseableEntries = targetEntries.filter((e) => !e.unparseable);
  const skippedUnparseable = targetEntries.length - parseableEntries.length;

  if (parseableEntries.length === 0) {
    return {
      success: false,
      recovered2D: 0,
      recovered3D: 0,
      skippedUnparseable,
      totalAmount: 0,
      message: 'မူရင်းစာသားများမှ ပြန်လည်တည်ဆောက်နိုင်သည့် ဘောင်ချာအသစ် မတွေ့ရှိပါ'
    };
  }

  try {
    await createRestorePoint('before-import', {
      source: 'raw-clip-reconstruction',
      count: parseableEntries.length
    });
  } catch {
    // non-fatal
  }

  const updates: Record<string, any> = {};

  // 2D reconstruction
  const entries2D = parseableEntries.filter((e) => e.clip.category === '2d');
  let recovered2D = 0;
  let amount2D = 0;
  if (entries2D.length > 0) {
    const settings2D = loadStoredData<any>(STORAGE_KEYS.SETTINGS_2D, {});
    const rounds2D = [...loadStoredData<TwoDDrawRound[]>(STORAGE_KEYS.ROUNDS_2D, [])];
    const vouchers2D = [...loadStoredData<TwoDVoucher[]>(STORAGE_KEYS.VOUCHERS_2D, [])];
    const existingNos = new Set(
      vouchers2D.filter((v) => !v.deletedAt && v.status !== 'cancelled').map((v) => (v.voucherNo || '').trim().toLowerCase())
    );

    const addedVouchers: TwoDVoucher[] = [];
    for (const { clip } of entries2D) {
      const vNo = (clip.voucherNumber || '').trim();
      if (vNo && existingNos.has(vNo.toLowerCase())) continue;

      const items = parseClipTo2DItems(clip.rawText || '');
      if (items.length === 0) continue;

      const session = infer2DSession(clip);
      const clipDate = clip.date || new Date(clip.timestamp || Date.now()).toISOString().slice(0, 10);

      // Resolve or create round in rounds2D
      let round =
        rounds2D.find((r) => !(r as any).deletedAt && r.id === clip.roundId) ||
        rounds2D.find((r) => !(r as any).deletedAt && r.drawDate === clipDate && r.session === session);

      if (!round) {
        const canonicalId =
          clip.roundId && clip.roundId !== 'manual-2d' && !clip.roundId.startsWith('manual')
            ? clip.roundId
            : `round-2d-${clipDate}-${session === 'morning' ? 'morn' : 'eve'}`;
        round = {
          id: canonicalId,
          name: clip.roundName || `${clipDate} (${session === 'morning' ? 'မနက် 12:01 PM' : 'ညနေ 04:30 PM'})`,
          drawDate: clipDate,
          session,
          closingTime: session === 'morning' ? '12:00' : '16:25',
          status: 'closed',
          multiplier: settings2D.defaultMultiplier ?? 80,
          commissionRate: settings2D.defaultCommissionRate ?? 0
        };
        rounds2D.unshift(round);
      }

      const subtotal = items.reduce((s, it) => s + it.amount, 0);
      const voucherNo = vNo || `REC-2D-${String(vouchers2D.length + addedVouchers.length + 1).padStart(4, '0')}`;
      existingNos.add(voucherNo.toLowerCase());

      addedVouchers.push({
        id: generateUUID(),
        voucherNo,
        roundId: round.id,
        customerName: (clip.customerName || '').trim() || 'အထွေထွေ',
        items,
        subtotal,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: subtotal,
        createdAt: new Date(clip.timestamp || Date.now()).toISOString(),
        notes: 'Raw Text Archive မှ ပြန်လည်တည်ဆောက်သည်',
        isPaid: true,
        status: 'active',
        lowerCommissionRate: settings2D.defaultCustomerDiscount ?? 0,
        payoutMultiplier: round.multiplier ?? settings2D.defaultMultiplier ?? 80,
        snapshotSource: 'migrated'
      });
      recovered2D++;
      amount2D += subtotal;
    }

    if (addedVouchers.length > 0) {
      updates[STORAGE_KEYS.ROUNDS_2D] = rounds2D;
      updates[STORAGE_KEYS.VOUCHERS_2D] = [...addedVouchers, ...vouchers2D];
    }
  }

  // 3D reconstruction
  const entries3D = parseableEntries.filter((e) => e.clip.category === '3d');
  let recovered3D = 0;
  let amount3D = 0;
  if (entries3D.length > 0) {
    const settings3D = loadStoredData<any>(STORAGE_KEYS.SETTINGS, {});
    const rounds3D = [...loadStoredData<DrawRound[]>(STORAGE_KEYS.ROUNDS, [])];
    const vouchers3D = [...loadStoredData<Voucher[]>(STORAGE_KEYS.VOUCHERS, [])];
    const existingNos = new Set(
      vouchers3D.filter((v) => !v.deletedAt && v.status !== 'cancelled').map((v) => (v.voucherNo || '').trim().toLowerCase())
    );

    const addedVouchers: Voucher[] = [];
    for (const { clip } of entries3D) {
      const vNo = (clip.voucherNumber || '').trim();
      if (vNo && existingNos.has(vNo.toLowerCase())) continue;

      const items = parseClipTo3DItems(clip.rawText || '');
      if (items.length === 0) continue;

      const clipDate = clip.date || new Date(clip.timestamp || Date.now()).toISOString().slice(0, 10);
      let round =
        rounds3D.find((r) => !(r as any).deletedAt && r.id === clip.roundId) ||
        rounds3D.find((r) => !(r as any).deletedAt && r.drawDate === clipDate);

      if (!round) {
        const canonicalId =
          clip.roundId && clip.roundId !== 'manual-3d' && !clip.roundId.startsWith('manual')
            ? clip.roundId
            : `round-3d-${clipDate}`;
        round = {
          id: canonicalId,
          name: clip.roundName || `${clipDate} (3D ပွဲစဉ်)`,
          drawDate: clipDate,
          closingTime: '15:00',
          status: 'closed',
          multiplier: settings3D.defaultMultiplier ?? 600,
          toddMultiplier: settings3D.defaultToddMultiplier ?? 100,
          commissionRate: settings3D.defaultCommissionRate ?? 0
        };
        rounds3D.unshift(round);
      }

      const subtotal = items.reduce((s, it) => s + it.amount, 0);
      const voucherNo = vNo || `REC-3D-${String(vouchers3D.length + addedVouchers.length + 1).padStart(4, '0')}`;
      existingNos.add(voucherNo.toLowerCase());

      addedVouchers.push({
        id: generateUUID(),
        voucherNo,
        roundId: round.id,
        customerName: (clip.customerName || '').trim() || 'အထွေထွေ',
        items,
        subtotal,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: subtotal,
        createdAt: new Date(clip.timestamp || Date.now()).toISOString(),
        notes: 'Raw Text Archive မှ ပြန်လည်တည်ဆောက်သည်',
        isPaid: true,
        status: 'active',
        lowerCommissionRate: settings3D.defaultCustomerDiscount ?? 0,
        payoutMultiplier: round.multiplier ?? settings3D.defaultMultiplier ?? 600,
        snapshotSource: 'migrated'
      });
      recovered3D++;
      amount3D += subtotal;
    }

    if (addedVouchers.length > 0) {
      updates[STORAGE_KEYS.ROUNDS] = rounds3D;
      updates[STORAGE_KEYS.VOUCHERS] = [...addedVouchers, ...vouchers3D];
    }
  }

  if (Object.keys(updates).length > 0) {
    saveMultipleAtomic(updates);
  }

  const totalRecovered = recovered2D + recovered3D;
  const totalAmount = amount2D + amount3D;
  return {
    success: totalRecovered > 0,
    recovered2D,
    recovered3D,
    skippedUnparseable,
    totalAmount,
    message:
      totalRecovered > 0
        ? `Raw Text Archive မှ ဘောင်ချာ ${totalRecovered} စောင် (${totalAmount.toLocaleString()} Ks) ကို ပြန်လည်တည်ဆောက်ပြီးပါပြီ`
        : 'ပြန်လည်တည်ဆောက်နိုင်သော ဘောင်ချာ မရှိပါ'
  };
}
