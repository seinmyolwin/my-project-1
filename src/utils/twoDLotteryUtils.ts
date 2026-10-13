import * as XLSX from 'xlsx';
import { convertMyanmarToEnglishDigits } from './lotteryUtils';
import { calculatePayout, formatAmount, safeRound, getLocalDateString } from './moneyUtils';
import {
  TwoDVoucher,
  TwoDForwardSlip,
  TwoDDrawRound,
  TwoDNumberAggregate,
  TwoDRoundSummary,
  TwoDBetItem,
  BetType
} from '../types';

/**
 * Check if a 2D round is closed based on round status (Only returns true if closed or settled, no auto-closing by time/date)
 */
export function is2DRoundClosed(round?: TwoDDrawRound): boolean {
  if (!round) return true;
  return round.status === 'closed' || round.status === 'settled';
}

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
// ဥပမာ- "4321" -> 43, 42, 41, 32, 31, 21 (၆ ကွက်)
export function getTwoDKhway(input: string): string[] {
  const normalized = convertMyanmarToEnglishDigits(input || '');
  const digits = Array.from(new Set(normalized.replace(/\D/g, '').split('')));
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
export function getTwoDKhwayPuu(input: string): string[] {
  const normalized = convertMyanmarToEnglishDigits(input || '');
  const digits = Array.from(new Set(normalized.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const khwayList = getTwoDKhway(input);
  const doublesList = digits.map((d) => `${d}${d}`);

  return [...khwayList, ...doublesList];
}

// ၃။ ခွေအာ (ခွေပြီး အာပါ လှည့်တွဲခြင်း / အပြန်အလှန် / အပူးမပါ)
// ဥပမာ- "1234" -> 12, 13, 14, 21, 23, 24, 31, 32, 34, 41, 42, 43 (၁၂ ကွက်)
export function getTwoDKhwayRumble(input: string): string[] {
  const normalized = convertMyanmarToEnglishDigits(input || '');
  const digits = Array.from(new Set(normalized.replace(/\D/g, '').split('')));
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
  const normalized = convertMyanmarToEnglishDigits(input || '');
  const digits = Array.from(new Set(normalized.replace(/\D/g, '').split('')));
  if (digits.length < 2) return [];

  const khwayRumbleList = getTwoDKhwayRumble(input);
  const doublesList = digits.map((d) => `${d}${d}`);

  return [...khwayRumbleList, ...doublesList];
}

// ====================================================
// 2D BATCH TEXT / SLIP PARSER
// ====================================================
export interface ParseTwoDBatchResult {
  items: TwoDBetItem[];
  warnings: string[];
}

export function parseTwoDBatchInput(
  text: string,
  defaultAmount: number = 1000
): TwoDBetItem[] | ParseTwoDBatchResult {
  const warnings: string[] = [];
  const items: TwoDBetItem[] = [];

  if (!text || !text.trim()) {
    return Array.isArray(arguments[0]) ? items : { items, warnings };
  }

  // 1. Convert Myanmar digits
  let cleanText = convertMyanmarToEnglishDigits(text);

  // 2. Strip thousands separators (e.g. 1,000 -> 1000, 10,000 -> 10000)
  cleanText = cleanText.replace(/(\b\d{1,3})(,\d{3})+\b/g, (m) => m.replace(/,/g, ''));

  // 3. Split lines by newlines
  const lines = cleanText.split(/[\r\n]+/);

  function processSingleLine(line: string) {
    // Pattern 0: Direct / Reverse slash ratio pattern (e.g. "23 45 26 800/200" or "34 46 37 1000/500")
    // Extracts direct numbers for the 1st amount, and reversal (အာ) numbers for the 2nd amount
    const slashRatioMatch = line.match(/^(.+?)\s*(?:=|:|-|\s)\s*(\d+)\s*\/\s*(\d+)\s*$/) ||
                            line.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)\s*$/);
    if (slashRatioMatch) {
      const numbersRaw = slashRatioMatch[1].trim();
      const directAmt = parseInt(slashRatioMatch[2], 10);
      const revAmt = parseInt(slashRatioMatch[3], 10);

      if (!isNaN(directAmt) && directAmt > 0 && !isNaN(revAmt) && revAmt > 0) {
        // Extract all number tokens
        const numTokens = numbersRaw.replace(/[=:\-,;*+]/g, ' ').split(/\s+/).filter(Boolean);
        const validTokens: string[] = [];

        for (const tok of numTokens) {
          if (/^\d{1,2}$/.test(tok)) {
            validTokens.push(tok.padStart(2, '0'));
          } else {
            warnings.push(`[${tok}] သည် 2D (00-99) ဂဏန်းမဟုတ်ပါ`);
          }
        }

        if (validTokens.length > 0) {
          validTokens.forEach((numStr) => {
            // 1. Direct bet (e.g. 23 = 800)
            items.push({
              id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              number: numStr,
              amount: directAmt,
              isRumble: false,
              betType: 'straight',
              originalInput: `${numStr} ဒဲ့ (${directAmt})`
            });

            // 2. Reverse / အာ bet (e.g. 32 = 200)
            const revs = getTwoDReversal(numStr);
            const reverseNum = revs.length > 1 ? revs[1] : revs[0];
            if (reverseNum !== numStr) {
              items.push({
                id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                number: reverseNum,
                amount: revAmt,
                isRumble: true,
                betType: 'rumble',
                originalInput: `${numStr} အာ (${reverseNum} = ${revAmt})`
              });
            } else {
              // If double number (e.g. 22), add reversal with revAmt
              items.push({
                id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                number: numStr,
                amount: revAmt,
                isRumble: true,
                betType: 'rumble',
                originalInput: `${numStr} အာ (${revAmt})`
              });
            }
          });
          return;
        }
      }
    }

    // Pattern 1: ခွေပူးအာ / ခွေပူးr (Khway + Puu + Rumble)
    if (/(?:ခွေပူး(?:r|အာ)|ခွေ\s*ပူး\s*(?:r|အာ)|ပါခွေ(?:r|အာ)|ခွေ(?:r|အာ)ပူး)/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhwayPuuRumble(rawDigits);
        const groupId = `r2d-batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            isRumble: true,
            betType: 'rumble',
            groupId,
            originalNumber: rawDigits,
            originalAmount: amt,
            permutations: generated,
            originalInput: `${rawDigits} ခွေပူးr`
          });
        });
        return;
      }
    }

    // Pattern 2: ခွေအာ / ခွေr (Khway + Rumble, no doubles)
    if (/(?:ခွေ(?:r|အာ)|ခွေ\s*(?:r|အာ))/i.test(line) && !/ပူး/i.test(line)) {
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const rawDigits = nums[0];
        const amt = nums.length > 1 ? parseInt(nums[1], 10) : defaultAmount;
        const generated = getTwoDKhwayRumble(rawDigits);
        const groupId = `r2d-batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        generated.forEach((num) => {
          items.push({
            id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            number: num,
            amount: amt,
            isRumble: true,
            betType: 'rumble',
            groupId,
            originalNumber: rawDigits,
            originalAmount: amt,
            permutations: generated,
            originalInput: `${rawDigits} ခွေr`
          });
        });
        return;
      }
    }

    // Pattern 3: ခွေပူး (Khway + Puu, no rumble)
    if (/(?:ခွေပူး|ခွေ\s*ပူး|ပါခွေ)/i.test(line) && !/(?:r|အာ)/i.test(line)) {
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
        return;
      }
    }

    // Pattern 4: ခွေ (ရိုးရိုးခွေ, no doubles, no rumble)
    if (/ခွေ/i.test(line) && !/ပူး|(?:r|အာ)/i.test(line)) {
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
        return;
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
      return;
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
      return;
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
      return;
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
      return;
    }

    // Pattern: "5 ဘရိတ် 1000" or "0 ဘရိတ် 1000" or "ဘရိတ် 5 1000"
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
        return;
      }
    }

    // Pattern: "5 ပါ 1000", "5ပါ 500", "အပါ 5 1000"
    if (/(?:အပါ|ပါ)/i.test(line) && !/ပါဝါ/i.test(line)) {
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
        return;
      }
    }

    // Pattern: "5 ထိပ် 1000", "ထိပ် 5 1000", "1 ရှေ့ပိတ် 1000"
    if (/(?:ရှေ့ပိတ်|ရှေ့စီး|ထိပ်)/i.test(line)) {
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
        return;
      }
    }

    // Pattern: "2 နောက်ပိတ် 1000", "5 နောက် 1000", "5 ပိတ် 1000"
    if (/(?:နောက်ပိတ်|နောက်စီး|နောက်|ပိတ်)/i.test(line) && !/(?:ရှေ့ပိတ်|ရှေ့စီး)/i.test(line)) {
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
        return;
      }
    }

    // Pattern: "စုံစုံ", "မမ", "စုံမ", "မစုံ"
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
      return;
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
      return;
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
      return;
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
      return;
    }

    // Segment parsing for comma/space or multi-number R patterns like "47 40 70r500" or "41 43 45 47 49r250"
    const commaSegments = line.split(',').map(s => s.trim()).filter(Boolean);
    const isIndependentSegments = commaSegments.length > 1 && commaSegments.every(seg => {
      const numMatch = seg.match(/\d+/g);
      return numMatch && numMatch.length >= 2;
    });

    const segmentsToProcess = isIndependentSegments ? commaSegments : [line];

    for (const segment of segmentsToProcess) {
      // Check if segment or whole line has r/R/အာ/ပတ်လည်/ပတ်
      const isRumble = /(?:r|R|အာ|ပတ်လည်|ပတ်)/i.test(segment);
      
      if (isRumble) {
        // Extract all numbers and the last amount if present
        // e.g. "47 40 70r500" -> numbers: [47, 40, 70], amt: 500
        // e.g. "41 43 45 47 49r250" -> numbers: [41, 43, 45, 47, 49], amt: 250
        // e.g. "15r1500" -> numbers: [15], amt: 1500
        const allNums = segment.match(/\d+/g);
        if (allNums && allNums.length >= 1) {
          let betAmount = defaultAmount;
          let numTokens: string[] = [];

          // If the last token is an amount (>= 3 digits or explicitly specified after r), separate it
          // Check if the last token in segment has amount
          const lastNum = allNums[allNums.length - 1];
          const parsedLast = parseInt(lastNum, 10);

          // If more than 1 number and last number is amount (or specifically if segment ends with amount after r)
          if (allNums.length >= 2 && (parsedLast >= 100 || segment.match(/(?:r|R|အာ|ပတ်လည်|ပတ်)\s*\d+/))) {
            betAmount = parsedLast;
            numTokens = allNums.slice(0, allNums.length - 1);
          } else if (allNums.length === 1) {
            numTokens = allNums;
          } else {
            // If all numbers are 2 digits (e.g. 77 00), wait, if no amount specified at end, use defaultAmount
            numTokens = allNums;
          }

          // Generate permutations for ALL collected number tokens in this segment
          const groupId = `r2d-batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          numTokens.forEach(token => {
            if (!/^\d{1,2}$/.test(token)) return;
            const numStr = token.padStart(2, '0');
            const revs = getTwoDReversal(numStr);
            revs.forEach(r => {
              items.push({
                id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                number: r,
                amount: betAmount,
                isRumble: true,
                betType: 'rumble',
                groupId,
                originalNumber: numStr,
                originalAmount: betAmount,
                permutations: revs,
                originalInput: `${numStr} R`
              });
            });
          });
          continue;
        }
      }

      const cleanSeg = segment.replace(/(?:r|R|အာ|ပတ်လည်|ပတ်)/gi, ' ');
      const rawTokens = cleanSeg.replace(/[=:\-_/,*+]/g, ' ').split(/\s+/).filter(Boolean);

      if (rawTokens.length === 0) continue;

      let betAmount = defaultAmount;
      let rawNumberTokens: string[] = [];

      if (rawTokens.length === 1) {
        rawNumberTokens.push(rawTokens[0]);
      } else {
        const lastToken = rawTokens[rawTokens.length - 1];
        const parsedAmt = parseInt(lastToken, 10);

        if (!isNaN(parsedAmt) && parsedAmt > 0 && lastToken.length >= 3 && !/^\d{2}$/.test(lastToken)) {
          betAmount = parsedAmt;
          rawNumberTokens = rawTokens.slice(0, rawTokens.length - 1);
        } else if (!isNaN(parsedAmt) && parsedAmt > 0 && rawTokens.length > 1) {
          betAmount = parsedAmt;
          rawNumberTokens = rawTokens.slice(0, rawTokens.length - 1);
        } else {
          rawNumberTokens = rawTokens;
        }
      }

      for (const token of rawNumberTokens) {
        if (!/^\d{1,2}$/.test(token)) {
          warnings.push(`[${token}] သည် 2D (00-99) ဂဏန်းမဟုတ်ပါ`);
          continue;
        }

        const numStr = token.padStart(2, '0');
        items.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: numStr,
          amount: betAmount,
          isRumble: false,
          betType: 'straight',
          originalInput: numStr
        });
      }
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const prevItemsCount = items.length;
    const prevWarningsCount = warnings.length;

    processSingleLine(line);

    if (items.length === prevItemsCount && warnings.length === prevWarningsCount) {
      warnings.push(`[${line}] သည် တရားဝင် 2D ဂဏန်း သို့မဟုတ် ပုံစံမဟုတ်ပါ`);
    }
  }

  // Attach warnings array property onto items for components expecting array direct return or property
  (items as any).warnings = warnings;
  return items;
}

// ====================================================
// 2D WINNING EVALUATION & PROFIT CALCULATION
// ====================================================
export function normalizeTwoDMultiplier(val?: number): number {
  if (!val || isNaN(val) || val <= 0) return 80;
  return Math.round(val);
}

export function evaluateTwoDWinnings(
  vouchers: TwoDVoucher[],
  winningNumber: string,
  multiplier: number
): {
  settledVouchers: TwoDVoucher[];
  totalPayout: number;
  totalWinnersCount: number;
} {
  let totalPayout = 0;
  let totalWinnersCount = 0;

  const mult = normalizeTwoDMultiplier(multiplier);

  const settledVouchers = vouchers.map(v => {
    let voucherHasWin = false;
    const updatedItems = v.items.map(item => {
      if (item.number === winningNumber) {
        const winAmt = calculatePayout(item.amount, mult);
        console.log(`[DEBUG] evaluateTwoDWinnings: item.number=${item.number}, item.amount=${item.amount}, winAmt=${winAmt}`);
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

    const newStatus: TwoDVoucher['status'] = v.status === 'cancelled' ? 'cancelled' : voucherHasWin ? 'settled' : 'active';

    return {
      ...v,
      status: newStatus,
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
  const winningNumber = round.winningNumber;

  // 0. Metadata Sheet (ပွဲစဉ်အချက်အလက်)
  const metaRows = [
    { 'Property': 'System', 'Value': 'ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ်' },
    { 'Property': 'RoundName', 'Value': round.name },
    { 'Property': 'DrawDate', 'Value': round.drawDate },
    { 'Property': 'Session', 'Value': round.session },
    { 'Property': 'ClosingTime', 'Value': round.closingTime || '12:01' },
    { 'Property': 'WinningNumber', 'Value': winningNumber || '' },
    { 'Property': 'Multiplier', 'Value': round.multiplier || 80 },
    { 'Property': 'CommissionRate', 'Value': round.commissionRate || 5 },
    { 'Property': 'ExportTimestamp', 'Value': new Date().toISOString() }
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'ပွဲစဉ်အချက်အလက်');

  // Sheet 1: 00-99 Ledger
  const ledgerData = Object.keys(aggregates)
    .sort((a, b) => a.localeCompare(b))
    .map(num => {
      const agg = aggregates[num];
      const isWinner = num === winningNumber;
      return {
        'ဂဏန်း (Number)': num,
        'စုစုပေါင်း ရောင်းရငွေ (Total Sold)': agg.totalSold,
        'ဒိုင်ကြီးဆီ လွှဲတင်ငွေ (Forwarded)': agg.forwardedAmount,
        'ဒိုင်လက်ကျန်ယူငွေ (Retained)': agg.retainedAmount,
        'သတ်မှတ်ဘရိတ် (Limit)': agg.limit,
        'လက်ခံမှု အခြေအနေ (Status)': isWinner 
          ? 'ပေါက်ဂဏန်း (WINNER) ★★★' 
          : agg.isBlocked 
          ? 'ဒိုင်ကာ (Blocked)' 
          : 'လက်ခံသည်',
        'ဖြစ်နိုင်ခြေ လျော်ကြေး (Payout)': agg.estimatedPayout,
        'အန္တရာယ်အဆင့် (Risk)': isWinner ? 'WINNER' : agg.riskLevel.toUpperCase()
      };
    });
  const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsLedger, '၂ လုံး စာရင်းချုပ် (00-99)');

  // Sheet 2: Vouchers
  const voucherData = vouchers.map(v => {
    const statusText = v.status === 'cancelled'
      ? 'ပယ်ဖျက်ထားသည် (Cancelled)'
      : v.isPaid
      ? 'ပေးပြီး (Paid)'
      : 'မပေးရသေး (Unpaid)';

    return {
      'ဘောင်ချာနံပါတ် (Voucher No)': v.voucherNo,
      'ထိုးသူအမည် (Customer)': v.customerName,
      'ဖုန်းနံပါတ် (Phone)': v.customerPhone || '-',
      'ထိုးဂဏန်းများ (Bets)': v.items.map(i => `${i.number}=${i.amount}`).join(', '),
      'စုစုပေါင်း ထိုးကြေး (Total Stake)': v.subtotal,
      'ကော်မရှင်/လျှော့ငွေ (Commission)': v.discountAmount,
      'အသားတင်ကျသင့်ငွေ (Net Amount)': v.netPayable,
      'ရက်စွဲ/အချိန် (Date)': new Date(v.createdAt).toLocaleString('en-GB'),
      'အခြေအနေ (Status)': statusText,
      'မှတ်ချက် (Notes)': v.notes || '-'
    };
  });
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

  // Sheet 4: ပေါက်မဲစာရင်းရှင်းတမ်း (Winners Settlement Sheet if winning number exists)
  if (winningNumber) {
    const winEval = evaluateTwoDWinnings(vouchers, winningNumber, round.multiplier || 0);
    const winData: any[] = [];
    
    winEval.settledVouchers.forEach(v => {
      v.items.forEach(it => {
        if (it.isWon) {
          winData.push({
            'ဘောင်ချာအမှတ်': v.voucherNo,
            'ထိုးသူအမည်': v.customerName,
            'ဖုန်းနံပါတ်': v.customerPhone || '-',
            'ပေါက်ဂဏန်း': it.number,
            'ထိုးကြေးငွေ': it.amount,
            'အလျော်ဆ (Multiplier)': `${round.multiplier || 0}ဆ`,
            'ရရှိသောလျော်ကြေးငွေ': it.wonAmount,
            'ဒိုင် အသားတင် ရလဒ်': -(it.wonAmount)
          });
        }
      });
    });

    if (winData.length === 0) {
      winData.push({
        'ဘောင်ချာအမှတ်': 'ပေါက်သူမရှိပါ',
        'ထိုးသူအမည်': '-',
        'ဖုန်းနံပါတ်': '-',
        'ပေါက်ဂဏန်း': winningNumber,
        'ထိုးကြေးငွေ': '-',
        'အလျော်ဆ (Multiplier)': '-',
        'ရရှိသောလျော်ကြေးငွေ': '-',
        'ဒိုင် အသားတင် ရလဒ်': '-'
      });
    }

    const wsWinners = XLSX.utils.json_to_sheet(winData);
    XLSX.utils.book_append_sheet(wb, wsWinners, 'ပေါက်မဲစာရင်းရှင်းတမ်း');
  }

  // Sheet 5: Summary
  const summaryData = [
    { 'အကြောင်းအရာ': 'ပွဲစဉ်အမည်', 'ပမာဏ': round.name },
    { 'အကြောင်းအရာ': 'ဖွင့်ရက်စွဲ', 'ပမာဏ': round.drawDate },
    { 'အကြောင်းအရာ': 'အချိန်ပိုင်း', 'ပမာဏ': round.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀' },
    { 'အကြောင်းအရာ': 'ပေါက်ဂဏန်း', 'ပမာဏ': winningNumber || 'မဖွင့်သေးပါ' },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း အရောင်းရငွေ', 'ပမာဏ': summary.totalSales },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း ဘောင်ချာအရေအတွက်', 'ပမာဏ': summary.totalVouchers },
    { 'အကြောင်းအရာ': 'ဒိုင်ကြီးထံ လွှဲတင်ငွေ', 'ပမာဏ': summary.totalForwarded },
    { 'အကြောင်းအရာ': 'လွှဲတင်ကော်မရှင် ရငွေ', 'ပမာဏ': summary.forwardedCommission },
    { 'အကြောင်းအရာ': 'ဖောက်သည် စုစုပေါင်း ပေါက်ငွေ', 'ပမာဏ': summary.totalPayout },
    { 'အကြောင်းအရာ': 'ဒိုင် ကိုယ်တိုင် ပေးရန် ပေါက်ငွေ (Retained Payout)', 'ပမာဏ': summary.retainedPayout ?? summary.totalPayout },
    { 'အကြောင်းအရာ': 'ဒိုင် အသားတင် အမြတ်/အရှုံး', 'ပမာဏ': summary.netProfit }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'စာရင်းချုပ်');

  const fileName = `2D_${round.drawDate}_${round.session}_${shopName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Parse exported 2D Excel round report to restore round and vouchers
 */
export async function parseExcelToRoundData2D(file: File): Promise<{
  roundName: string;
  winningNumber?: string;
  multiplier: number;
  commissionRate: number;
  drawDate: string;
  session: string;
  closingTime: string;
  vouchers: any[];
} | null> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    const sheetName = workbook.SheetNames.find(n => n.includes('ဘောင်ချာ') || n.includes('Voucher')) || workbook.SheetNames[1] || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;

    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) return null;

    let roundName = file.name.replace(/\.[^/.]+$/, '').replace(/2D_/g, '').replace(/_/g, ' ');
    let winningNumber: string | undefined = undefined;
    let multiplier = 80;
    let commissionRate = 5;
    let drawDate = new Date().toISOString().slice(0, 10);
    let session = 'morning';
    let closingTime = '12:01';

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
      if (metaMap['Session']) session = metaMap['Session'];
      if (metaMap['ClosingTime']) closingTime = metaMap['ClosingTime'];
      if (metaMap['WinningNumber'] && /^\d{2}$/.test(metaMap['WinningNumber'])) winningNumber = metaMap['WinningNumber'];
      if (metaMap['Multiplier']) multiplier = parseInt(metaMap['Multiplier'], 10) || 80;
      if (metaMap['CommissionRate']) commissionRate = parseFloat(metaMap['CommissionRate']) || 5;
    } else {
      const summarySheetName = workbook.SheetNames.find(n => n.includes('စာရင်းချုပ်') || n.includes('Summary'));
      if (summarySheetName) {
        const sumRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[summarySheetName]);
        for (const r of sumRows) {
          const key = String(r['အကြောင်းအရာ'] || '').trim();
          const val = String(r['ပမာဏ'] || '').trim();
          if (key.includes('ပေါက်ဂဏန်း') && /^\d{2}$/.test(val)) {
            winningNumber = val;
            break;
          }
        }
      }
      if (!winningNumber) {
        const winSheetName = workbook.SheetNames.find(n => n.includes('ပေါက်မဲ') || n.includes('Winners'));
        if (winSheetName) {
          const winRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[winSheetName]);
          for (const r of winRows) {
            const val = String(r['ပေါက်ဂဏန်း'] || '').trim();
            if (/^\d{2}$/.test(val)) {
              winningNumber = val;
              break;
            }
          }
        }
      }
    }

    const vouchers: any[] = [];
    let idCounter = 1;

    for (const r of rows) {
      const voucherNo = String(r['ဘောင်ချာအမှတ် (Voucher No)'] || r['ဘောင်ချာအမှတ်'] || `2D-V-${Date.now()}-${idCounter}`);
      const customerName = String(r['ဝယ်သူအမည် (Customer)'] || r['ထိုးသူအမည်'] || 'အမည်မသိ');
      const phone = String(r['ဖုန်းနံပါတ် (Phone)'] || r['ဖုန်းနံပါတ်'] || '');
      const betsStr = String(r['ထိုးဂဏန်းများ (Bets)'] || r['ထိုးဂဏန်းများ'] || '');
      const subtotal = parseFloat(String(r['စုစုပေါင်း ထိုးကြေး (Total Stake)'] || r['ထိုးကြေးငွေ'] || '0').replace(/[^0-9.]/g, '')) || 0;
      const discount = parseFloat(String(r['ကော်မရှင်/လျှော့ငွေ (Commission)'] || '0').replace(/[^0-9.]/g, '')) || 0;
      const net = parseFloat(String(r['အသားတင်ကျသင့်ငွေ (Net Amount)'] || subtotal - discount).replace(/[^0-9.]/g, '')) || subtotal;
      const statusStr = String(r['အခြေအနေ (Status)'] || r['ရှင်းပြီး/မပြီး'] || '');
      const isCancelled = statusStr.includes('ပယ်ဖျက်') || statusStr.includes('Cancelled');
      const isPaid = statusStr.includes('ပေးပြီး') || statusStr.includes('Paid') || statusStr.includes('ငွေရှင်းပြီး');

      const items: any[] = [];
      const parts = betsStr.split(/[,;]+/);
      for (const p of parts) {
        const sub = p.trim();
        const match = sub.match(/^(\d{2})\s*(?:=|-|:)\s*(\d+)$/) || sub.match(/^(\d{2})\s+(\d+)$/);
        if (match) {
          items.push({
            id: `item-2d-imp-${idCounter++}`,
            number: match[1],
            amount: parseInt(match[2], 10) || 1000,
            betType: 'straight' as const,
            originalInput: sub
          });
        }
      }

      if (items.length === 0) {
        items.push({
          id: `item-2d-imp-${idCounter++}`,
          number: '00',
          amount: subtotal || 1000,
          betType: 'straight' as const,
          originalInput: betsStr || '00'
        });
      }

      vouchers.push({
        id: `voucher-2d-imp-${Date.now()}-${idCounter++}`,
        roundId: '',
        voucherNo,
        customerName,
        customerPhone: phone !== '-' ? phone : undefined,
        items,
        subtotal: subtotal || items.reduce((s, i) => s + i.amount, 0),
        discountRate: 5,
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
      commissionRate,
      drawDate,
      session,
      closingTime,
      vouchers
    };
  } catch (err) {
    console.error('Failed to parse 2D Excel round:', err);
    return null;
  }
}

