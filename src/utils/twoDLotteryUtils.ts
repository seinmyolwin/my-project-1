import * as XLSX from 'xlsx';
import {
  TwoDVoucher,
  TwoDForwardSlip,
  TwoDDrawRound,
  TwoDNumberAggregate,
  TwoDRoundSummary,
  TwoDBetItem,
  BetType
} from '../types';

// ====================================================
// MYANMAR 2D POPULAR PATTERNS (မြန်မာ့ ၂ လုံး ထိုးကွက်များ)
// ====================================================

// အပူး (Double numbers - 10 numbers)
export const TWO_D_DOUBLES = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];

// ပါဝါ (Power pairs - 10 numbers: 05, 50, 16, 61, 27, 72, 38, 83, 49, 94)
export const TWO_D_POWER = [
  '05', '50',
  '16', '61',
  '27', '72',
  '38', '83',
  '49', '94'
];

// နက္ခတ် (Natkhat pairs - 10 numbers: 07, 70, 18, 81, 24, 42, 35, 53, 69, 96)
export const TWO_D_NATKHAT = [
  '07', '70',
  '18', '81',
  '24', '42',
  '35', '53',
  '69', '96'
];

// ညီကို (Brothers / Sequential - 20 numbers)
export const TWO_D_BROTHERS = [
  '01', '10',
  '12', '21',
  '23', '32',
  '34', '43',
  '45', '54',
  '56', '65',
  '67', '76',
  '78', '87',
  '89', '98',
  '90', '09'
];

// ဆယ်ပြည့် (Tens - 10 numbers)
export const TWO_D_TENS = ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'];

// ဘရိတ် (Breaks: sum of digits % 10 = brake value, 10 numbers per brake 0-9)
export function getTwoDBreakNumbers(breakNum: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= 99; i++) {
    const s = i.toString().padStart(2, '0');
    const sum = (parseInt(s[0], 10) + parseInt(s[1], 10)) % 10;
    if (sum === breakNum) {
      result.push(s);
    }
  }
  return result;
}

// ထိပ်စီး (Head numbers: 0 ထိပ် - 9 ထိပ်)
export function getTwoDHeadNumbers(headDigit: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= 9; i++) {
    result.push(`${headDigit}${i}`);
  }
  return result;
}

// နောက်ပိတ် (Tail numbers: 0 ပိတ် - 9 ပိတ်)
export function getTwoDTailNumbers(tailDigit: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= 9; i++) {
    result.push(`${i}${tailDigit}`);
  }
  return result;
}

// အပါ (Numbers containing a specific digit 0-9: e.g. 5 ပါ -> 19 numbers: 05, 15, 25, 35, 45, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 65, 75, 85, 95)
export function getTwoDIncludesNumbers(digit: number | string): string[] {
  const dStr = String(digit).trim();
  if (!dStr) return [];
  const target = dStr[dStr.length - 1];
  const result: string[] = [];
  for (let i = 0; i <= 99; i++) {
    const s = i.toString().padStart(2, '0');
    if (s[0] === target || s[1] === target) {
      result.push(s);
    }
  }
  return result;
}

// စုံစုံ (Even - Even: 25 numbers)
export function getTwoDEvenEven(): string[] {
  const evens = ['0', '2', '4', '6', '8'];
  const res: string[] = [];
  for (const a of evens) {
    for (const b of evens) {
      res.push(`${a}${b}`);
    }
  }
  return res;
}

// မမ (Odd - Odd: 25 numbers)
export function getTwoDOddOdd(): string[] {
  const odds = ['1', '3', '5', '7', '9'];
  const res: string[] = [];
  for (const a of odds) {
    for (const b of odds) {
      res.push(`${a}${b}`);
    }
  }
  return res;
}

// စုံမ (Even - Odd: 25 numbers)
export function getTwoDEvenOdd(): string[] {
  const evens = ['0', '2', '4', '6', '8'];
  const odds = ['1', '3', '5', '7', '9'];
  const res: string[] = [];
  for (const a of evens) {
    for (const b of odds) {
      res.push(`${a}${b}`);
    }
  }
  return res;
}

// မစုံ (Odd - Even: 25 numbers)
export function getTwoDOddEven(): string[] {
  const odds = ['1', '3', '5', '7', '9'];
  const evens = ['0', '2', '4', '6', '8'];
  const res: string[] = [];
  for (const a of odds) {
    for (const b of evens) {
      res.push(`${a}${b}`);
    }
  }
  return res;
}

// 2D Reversal (R / အာ)
export function getTwoDReversal(num: string): string[] {
  if (num.length !== 2) return [num];
  const d0 = num[0];
  const d1 = num[1];
  if (d0 === d1) return [num];
  return [num, `${d1}${d0}`];
}

// ====================================================
// MYANMAR 2D KHWAY (ခွေ) RULES - (၄) မျိုးစလုံး တိကျစွာ တွက်ချက်ခြင်း
// ====================================================

// ၁။ ခွေ (ရိုးရိုးခွေ / အရှေ့မှအနောက်သို့သာတွဲ / အာမပါ / အပူးမပါ)
// ဥပမာ- "1234" -> 12, 13, 14, 23, 24, 34 (၆ ကွက်)
// ဥပမာ- "23456" -> 23, 24, 25, 26, 34, 35, 36, 45, 46, 56 (၁၀ ကွက်)
export function getTwoDKhway(input: string): string[] {
  const digits = Array.from(new Set(input.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const result: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    for (let j = i + 1; j < digits.length; j++) {
      result.push(`${digits[i]}${digits[j]}`);
    }
  }
  return result;
}

// ၂။ ခွေပူး (ရိုးရိုးခွေ + အပူးပါ / အာမပါ)
// ဥပမာ- "1234" -> ခွေ (၆ ကွက်) + အပူး 11, 22, 33, 44 (၄ ကွက်) = ၁၀ ကွက်
// ဥပမာ- "23456" -> ခွေ (၁၀ ကွက်) + အပူး 22, 33, 44, 55, 66 (၅ ကွက်) = ၁၅ ကွက်
export function getTwoDKhwayPuu(input: string): string[] {
  const digits = Array.from(new Set(input.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const khwayList = getTwoDKhway(input);
  const doublesList = digits.map((d) => `${d}${d}`);

  return [...khwayList, ...doublesList];
}

// ၃။ ခွေအာ (ခွေပြီး အာပါ လှည့်တွဲခြင်း / အပြန်အလှန် / အပူးမပါ)
// ဥပမာ- "1234" -> 12, 13, 14, 21, 23, 24, 31, 32, 34, 41, 42, 43 (၁၂ ကွက်)
export function getTwoDKhwayRumble(input: string): string[] {
  const digits = Array.from(new Set(input.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const result: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    for (let j = 0; j < digits.length; j++) {
      if (i !== j) {
        result.push(`${digits[i]}${digits[j]}`);
      }
    }
  }
  return result;
}

// ၄။ ခွေပူးအာ (ခွေအာ + အပူးပါ အကုန်လုံးပါ)
// ဥပမာ- "1234" -> ခွေအာ (၁၂ ကွက်) + အပူး 11, 22, 33, 44 (၄ ကွက်) = ၁၆ ကွက်
export function getTwoDKhwayPuuRumble(input: string): string[] {
  const digits = Array.from(new Set(input.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const khwayRumbleList = getTwoDKhwayRumble(input);
  const doublesList = digits.map((d) => `${d}${d}`);

  return [...khwayRumbleList, ...doublesList];
}

// ====================================================
// 2D BATCH TEXT / SLIP PARSER
// ====================================================
export function parseTwoDBatchInput(text: string, defaultAmount: number = 1000): TwoDBetItem[] {
  const lines = text.split(/[\n,;]+/);
  const items: TwoDBetItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Pattern 1: ခွေပူးအာ / ခွေပူးr (Khway + Puu + Rumble) - e.g. "1234 ခွေပူးr 1000", "1234.ခွေပူးအာ"
    if (/ခွေပူး[rအာ]|ခွေ\s*ပူး\s*[rအာ]|ပါခွေ[rအာ]|ခွေ[rအာ]ပူး/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhwayPuuRumble(rawDigits);
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${rawDigits} ခွေပူးr`
          });
        });
        continue;
      }
    }

    // Pattern 2: ခွေအာ / ခွေr (Khway + Rumble, no doubles) - e.g. "1234 ခွေr 1000", "1234.ခွေအာ"
    if (/ခွေ[rအာ]|ခွေ\s*[rအာ]/i.test(line) && !/ပူး/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhwayRumble(rawDigits);
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${rawDigits} ခွေr`
          });
        });
        continue;
      }
    }

    // Pattern 3: ခွေပူး (Khway + Puu, no rumble) - e.g. "1234 ခွေပူး 1000", "1234.ခွေပူး"
    if (/ခွေပူး|ခွေ\s*ပူး|ပါခွေ/i.test(line) && !/[rအာ]/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhwayPuu(rawDigits);
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${rawDigits} ခွေပူး`
          });
        });
        continue;
      }
    }

    // Pattern 4: ခွေ (ရိုးရိုးခွေ, no doubles, no rumble) - e.g. "1234 ခွေ 1000", "1234.ခွေ"
    if (/ခွေ/i.test(line) && !/ပူး|[rအာ]/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhway(rawDigits);
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${rawDigits} ခွေ`
          });
        });
        continue;
      }
    }

    // Pattern: "အပူး 1000"
    if (/အပူး/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      TWO_D_DOUBLES.forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'အပူး'
        });
      });
      continue;
    }

    // Pattern: "ပါဝါ 1000"
    if (/ပါဝါ/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      TWO_D_POWER.forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'ပါဝါ'
        });
      });
      continue;
    }

    // Pattern: "နက္ခတ် 1000"
    if (/နက္ခတ်/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      TWO_D_NATKHAT.forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'နက္ခတ်'
        });
      });
      continue;
    }

    // Pattern: "ညီကို 1000"
    if (/ညီကို/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      TWO_D_BROTHERS.forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'ညီကို'
        });
      });
      continue;
    }

    // Pattern: "5 ဘရိတ် 1000" or "ဘရိတ် 5 1000"
    if (/ဘရိတ်/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const brk = parseInt(nums[0], 10) % 10;
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        getTwoDBreakNumbers(brk).forEach(num => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${brk} ဘရိတ်`
          });
        });
        continue;
      }
    }

    // Pattern: "5 ပါ 1000", "5ပါ 500", "၅ပါ ၅၀၀", "အပါ 5 1000"
    if (/အပါ|ပါ/i.test(line) && !/ပါဝါ/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const targetDigit = nums[0].slice(-1);
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        getTwoDIncludesNumbers(targetDigit).forEach(num => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${targetDigit} ပါ`
          });
        });
        continue;
      }
    }

    // Pattern: "1 ရှေ့ပိတ် 1000", "1ရှေ့ပိတ် 500", "5 ထိပ် 1000", "ထိပ် 5 1000"
    if (/ရှေ့ပိတ်|ရှေ့စီး|ထိပ်/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const headDigit = parseInt(nums[0].slice(-1), 10);
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        getTwoDHeadNumbers(headDigit).forEach(num => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${headDigit} ရှေ့ပိတ်`
          });
        });
        continue;
      }
    }

    // Pattern: "2 နောက်ပိတ် 1000", "2နောက်ပိတ် 500", "5 နောက် 1000", "5 ပိတ် 1000"
    if (/နောက်ပိတ်|နောက်စီး|နောက်|ပိတ်/i.test(line) && !/ရှေ့ပိတ်|ရှေ့စီး/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const tailDigit = parseInt(nums[0].slice(-1), 10);
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        getTwoDTailNumbers(tailDigit).forEach(num => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            originalInput: `${tailDigit} နောက်ပိတ်`
          });
        });
        continue;
      }
    }

    // Pattern: "စုံစုံ 1000", "မမ 1000", "စုံမ 1000", "မစုံ 1000"
    if (/စုံစုံ/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      getTwoDEvenEven().forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'စုံစုံ'
        });
      });
      continue;
    }
    if (/မမ/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      getTwoDOddOdd().forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'မမ'
        });
      });
      continue;
    }
    if (/စုံမ/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      getTwoDEvenOdd().forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'စုံမ'
        });
      });
      continue;
    }
    if (/မစုံ/i.test(line)) {
      const amtMatch = line.match(/\d+/g);
      const amt = amtMatch ? parseInt(amtMatch[amtMatch.length - 1], 10) : defaultAmount;
      getTwoDOddEven().forEach(num => {
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: num,
          amount: amt,
          originalInput: 'မစုံ'
        });
      });
      continue;
    }

    // 2. Standard and Multi-number lines with R or Straight
    // E.g.: "35 56 54 R 500", "35 56 54 အာ 500", "35, 56, 54 R 500", "35-56-54 R 500", "35/56/54=500"
    // Also e.g. "35R500, 56R500", "35=500, 56=1000", "35 500"

    const commaSegments = line.split(',').map(s => s.trim()).filter(Boolean);
    const isIndependentSegments = commaSegments.length > 1 && commaSegments.every(seg => {
      const numMatch = seg.match(/\d+/g);
      return numMatch && numMatch.length >= 2;
    });

    const segmentsToProcess = isIndependentSegments ? commaSegments : [line];

    for (const segment of segmentsToProcess) {
      const isRumble = /r|R|အာ|ပတ်လည်|ပတ်/i.test(segment);
      const cleanSeg = segment.replace(/r|R|အာ|ပတ်လည်|ပတ်/gi, ' ');
      const rawTokens = cleanSeg.replace(/[=:\-_/,*+]/g, ' ').split(/\s+/).filter(Boolean);

      if (rawTokens.length === 0) continue;

      let betAmount = defaultAmount;
      let numbers: string[] = [];

      if (rawTokens.length === 1) {
        numbers.push(rawTokens[0].padStart(2, '0'));
      } else {
        const lastToken = rawTokens[rawTokens.length - 1];
        const parsedAmt = parseInt(lastToken, 10);
        
        if (!isNaN(parsedAmt) && parsedAmt > 0) {
          betAmount = parsedAmt;
          numbers = rawTokens.slice(0, rawTokens.length - 1).map(n => n.padStart(2, '0'));
        } else {
          numbers = rawTokens.map(n => n.padStart(2, '0'));
        }
      }

      for (const numStr of numbers) {
        if (/^\d{2}$/.test(numStr)) {
          if (isRumble) {
            const revs = getTwoDReversal(numStr);
            revs.forEach(r => {
              items.push({
                id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                number: r,
                amount: betAmount,
                isRumble: true,
                originalInput: `${numStr} R`
              });
            });
          } else {
            items.push({
              id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              number: numStr,
              amount: betAmount,
              isRumble: false,
              originalInput: numStr
            });
          }
        }
      }
    }
  }

  return items;
}

// ====================================================
// 2D WINNING EVALUATION & PROFIT CALCULATION
// ====================================================
export function evaluateTwoDWinnings(
  vouchers: TwoDVoucher[],
  winningNumber: string,
  multiplier: number = 85
): {
  settledVouchers: TwoDVoucher[];
  totalPayout: number;
  totalWinnersCount: number;
} {
  let totalPayout = 0;
  let totalWinnersCount = 0;

  const settledVouchers = vouchers.map(v => {
    let voucherHasWin = false;
    const updatedItems = v.items.map(item => {
      if (item.number === winningNumber) {
        const winAmt = item.amount * multiplier;
        totalPayout += winAmt;
        voucherHasWin = true;
        totalWinnersCount++;
        return {
          ...item,
          isWon: true,
          wonAmount: winAmt
        };
      }
      return {
        ...item,
        isWon: false,
        wonAmount: 0
      };
    });

    return {
      ...v,
      status: voucherHasWin ? ('settled' as const) : v.status,
      items: updatedItems
    };
  });

  return {
    settledVouchers,
    totalPayout,
    totalWinnersCount
  };
}

// ====================================================
// 2D EXCEL EXPORT
// ====================================================
export function exportTwoDLotteryToExcel(
  round: TwoDDrawRound,
  aggregates: { [num: string]: TwoDNumberAggregate },
  vouchers: TwoDVoucher[],
  forwardSlips: TwoDForwardSlip[],
  summary: TwoDRoundSummary,
  shopName: string = '2D Ledger'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 00-99 Ledger
  const ledgerData = Object.keys(aggregates)
    .sort((a, b) => a.localeCompare(b))
    .map(num => {
      const agg = aggregates[num];
      return {
        'ဂဏန်း (Number)': num,
        'စုစုပေါင်း ရောင်းရငွေ (Total Sold)': agg.totalSold,
        'ဒိုင်ကြီးဆီ လွှဲတင်ငွေ (Forwarded)': agg.forwardedAmount,
        'ဒိုင်လက်ကျန်ယူငွေ (Retained)': agg.retainedAmount,
        'သတ်မှတ်ဘရိတ် (Limit)': agg.limit,
        'လက်ခံမှု အခြေအနေ (Status)': agg.isBlocked ? 'ဒိုင်ကာ (Blocked)' : 'လက်ခံသည်',
        'ဖြစ်နိုင်ခြေ လျော်ကြေး (Payout @85x)': agg.estimatedPayout,
        'အန္တရာယ်အဆင့် (Risk)': agg.riskLevel.toUpperCase()
      };
    });
  const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsLedger, '၂ လုံး စာရင်းချုပ် (00-99)');

  // Sheet 2: Vouchers
  const voucherData = vouchers.map(v => ({
    'ဘောင်ချာနံပါတ်': v.voucherNo,
    'ထိုးသူအမည်': v.customerName,
    'ဖုန်းနံပါတ်': v.customerPhone || '-',
    'ဂဏန်းအရေအတွက်': v.items.length,
    'စုစုပေါင်းငွေ': v.subtotal,
    'လျှော့ငွေ': v.discountAmount,
    'ကျသင့်ငွေ': v.netPayable,
    'အချိန်': new Date(v.createdAt).toLocaleString('my-MM'),
    'ငွေချေပြီး': v.isPaid ? 'ဟုတ်' : 'မဟုတ်',
    'မှတ်ချက်': v.notes || '-'
  }));
  const wsVouchers = XLSX.utils.json_to_sheet(voucherData);
  XLSX.utils.book_append_sheet(wb, wsVouchers, 'အရောင်းဘောင်ချာများ');

  // Sheet 3: Forward Slips
  const fwdData = forwardSlips.map(f => ({
    'လွှဲတင်ပြေစာအမှတ်': f.slipNo,
    'ဒိုင်ချုပ်အမည်': f.masterAgentName,
    'ဖုန်း': f.masterAgentPhone || '-',
    'လွှဲတင်ငွေစုစုပေါင်း': f.totalAmount,
    'ကော်မရှင် (%)': `${f.commissionRate}%`,
    'ကော်မရှင်ငွေ': f.commissionAmount,
    'အမှန်ပေးချေငွေ': f.netPaid,
    'အချိန်': new Date(f.createdAt).toLocaleString('my-MM'),
    'မှတ်ချက်': f.notes || '-'
  }));
  const wsFwd = XLSX.utils.json_to_sheet(fwdData);
  XLSX.utils.book_append_sheet(wb, wsFwd, 'ဒိုင်ကြီးလွှဲစာရင်း');

  // Sheet 4: Summary
  const summaryData = [
    { 'အကြောင်းအရာ': 'ပွဲစဉ်အမည်', 'ပမာဏ': round.name },
    { 'အကြောင်းအရာ': 'ဖွင့်ရက်စွဲ', 'ပမာဏ': round.drawDate },
    { 'အကြောင်းအရာ': 'အချိန်ပိုင်း', 'ပမာဏ': round.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀' },
    { 'အကြောင်းအရာ': 'ပေါက်ဂဏန်း', 'ပမာဏ': round.winningNumber || 'မဖွင့်သေးပါ' },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း အရောင်းရငွေ', 'ပမာဏ': summary.totalSales },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း ဘောင်ချာအရေအတွက်', 'ပမာဏ': summary.totalVouchers },
    { 'အကြောင်းအရာ': 'ဒိုင်ကြီးထံ လွှဲတင်ငွေ', 'ပမာဏ': summary.totalForwarded },
    { 'အကြောင်းအရာ': 'လွှဲတင်ကော်မရှင် ရငွေ', 'ပမာဏ': summary.forwardedCommission },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း လျော်ကြေးငွေ', 'ပမာဏ': summary.totalPayout },
    { 'အကြောင်းအရာ': 'ဒိုင် အသားတင် အမြတ်/အရှုံး', 'ပမာဏ': summary.netProfit }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'စာရင်းချုပ်');

  const fileName = `2D_${round.drawDate}_${round.session}_${shopName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
