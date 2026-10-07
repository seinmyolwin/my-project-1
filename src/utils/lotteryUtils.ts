import * as XLSX from 'xlsx';
import { Voucher, DrawRound, ForwardSlip, BetItem, BetType } from '../types';
import { formatAmount, calculatePayout, safeRound } from './moneyUtils';

export { formatAmount, safeRound };

/**
 * Generate all unique 3-digit permutations for a given 3-digit number.
 * E.g., '123' -> ['123', '132', '213', '231', '312', '321'] (6)
 * '112' -> ['112', '121', '211'] (3)
 * '111' -> ['111'] (1)
 * '121' -> ['112', '121', '211'] (3)
 */
export function getPermutations(numStr: string): string[] {
  if (!numStr) return [];
  const cleanDigits = convertMyanmarToEnglishDigits(numStr).replace(/\D/g, '').slice(0, 3);
  if (cleanDigits.length !== 3) return [numStr];

  const digits = cleanDigits.split('');
  const results = new Set<string>();

  const permute = (arr: string[], m: string[] = []) => {
    if (arr.length === 0) {
      results.add(m.join(''));
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  };

  permute(digits);
  return Array.from(results).sort();
}

/**
 * Generate popular lottery groups / patterns
 */
export const LOTTERY_PATTERNS = {
  // Doubles / Triples (အပူး)
  triples: ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'],
  
  // Power numbers (0-5, 1-6, 2-7, 3-8, 4-9) - sample permutations
  getPowerPairs: () => {
    const pairs = [['0', '5'], ['1', '6'], ['2', '7'], ['3', '8'], ['4', '9']];
    const res: string[] = [];
    pairs.forEach(([a, b]) => {
      for (let i = 0; i <= 9; i++) {
        res.push(`${a}${b}${i}`, `${a}${i}${b}`, `${i}${a}${b}`);
      }
    });
    return Array.from(new Set(res)).slice(0, 30);
  },

  // Natkhat numbers (0-7, 1-8, 2-4, 3-5, 6-9)
  getNatkhatPairs: () => {
    const pairs = [['0', '7'], ['1', '8'], ['2', '4'], ['3', '5'], ['6', '9']];
    const res: string[] = [];
    pairs.forEach(([a, b]) => {
      for (let i = 0; i <= 9; i++) {
        res.push(`${a}${b}${i}`, `${a}${i}${b}`, `${i}${a}${b}`);
      }
    });
    return Array.from(new Set(res)).slice(0, 30);
  },

  // Consecutive numbers (ညီကို)
  consecutives: [
    '012', '123', '234', '345', '456', '567', '678', '789', '890', '901',
    '210', '321', '432', '543', '654', '765', '876', '987', '098', '109'
  ]
};

/**
 * Parse human/dealer shorthand text into structured bets.
 * Handles inputs like:
 * "123=1000"
 * "123-500, 456-1000"
 * "123r500" or "123 R 500" or "123ပတ် 500"
 * "123/456/789=2000" (multiple numbers same amount)
 * "123,456=500"
 */
export function parseQuickBetText(rawText: string): { items: BetItem[]; errors: string[] } {
  const items: BetItem[] = [];
  const errors: string[] = [];
  if (!rawText.trim()) return { items, errors };

  // Split by newlines, commas, semicolons
  const lines = rawText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);

  let idCounter = 1;

  for (const line of lines) {
    try {
      // Normalize line: replace Myanmar digits with standard digits
      const normalized = convertMyanmarToEnglishDigits(line)
        .replace(/[=:\-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Check for Rumble / R / ပတ် patterns (supports single "123 R 1000" and multiple "123 456 789 R 1000" / "123,456 R 500")
      const isRumble = /r|R|အာ|ပတ်လည်|ပတ်/i.test(line);
      const cleanForTokens = convertMyanmarToEnglishDigits(line)
        .replace(/r|R|အာ|ပတ်လည်|ပတ်/gi, ' ')
        .replace(/[=:\-_/,*+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const parts = cleanForTokens.split(' ').filter(Boolean);

      if (parts.length >= 2) {
        const amountStr = parts[parts.length - 1];
        const amount = parseInt(amountStr, 10);

        if (isNaN(amount) || amount <= 0) {
          errors.push(`ပမာဏ မမှန်ကန်ပါ: "${line}"`);
          continue;
        }

        const numbersPart = parts.slice(0, parts.length - 1);
        for (const numToken of numbersPart) {
          const cleanNum = numToken.replace(/[^0-9]/g, '');
          if (cleanNum.length === 3) {
            if (isRumble) {
              const perms = getPermutations(cleanNum);
              perms.forEach(p => {
                items.push({
                  id: `item-${Date.now()}-${idCounter++}`,
                  number: p,
                  amount: amount,
                  isRumble: false,
                  originalInput: `${cleanNum} R (${perms.length} ခွေ)`
                });
              });
            } else {
              items.push({
                id: `item-${Date.now()}-${idCounter++}`,
                number: cleanNum,
                amount: amount,
                isRumble: false,
                originalInput: cleanNum
              });
            }
          } else {
            errors.push(`ဂဏန်း ၃ လုံး မပြည့်ပါ: "${numToken}" (မူရင်း: "${line}")`);
          }
        }
      } else if (parts.length === 1 && parts[0].length === 3) {
        // Single 3-digit number with default 1000
        const cleanNum = parts[0];
        if (isRumble) {
          const perms = getPermutations(cleanNum);
          perms.forEach(p => {
            items.push({
              id: `item-${Date.now()}-${idCounter++}`,
              number: p,
              amount: 1000,
              isRumble: false,
              originalInput: `${cleanNum} R (${perms.length} ခွေ)`
            });
          });
        } else {
          items.push({
            id: `item-${Date.now()}-${idCounter++}`,
            number: cleanNum,
            amount: 1000,
            isRumble: false,
            originalInput: cleanNum
          });
        }
      } else {
        errors.push(`ပုံစံ မမှန်ကန်ပါ: "${line}" (ဥပမာ: 123=1000 သို့မဟုတ် 123 456 R 500)`);
      }
    } catch {
      errors.push(`နားမလည်နိုင်သော စာသား: "${line}"`);
    }
  }

  return { items, errors };
}

/**
 * Converts Myanmar numeral characters (၀-၉) to English (0-9)
 */
export function convertMyanmarToEnglishDigits(str: string): string {
  const myanmarDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return str.replace(/[၀-၉]/g, (char) => {
    const idx = myanmarDigits.indexOf(char);
    return idx !== -1 ? String(idx) : char;
  });
}

/**
 * Calculate Winning Settlement for a Round
 */
export interface WinResult {
  voucherId: string;
  voucherNo: string;
  customerName: string;
  customerPhone?: string;
  betNumber: string;
  betAmount: number;
  winType: 'straight' | 'todd';
  multiplier: number;
  wonPayout: number;
  isPaid: boolean;
}

export function evaluateWinnings(
  vouchers: Voucher[],
  winningNumber: string,
  straightMultiplier: number,
  toddMultiplier: number
): {
  winners: WinResult[];
  totalPayout: number;
  winningBetsCount: number;
  toddWinningBetsCount: number;
} {
  const winners: WinResult[] = [];
  let totalPayout = 0;
  let winningBetsCount = 0;
  let toddWinningBetsCount = 0;

  if (!winningNumber || winningNumber.length !== 3) {
    return { winners, totalPayout, winningBetsCount, toddWinningBetsCount };
  }

  // All permutations of winning number for Todd/Rumble evaluation
  const allPermutations = getPermutations(winningNumber);
  const toddSet = new Set(allPermutations);

  vouchers.forEach((v) => {
    if (v.status === 'cancelled') return;

    v.items.forEach((item) => {
      const isRumbleBet = item.betType === 'rumble';

      // 1. Exact straight hit (တည့်ပေါက်) - ONLY applies to straight bets
      if (item.number === winningNumber && !isRumbleBet) {
        const payout = calculatePayout(item.amount, straightMultiplier);
        totalPayout += payout;
        winningBetsCount++;
        winners.push({
          voucherId: v.id,
          voucherNo: v.voucherNo,
          customerName: v.customerName,
          customerPhone: v.customerPhone,
          betNumber: item.number,
          betAmount: item.amount,
          winType: 'straight',
          multiplier: straightMultiplier,
          wonPayout: payout,
          isPaid: v.isPaid
        });
      }
      // 2. Todd / Rumble hit (ပတ်လည်ပေါက်) - ONLY applies to rumble bets matching any permutation
      else if (isRumbleBet && toddSet.has(item.number) && toddMultiplier > 0) {
        const payout = calculatePayout(item.amount, toddMultiplier);
        totalPayout += payout;
        toddWinningBetsCount++;
        winners.push({
          voucherId: v.id,
          voucherNo: v.voucherNo,
          customerName: v.customerName,
          customerPhone: v.customerPhone,
          betNumber: item.number,
          betAmount: item.amount,
          winType: 'todd',
          multiplier: toddMultiplier,
          wonPayout: payout,
          isPaid: v.isPaid
        });
      }
    });
  });

  return {
    winners,
    totalPayout,
    winningBetsCount,
    toddWinningBetsCount
  };
}

/**
 * Generate Comprehensive Excel Export
 */
export function exportLotteryDataToExcel(
  round: DrawRound,
  vouchers: Voucher[],
  forwardSlips: ForwardSlip[],
  aggregates: { [num: string]: { totalSold: number; forwarded: number; retained: number } },
  winningNumber?: string,
  multiplier: number = 600
) {
  const wb = XLSX.utils.book_new();

  // 1. Master Ledger Sheet (000-999 and sold numbers)
  const masterData: any[] = [];
  let totalGross = 0;
  let totalFwd = 0;
  let totalNetRetained = 0;

  Object.entries(aggregates)
    .sort((a, b) => b[1].totalSold - a[1].totalSold)
    .forEach(([num, data]) => {
      if (data.totalSold > 0) {
        totalGross += data.totalSold;
        totalFwd += data.forwarded;
        totalNetRetained += data.retained;

        const estPayout = data.retained * multiplier;
        masterData.push({
          'ဂဏန်း (Number)': num,
          'စုစုပေါင်း ရောင်းရငွေ (Gross Sold)': data.totalSold,
          'အပေါ်လွှဲ/ဖြတ်တင်ငွေ (Forwarded)': data.forwarded,
          'လက်ကျန် ကိုယ်ပိုင်တာဝန် (Retained)': data.retained,
          'ပေါက်ပါက လျော်ကြေး (Est. Payout)': estPayout,
          'အခြေအနေ (Status)': num === winningNumber ? 'ပေါက်ဂဏန်း (WINNER)' : 'ရောင်းပြီး'
        });
      }
    });

  // Add summary row
  masterData.push({
    'ဂဏန်း (Number)': 'စုစုပေါင်း (TOTAL)',
    'စုစုပေါင်း ရောင်းရငွေ (Gross Sold)': totalGross,
    'အပေါ်လွှဲ/ဖြတ်တင်ငွေ (Forwarded)': totalFwd,
    'လက်ကျန် ကိုယ်ပိုင်တာဝန် (Retained)': totalNetRetained,
    'ပေါက်ပါက လျော်ကြေး (Est. Payout)': '-',
    'အခြေအနေ (Status)': '-'
  });

  const wsMaster = XLSX.utils.json_to_sheet(masterData);
  XLSX.utils.book_append_sheet(wb, wsMaster, 'အရောင်းစာရင်းချုပ်');

  // 2. Vouchers Sheet
  const voucherData: any[] = [];
  vouchers.forEach((v) => {
    const numbersList = v.items.map(i => `${i.number}=${i.amount}`).join(', ');
    const statusText = v.status === 'cancelled'
      ? 'ပယ်ဖျက်ထားသည် (Cancelled)'
      : v.isPaid
      ? 'ပေးပြီး (Paid)'
      : 'မပေးရသေး (Unpaid)';

    voucherData.push({
      'ဘောင်ချာအမှတ် (Voucher No)': v.voucherNo,
      'ဝယ်သူအမည် (Customer)': v.customerName,
      'ဖုန်းနံပါတ် (Phone)': v.customerPhone || '-',
      'ထိုးဂဏန်းများ (Bets)': numbersList,
      'စုစုပေါင်း ထိုးကြေး (Total Stake)': v.subtotal,
      'ကော်မရှင်/လျှော့ငွေ (Commission)': v.discountAmount,
      'အသားတင်ကျသင့်ငွေ (Net Amount)': v.netPayable,
      'ရက်စွဲ/အချိန် (Date)': new Date(v.createdAt).toLocaleString('en-GB'),
      'အခြေအနေ (Status)': statusText
    });
  });
  const wsVouchers = XLSX.utils.json_to_sheet(voucherData);
  XLSX.utils.book_append_sheet(wb, wsVouchers, 'ဘောင်ချာများ');

  // 3. Winning Settlement Sheet if winning number exists
  if (winningNumber) {
    const winEval = evaluateWinnings(vouchers, winningNumber, multiplier, round.toddMultiplier || 100);
    const winData: any[] = [];
    winEval.winners.forEach(w => {
      winData.push({
        'ဘောင်ချာအမှတ် (Voucher)': w.voucherNo,
        'ဝယ်သူအမည် (Customer)': w.customerName,
        'ပေါက်ဂဏန်း (Won Number)': w.betNumber,
        'ထိုးကြေးငွေ (Bet Amount)': w.betAmount,
        'အဆ (Multiplier)': `${w.multiplier}x`,
        'လျော်ကြေးငွေ (Won Payout)': w.wonPayout,
        'အမျိုးအစား (Win Type)': w.winType === 'straight' ? 'တည့်ပေါက် (Straight)' : 'ပတ်လည် (Todd)',
        'ရှင်းပြီး/မပြီး (Claim Status)': w.isPaid ? 'ငွေရှင်းပြီး' : 'မရှင်းရသေး'
      });
    });

    const netSales = vouchers.reduce((acc, v) => acc + (v.status !== 'cancelled' ? v.netPayable : 0), 0);
    const netProfit = netSales - winEval.totalPayout;

    winData.push({
      'ဘောင်ချာအမှတ် (Voucher)': 'အကျဉ်းချုပ် (SUMMARY)',
      'ဝယ်သူအမည် (Customer)': `စုစုပေါင်း ရောင်းရငွေ: ${netSales}`,
      'ပေါက်ဂဏန်း (Won Number)': `စုစုပေါင်း လျော်ကြေး: ${winEval.totalPayout}`,
      'ထိုးကြေးငွေ (Bet Amount)': '-',
      'အဆ (Multiplier)': '-',
      'လျော်ကြေးငွေ (Won Payout)': `အသားတင် ${netProfit >= 0 ? 'အမြတ်' : 'အရှုံး'}: ${Math.abs(netProfit)}`,
      'အမျိုးအစား (Win Type)': '-',
      'ရှင်းပြီး/မပြီး (Claim Status)': '-'
    });

    const wsWinning = XLSX.utils.json_to_sheet(winData);
    XLSX.utils.book_append_sheet(wb, wsWinning, 'ပေါက်ဂဏန်းနှင့် လျော်ကြေး');
  }

  // 4. Forwarded Slips Sheet
  if (forwardSlips.length > 0) {
    const fwdData: any[] = [];
    forwardSlips.forEach(f => {
      f.items.forEach(item => {
        fwdData.push({
          'လွှဲတင်စလစ် (Slip No)': f.slipNo,
          'အဓိကဒိုင်ကြီးအမည် (Master Agent)': f.masterAgentName,
          'ဂဏန်း (Number)': item.number,
          'ပမာဏ (Amount)': item.amount,
          'ကော်မရှင်နှုန်း (Commission %)': `${f.commissionRate}%`,
          'ရရှိသောကော်မရှင် (Comm. Earned)': f.commissionAmount,
          'ပေးချေငွေ (Net Paid)': f.netPaid,
          'ရက်စွဲ (Date)': new Date(f.createdAt).toLocaleString('en-GB')
        });
      });
    });
    const wsForward = XLSX.utils.json_to_sheet(fwdData);
    XLSX.utils.book_append_sheet(wb, wsForward, 'အပေါ်လွှဲတင်စာရင်း');
  }

  // Export the workbook
  const fileName = `3D_Ledger_${round.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
