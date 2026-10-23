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

  // Split by newlines, commas, semicolons, and 2+ consecutive spaces
  const lines = rawText.split(/[\n,;]+/).flatMap(seg => seg.split(/\s{2,}/)).map(s => s.trim()).filter(Boolean);

  let idCounter = 1;

  for (const line of lines) {
    try {
      const myanmarConverted = convertMyanmarToEnglishDigits(line);

      // Check for Head/Tail pattern (e.g., "4 ထိပ် 500 ပိတ် 200" or "4 ထိပ် 500 4 ပိတ် 200")
      const headTailMatch = myanmarConverted.match(/(\d)\s*ထိပ်\s*(\d+)\s*(?:(\d)\s*)?ပိတ်\s*(\d+)/i);
      if (headTailMatch) {
        const headDigit = headTailMatch[1];
        const headAmt = parseInt(headTailMatch[2], 10);
        const tailDigit = headTailMatch[3] !== undefined ? headTailMatch[3] : headTailMatch[1]; // Using specified or inherited digit
        const tailAmt = parseInt(headTailMatch[4], 10);

        if (!isNaN(headAmt) && headAmt > 0 && !isNaN(tailAmt) && tailAmt > 0) {
          // Generate Head numbers (4xx)
          for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 9; j++) {
              const num = `${headDigit}${i}${j}`;
              items.push({
                id: `item-${Date.now()}-${idCounter++}`,
                number: num,
                amount: headAmt,
                isRumble: false,
                betType: 'straight',
                originalInput: `${num} ထိပ် (${headAmt})`
              });
            }
          }
          // Generate Tail numbers (xx4)
          for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 9; j++) {
              const num = `${i}${j}${tailDigit}`;
              items.push({
                id: `item-${Date.now()}-${idCounter++}`,
                number: num,
                amount: tailAmt,
                isRumble: false,
                betType: 'straight',
                originalInput: `${num} ပိတ် (${tailAmt})`
              });
            }
          }
          continue;
        }
      }

      // Check for Break pattern (e.g., "3 ဘရိတ် 300" or "3b300" or "3b400")
      const breakMatch = myanmarConverted.match(/(\d)\s*(?:ဘရိတ်|b|B)\s*(\d+)/i) || myanmarConverted.match(/(?:ဘရိတ်)\s*(\d)\s*(\d+)/i);
      if (breakMatch) {
        const breakSum = parseInt(breakMatch[1], 10);
        const breakAmt = parseInt(breakMatch[2], 10);

        if (breakSum >= 0 && breakSum <= 27 && !isNaN(breakAmt) && breakAmt > 0) {
          for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 9; j++) {
              for (let k = 0; k <= 9; k++) {
                if ((i + j + k) % 10 === (breakSum % 10)) {
                  const num = `${i}${j}${k}`;
                  items.push({
                    id: `item-${Date.now()}-${idCounter++}`,
                    number: num,
                    amount: breakAmt,
                    isRumble: false,
                    betType: 'straight',
                    originalInput: `${num} ဘရိတ် (${breakSum}) (${breakAmt})`
                  });
                }
              }
            }
          }
          continue;
        }
      }

      // Check for 3D direct / rumble slash ratio pattern (e.g. "123 456 1000/200" or "123=1000/200")
      const slash3DMatch = myanmarConverted.match(/^(.+?)\s*(?:=|:|-|\s)\s*(\d+)\s*\/\s*(\d+)\s*$/) ||
                           myanmarConverted.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)\s*$/);
      if (slash3DMatch) {
        const numbersRaw = slash3DMatch[1].trim();
        const straightAmt = parseInt(slash3DMatch[2], 10);
        const rumbleAmt = parseInt(slash3DMatch[3], 10);

        if (!isNaN(straightAmt) && straightAmt > 0 && !isNaN(rumbleAmt) && rumbleAmt > 0) {
          const numTokens = numbersRaw.replace(/[=:\-,;*+]/g, ' ').split(/\s+/).filter(Boolean);
          for (const tok of numTokens) {
            const cleanNum = tok.replace(/[^0-9]/g, '');
            if (cleanNum.length === 3) {
              // 1. Straight item
              items.push({
                id: `item-${Date.now()}-${idCounter++}`,
                number: cleanNum,
                amount: straightAmt,
                isRumble: false,
                betType: 'straight',
                originalInput: `${cleanNum} ဒဲ့ (${straightAmt})`
              });

              // 2. Rumble items (all unique permutations)
              const perms = getPermutations(cleanNum);
              const groupId = `r3d-batch-${Date.now()}-${idCounter++}-${Math.random().toString(36).substr(2, 5)}`;
              perms.forEach(p => {
                items.push({
                  id: `item-${Date.now()}-${idCounter++}`,
                  number: p,
                  amount: rumbleAmt,
                  isRumble: true,
                  betType: 'rumble',
                  groupId,
                  originalNumber: cleanNum,
                  originalAmount: rumbleAmt,
                  permutations: perms,
                  originalInput: `${cleanNum} အာ (${rumbleAmt})`
                });
              });
            } else {
              errors.push(`ဂဏန်း [${tok}] သည် ၃ လုံး (000-999) မဟုတ်ပါ`);
            }
          }
          continue;
        }
      }

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
              const groupId = `r3d-batch-${Date.now()}-${idCounter++}-${Math.random().toString(36).substr(2, 5)}`;
              perms.forEach(p => {
                items.push({
                  id: `item-${Date.now()}-${idCounter++}`,
                  number: p,
                  amount: amount,
                  isRumble: true,
                  betType: 'rumble',
                  groupId,
                  originalNumber: cleanNum,
                  originalAmount: amount,
                  permutations: perms,
                  originalInput: `${cleanNum} R (${perms.length} ခွေ)`
                });
              });
            } else {
              items.push({
                id: `item-${Date.now()}-${idCounter++}`,
                number: cleanNum,
                amount: amount,
                isRumble: false,
                betType: 'straight',
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
          const groupId = `r3d-batch-${Date.now()}-${idCounter++}-${Math.random().toString(36).substr(2, 5)}`;
          perms.forEach(p => {
            items.push({
              id: `item-${Date.now()}-${idCounter++}`,
              number: p,
              amount: 1000,
              isRumble: true,
              betType: 'rumble',
              groupId,
              originalNumber: cleanNum,
              originalAmount: 1000,
              permutations: perms,
              originalInput: `${cleanNum} R (${perms.length} ခွေ)`
            });
          });
        } else {
          items.push({
            id: `item-${Date.now()}-${idCounter++}`,
            number: cleanNum,
            amount: 1000,
            isRumble: false,
            betType: 'straight',
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

    // Track which rumble groups in this voucher have already been awarded a win
    const wonGroupIdsInVoucher = new Set<string>();

    // Pass 1: exact straight bets (ONLY applies to straight bets)
    v.items.forEach((item) => {
      const isRumbleBet = item.betType === 'rumble';
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
    });

    // Pass 2: Todd / Rumble bets (ONLY applies to rumble bets matching any permutation)
    if (toddMultiplier > 0) {
      v.items.forEach((item) => {
        const isRumbleBet = item.betType === 'rumble';
        if (!isRumbleBet) return;

        if (item.groupId) {
          if (wonGroupIdsInVoucher.has(item.groupId)) return;

          // If the group contains the exact winningNumber, prioritize that item as winner
          const hasExactMatchInGroup = v.items.some(
            i => i.groupId === item.groupId && i.number === winningNumber
          );

          const isWinningItem = hasExactMatchInGroup
            ? item.number === winningNumber
            : (item.permutations ? item.permutations.includes(winningNumber) : toddSet.has(item.number));

          if (isWinningItem) {
            wonGroupIdsInVoucher.add(item.groupId);
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
        } else {
          // Standalone rumble bet without groupId
          if (toddSet.has(item.number)) {
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
        }
      });
    }
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

  // 0. Metadata Sheet (ပွဲစဉ်အချက်အလက်)
  const metaRows = [
    { 'Property': 'System', 'Value': 'ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ်' },
    { 'Property': 'RoundName', 'Value': round.name },
    { 'Property': 'DrawDate', 'Value': round.drawDate },
    { 'Property': 'ClosingTime', 'Value': round.closingTime || '15:30' },
    { 'Property': 'WinningNumber', 'Value': winningNumber || round.winningNumber || '' },
    { 'Property': 'Multiplier', 'Value': multiplier },
    { 'Property': 'ToddMultiplier', 'Value': round.toddMultiplier || 100 },
    { 'Property': 'CommissionRate', 'Value': round.commissionRate || 10 },
    { 'Property': 'ExportTimestamp', 'Value': new Date().toISOString() }
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'ပွဲစဉ်အချက်အလက်');

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
    const winEval = evaluateWinnings(vouchers, winningNumber, multiplier, round.toddMultiplier || 0);
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

/**
 * Parse exported 3D Excel round report to restore round and vouchers
 */
export async function parseExcelToRoundData3D(file: File): Promise<{
  roundName: string;
  winningNumber?: string;
  multiplier: number;
  toddMultiplier: number;
  commissionRate: number;
  drawDate: string;
  closingTime: string;
  vouchers: Voucher[];
} | null> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    const sheetName = workbook.SheetNames.find(n => n.includes('ဘောင်ချာ') || n.includes('Voucher')) || workbook.SheetNames[1] || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;

    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) return null;

    let roundName = file.name.replace(/\.[^/.]+$/, '').replace(/3D_Ledger_/g, '').replace(/_/g, ' ');
    let winningNumber: string | undefined = undefined;
    let multiplier = 600;
    let toddMultiplier = 100;
    let commissionRate = 10;
    let drawDate = new Date().toISOString().slice(0, 10);
    let closingTime = '15:30';

    const metaSheetName = workbook.SheetNames.find(n => n.includes('ပွဲစဉ်အချက်အလက်') || n.includes('Metadata'));
    if (metaSheetName) {
      const metaRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[metaSheetName]);
      const metaMap: Record<string, string> = {};
      metaRows.forEach(r => {
        const k = String(r['Property'] || r['Key'] || '').trim();
        const v = String(r['Value'] || '').trim();
        if (k && v) metaMap[k] = v;
      });
      if (metaMap['RoundName']) roundName = metaMap['RoundName'];
      if (metaMap['DrawDate']) drawDate = metaMap['DrawDate'];
      if (metaMap['ClosingTime']) closingTime = metaMap['ClosingTime'];
      if (metaMap['WinningNumber'] && /^\d{3}$/.test(metaMap['WinningNumber'])) winningNumber = metaMap['WinningNumber'];
      if (metaMap['Multiplier']) multiplier = parseInt(metaMap['Multiplier'], 10) || 600;
      if (metaMap['ToddMultiplier']) toddMultiplier = parseInt(metaMap['ToddMultiplier'], 10) || 100;
      if (metaMap['CommissionRate']) commissionRate = parseFloat(metaMap['CommissionRate']) || 10;
    } else {
      const winSheetName = workbook.SheetNames.find(n => n.includes('ပေါက်') || n.includes('Winner'));
      if (winSheetName) {
        const winRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[winSheetName]);
        for (const r of winRows) {
          const num = String(r['ပေါက်ဂဏန်း (Won Number)'] || '').trim();
          if (/^\d{3}$/.test(num)) {
            winningNumber = num;
            break;
          }
        }
      }
    }

    const vouchers: Voucher[] = [];
    let idCounter = 1;

    for (const r of rows) {
      const voucherNo = String(r['ဘောင်ချာအမှတ် (Voucher No)'] || `V-${Date.now()}-${idCounter}`);
      const customerName = String(r['ဝယ်သူအမည် (Customer)'] || 'အမည်မသိ');
      const phone = String(r['ဖုန်းနံပါတ် (Phone)'] || '');
      const betsStr = String(r['ထိုးဂဏန်းများ (Bets)'] || '');
      const subtotal = parseFloat(String(r['စုစုပေါင်း ထိုးကြေး (Total Stake)'] || '0').replace(/[^0-9.]/g, '')) || 0;
      const discount = parseFloat(String(r['ကော်မရှင်/လျှော့ငွေ (Commission)'] || '0').replace(/[^0-9.]/g, '')) || 0;
      const net = parseFloat(String(r['အသားတင်ကျသင့်ငွေ (Net Amount)'] || subtotal - discount).replace(/[^0-9.]/g, '')) || subtotal;
      const statusStr = String(r['အခြေအနေ (Status)'] || '');
      const isCancelled = statusStr.includes('ပယ်ဖျက်') || statusStr.includes('Cancelled');
      const isPaid = statusStr.includes('ပေးပြီး') || statusStr.includes('Paid');

      const parsed = parseQuickBetText(betsStr);
      const items = parsed.items.length > 0 ? parsed.items.map(i => ({
        ...i,
        betType: (i.betType || 'straight') as 'straight' | 'rumble'
      })) : [
        {
          id: `item-imp-${idCounter}`,
          number: '000',
          amount: subtotal || 1000,
          isRumble: false,
          betType: 'straight' as const,
          originalInput: betsStr || '000'
        }
      ];

      vouchers.push({
        id: `voucher-imp-${Date.now()}-${idCounter++}`,
        roundId: '',
        voucherNo,
        customerName,
        customerPhone: phone !== '-' ? phone : undefined,
        items,
        subtotal: subtotal || items.reduce((s, i) => s + i.amount, 0),
        discountPercent: commissionRate,
        discountAmount: discount,
        netPayable: net,
        status: isCancelled ? 'cancelled' : winningNumber ? 'settled' : 'active',
        createdAt: new Date().toISOString(),
        isPaid
      });
    }

    return {
      roundName,
      winningNumber,
      multiplier,
      toddMultiplier,
      commissionRate,
      drawDate,
      closingTime,
      vouchers
    };
  } catch (err) {
    console.error('Failed to parse 3D Excel round:', err);
    return null;
  }
}

