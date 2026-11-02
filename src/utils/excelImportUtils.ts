import * as XLSX from 'xlsx';
import { Voucher, TwoDVoucher, FootballSlip, VoucherItem, TwoDVoucherItem } from '../types';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from './storage';
import { getLocalDateStr } from './statementUtils';
import { merge2DVouchersNoDuplicates, merge3DVouchersNoDuplicates, mergeFootballSlipsNoDuplicates } from './deduplicationUtils';

export interface ExcelImportResult {
  success: boolean;
  message: string;
  counts: {
    '2d': number;
    '3d': number;
    'football': number;
  };
  details?: {
    totalTurnover: number;
    sheetName: string;
  };
}

/**
 * Parses items string like "24=1000, 42=500" or "789=1000R, 123=2000"
 */
function parseVoucherItems(itemsStr: string, is3D: boolean = false): { items2D: TwoDVoucherItem[]; items3D: VoucherItem[]; total: number } {
  const items2D: TwoDVoucherItem[] = [];
  const items3D: VoucherItem[] = [];
  let total = 0;

  if (!itemsStr || typeof itemsStr !== 'string') {
    return { items2D, items3D, total };
  }

  // Split by comma, semicolon, space, or newline
  const parts = itemsStr.split(/[,;\n\r|]+/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    // Patterns: "24=1000", "24/1000", "24-1000", "24:1000", "789=1000R"
    const match = part.match(/([0-9]+)\s*[:=\-\/]\s*([0-9]+)\s*([rR]?)/);
    if (match) {
      const num = match[1];
      const amt = parseInt(match[2], 10) || 0;
      const isRumble = match[3].toLowerCase() === 'r';

      if (num.length === 2 && !is3D) {
        items2D.push({ number: num, amount: amt, betType: isRumble ? 'rumble' : 'straight' });
        total += amt;
      } else if (num.length === 3 || is3D) {
        items3D.push({
          number: num.padStart(3, '0').slice(-3),
          amount: amt,
          betType: isRumble ? 'rumble' : 'straight'
        });
        total += amt;
      }
    } else {
      // Direct "24" or space separated
      const sub = part.split(/\s+/);
      if (sub.length >= 2) {
        const num = sub[0].replace(/\D/g, '');
        const amt = parseInt(sub[1].replace(/\D/g, ''), 10) || 0;
        if (num.length === 2 && !is3D) {
          items2D.push({ number: num, amount: amt, betType: 'straight' });
          total += amt;
        } else if (num.length === 3 || is3D) {
          items3D.push({
            number: num.padStart(3, '0').slice(-3),
            amount: amt,
            betType: 'straight'
          });
          total += amt;
        }
      }
    }
  }

  return { items2D, items3D, total };
}

/**
 * Inspects and imports Excel file (.xlsx, .xls, .csv) into localStorage
 */
export async function importVouchersFromExcel(file: File): Promise<ExcelImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve({
            success: false,
            message: 'Excel ဖိုင်ထဲတွင် Sheet မရှိပါ',
            counts: { '2d': 0, '3d': 0, 'football': 0 }
          });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          resolve({
            success: false,
            message: 'ရွေးချယ်ထားသော Excel ဖိုင်ထဲတွင် ဒေတာစာရင်း မရှိပါ',
            counts: { '2d': 0, '3d': 0, 'football': 0 }
          });
          return;
        }

        const todayStr = getLocalDateStr();
        const existing2DVouchers: TwoDVoucher[] = loadStoredData(STORAGE_KEYS.VOUCHERS_2D, []);
        const existing3DVouchers: Voucher[] = loadStoredData(STORAGE_KEYS.VOUCHERS, []);
        const existingFBSlips: FootballSlip[] = loadStoredData(STORAGE_KEYS.SLIPS_FOOTBALL, []);

        const new2DVouchers: TwoDVoucher[] = [];
        const new3DVouchers: Voucher[] = [];
        const newFBSlips: FootballSlip[] = [];
        let grandTotalTurnover = 0;

        // Existing IDs set to prevent duplicate keys
        const seen2DIds = new Set(existing2DVouchers.map(v => v.id));
        const seen3DIds = new Set(existing3DVouchers.map(v => v.id));
        const seenFBIds = new Set(existingFBSlips.map(s => s.id));

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowKeys = Object.keys(row);

          // Find column values leniently
          const getCol = (possibleNames: string[]): string => {
            for (const name of possibleNames) {
              for (const k of rowKeys) {
                if (k.toLowerCase().trim() === name.toLowerCase().trim() || k.includes(name)) {
                  return String(row[k] || '').trim();
                }
              }
            }
            return '';
          };

          const businessType = getCol(['လုပ်ငန်း', 'business', 'type', 'category']);
          const voucherNo = getCol(['ဘောင်ချာအမှတ်', 'voucher', 'voucherNo', 'slipNo', 'id']) || `IMP-${Date.now().toString().slice(-6)}-${i + 1}`;
          const customerName = getCol(['ဝယ်သူအမည်', 'ဝယ်သူ', 'customer', 'customerName', 'name']) || 'Excel သွင်းသူ';
          const customerPhone = getCol(['ဖုန်းနံပါတ်', 'ဖုန်း', 'phone', 'customerPhone']) || '';
          const itemsStr = getCol(['ထိုးဂဏန်းများ', 'ဂဏန်းများ', 'ဂဏန်း', 'items', 'numbers']);
          const rawSubtotal = parseFloat(getCol(['မူလထိုးကြေး', 'ထိုးကြေး', 'စုစုပေါင်းထိုးငွေ', 'subtotal', 'stakeAmount']).replace(/[^0-9.-]/g, '')) || 0;
          const rawDiscount = parseFloat(getCol(['အောက်လက်ကော်မရှင်', 'ကော်မရှင်', 'discountAmount', 'discount']).replace(/[^0-9.-]/g, '')) || 0;
          const rawNetPayable = parseFloat(getCol(['အမှန်ပေးငွေ', 'ပေးငွေ', 'netPayable']).replace(/[^0-9.-]/g, '')) || (rawSubtotal - rawDiscount);
          const rawDate = getCol(['ရက်စွဲ/အချိန်', 'ရက်စွဲ', 'date', 'createdAt', 'roundDate']) || new Date().toISOString();
          const isPaid = getCol(['ငွေရှင်းပြီးမှု', 'ရှင်းပြီး', 'isPaid', 'status']).includes('ရှင်း') || true;

          // Determine business mode: 2D, 3D, or Football
          const is2D = businessType.includes('2D') || businessType.includes('ဇီးကွက်') || (!businessType && itemsStr.length > 0 && /^\d{2}[=\-\s]/.test(itemsStr));
          const is3D = businessType.includes('3D') || businessType.includes('အိုးစည်လေး') || (!businessType && itemsStr.length > 0 && /^\d{3}[=\-\s]/.test(itemsStr));
          const isFB = businessType.includes('ဘောလုံး') || businessType.includes('ပစ်တိုင်းထောင်') || businessType.includes('Football');

          // Parse items
          const { items2D, items3D, total: parsedTotal } = parseVoucherItems(itemsStr, is3D);
          const finalSubtotal = rawSubtotal > 0 ? rawSubtotal : parsedTotal;
          grandTotalTurnover += finalSubtotal;

          const datePart = rawDate.slice(0, 10) || todayStr;
          const isoDate = rawDate.includes('T') ? rawDate : new Date().toISOString();

          if (is3D || (!is2D && !isFB && items3D.length > 0)) {
            // 3D Voucher
            const uid = `vouch-3d-imp-${Date.now()}-${i + 1}`;
            if (!seen3DIds.has(uid)) {
              seen3DIds.add(uid);
              new3DVouchers.push({
                id: uid,
                voucherNo,
                roundId: `round-3d-${datePart}`,
                customerName,
                customerPhone,
                items: items3D.length > 0 ? items3D : [{ number: '000', amount: finalSubtotal, betType: 'straight' }],
                subtotal: finalSubtotal,
                discountPercent: 0,
                discountAmount: rawDiscount,
                netPayable: rawNetPayable > 0 ? rawNetPayable : finalSubtotal,
                createdAt: isoDate,
                isPaid,
                status: 'active',
                notes: `Excel သွင်းထားသော ဘောင်ချာ (${sheetName})`
              });
            }
          } else if (isFB) {
            // Football Slip
            const uid = `fb-slip-imp-${Date.now()}-${i + 1}`;
            if (!seenFBIds.has(uid)) {
              seenFBIds.add(uid);
              newFBSlips.push({
                id: uid,
                slipNo: voucherNo,
                roundDate: datePart,
                customerName,
                customerPhone,
                slipType: 'maung',
                teamCount: 1,
                stakeAmount: finalSubtotal,
                discountPercent: 0,
                discountAmount: rawDiscount,
                netPayable: rawNetPayable > 0 ? rawNetPayable : finalSubtotal,
                combinedOdds: 1.9,
                potentialPayout: finalSubtotal * 1.9,
                outcome: 'pending',
                status: 'active',
                createdAt: isoDate,
                notes: `Excel သွင်းထားသော စလစ် (${sheetName})`,
                selections: [
                  {
                    matchId: `match-imp-${datePart}`,
                    matchSummary: itemsStr || 'Excel Match',
                    league: 'Imported League',
                    betType: 'body_home',
                    choiceLabel: itemsStr || 'Home',
                    lineDescription: 'အကြော',
                    odds: 1.9
                  }
                ]
              });
            }
          } else {
            // 2D Voucher (Default)
            const uid = `vouch-2d-imp-${Date.now()}-${i + 1}`;
            if (!seen2DIds.has(uid)) {
              seen2DIds.add(uid);
              new2DVouchers.push({
                id: uid,
                voucherNo,
                roundId: `round-2d-${datePart}-eve`,
                customerName,
                customerPhone,
                items: items2D.length > 0 ? items2D : [{ number: '00', amount: finalSubtotal, betType: 'straight' as const }],
                subtotal: finalSubtotal,
                discountPercent: 0,
                discountAmount: rawDiscount,
                netPayable: rawNetPayable > 0 ? rawNetPayable : finalSubtotal,
                createdAt: isoDate,
                isPaid,
                status: 'active',
                notes: `Excel သွင်းထားသော ဘောင်ချာ (${sheetName})`
              });
            }
          }
        }

        const totalImported = new2DVouchers.length + new3DVouchers.length + newFBSlips.length;

        if (totalImported === 0) {
          resolve({
            success: false,
            message: 'ဖိုင်ထဲမှ ဘောင်ချာဒေတာ ဖတ်ရှုမရပါ (Format မမှန်ကန်ပါ)',
            counts: { '2d': 0, '3d': 0, 'football': 0 }
          });
          return;
        }

        // Save merged data safely with deduplication
        let totalAdded = 0;
        let totalDuplicatesSkipped = 0;

        if (new2DVouchers.length > 0) {
          const res2D = merge2DVouchersNoDuplicates(existing2DVouchers, new2DVouchers);
          saveStoredData(STORAGE_KEYS.VOUCHERS_2D, res2D.merged);
          totalAdded += res2D.addedCount;
          totalDuplicatesSkipped += res2D.duplicateCount;
        }
        if (new3DVouchers.length > 0) {
          const res3D = merge3DVouchersNoDuplicates(existing3DVouchers, new3DVouchers);
          saveStoredData(STORAGE_KEYS.VOUCHERS, res3D.merged);
          totalAdded += res3D.addedCount;
          totalDuplicatesSkipped += res3D.duplicateCount;
        }
        if (newFBSlips.length > 0) {
          const resFB = mergeFootballSlipsNoDuplicates(existingFBSlips, newFBSlips);
          saveStoredData(STORAGE_KEYS.SLIPS_FOOTBALL, resFB.merged);
          totalAdded += resFB.addedCount;
          totalDuplicatesSkipped += resFB.duplicateCount;
        }

        const skipMsg = totalDuplicatesSkipped > 0
          ? ` (ဘောင်ချာနံပါတ်/ဂဏန်း/ထိုးကြေးတူ ထပ်နေသော ဘောင်ချာ ${totalDuplicatesSkipped} စောင်အား ချန်လှပ်ထားခဲ့ပါသည်)`
          : '';

        resolve({
          success: true,
          message: totalAdded > 0
            ? `Excel ဖိုင်မှ ဘောင်ချာအသစ် (${totalAdded}) စောင် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ${skipMsg}`
            : `Excel ဖိုင်ပါ ဘောင်ချာများအားလုံး စနစ်ထဲတွင် ရှိပြီးဖြစ်သဖြင့် ထပ်မံထည့်သွင်းခြင်း မပြုပါ (ထပ်နေသော ဘောင်ချာ ${totalDuplicatesSkipped} စောင်)`,
          counts: {
            '2d': new2DVouchers.length,
            '3d': new3DVouchers.length,
            'football': newFBSlips.length
          },
          details: {
            totalTurnover: grandTotalTurnover,
            sheetName
          }
        });
      } catch (err: any) {
        console.error('Failed to parse excel file:', err);
        resolve({
          success: false,
          message: `Excel ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက်: ${err?.message || 'ဖိုင်ဖော်မတ်မှားယွင်းနေပါသည်'}`,
          counts: { '2d': 0, '3d': 0, 'football': 0 }
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        message: 'Excel ဖိုင်အား ဖွင့်ဖတ်၍ မရပါ',
        counts: { '2d': 0, '3d': 0, 'football': 0 }
      });
    };

    reader.readAsArrayBuffer(file);
  });
}
