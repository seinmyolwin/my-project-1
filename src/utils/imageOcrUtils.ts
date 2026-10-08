import { BetItem } from '../types';
import { getPermutations, convertMyanmarToEnglishDigits } from './lotteryUtils';
import {
  TWO_D_DOUBLES,
  TWO_D_POWER,
  TWO_D_NATKHAT,
  TWO_D_BROTHERS,
  getTwoDBreakNumbers,
  getTwoDHeadNumbers,
  getTwoDTailNumbers
} from './twoDLotteryUtils';

export interface ExtractedBetRow {
  id: string;
  number: string;
  amount: number;
  isRumble: boolean;
  originalRaw: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseImageResult {
  customerName: string;
  customerPhone: string;
  extractedItems: ExtractedBetRow[];
  totalAmount: number;
  rawText: string;
  warnings: string[];
}

/**
 * Filter and enhance an image canvas for optimal OCR accuracy.
 * Enhances contrast, converts to grayscale, and thresholds text.
 */
export function preprocessCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { contrast: number; brightness: number; threshold: boolean; grayscale: boolean }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  // Limit max dimensions for speedy OCR processing
  const maxDim = 1800;
  let w = sourceCanvas.width;
  let h = sourceCanvas.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
  const brightnessOffset = options.brightness;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Grayscale luminance
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Brightness & Contrast
    gray = contrastFactor * (gray - 128) + 128 + brightnessOffset;
    gray = Math.min(255, Math.max(0, gray));

    if (options.threshold) {
      // Adaptive binary threshold
      gray = gray > 140 ? 255 : 0;
    }

    if (options.grayscale || options.threshold) {
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    } else {
      data[i] = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128 + brightnessOffset));
      data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128 + brightnessOffset));
      data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128 + brightnessOffset));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Parse extracted OCR raw text into structured lottery rows, customer name, and phone.
 * Supports:
 * - 3D Bets (123=1000, 123-500, 123 1000, 123R 500, 123ပတ် 1000)
 * - 2D Bets (24=1000, 24-500, 24 1000, 24R 500, အပူး 1000, 5 ဘရိတ် 2000, etc.)
 * - Telegram chat screenshots and messages
 * - Chat timestamps & metadata filtering
 * - Myanmar numerals (၀-၉) and English digits (0-9)
 */
export function parseSlipImageText(
  rawText: string,
  targetMode: '3d' | '2d' | 'auto' = 'auto'
): ParseImageResult {
  const warnings: string[] = [];
  const extractedItems: ExtractedBetRow[] = [];
  let customerName = '';
  let customerPhone = '';

  if (!rawText || !rawText.trim()) {
    return {
      customerName: '',
      customerPhone: '',
      extractedItems: [],
      totalAmount: 0,
      rawText: '',
      warnings: ['စာသား ဖတ်မရပါ သို့မဟုတ် ပုံရိပ် မရှင်းလင်းပါ']
    };
  }

  const rawLines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let idCounter = 1;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const rawLine = rawLines[lineIndex];

    // Filter out common Telegram chat timestamps and headers
    if (
      /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?$/i.test(rawLine) ||
      /^(?:today|yesterday|delivered|seen|read|online|typing|forwarded|telegram|screenshot)$/i.test(rawLine) ||
      /^(?:kbzpay|kpay|wavepay|wave money|transaction|ref no|transferred|successful|ကျပ်)$/i.test(rawLine)
    ) {
      continue;
    }

    // 1. Detect Customer Name keywords
    const nameMatch = rawLine.match(/(?:နာမည်|ဝယ်သူ|ထိုးသူ|အမည်|name|customer|cust)\s*[:=\-]\s*([^\d\n]+)/i);
    if (nameMatch && nameMatch[1] && !customerName) {
      customerName = nameMatch[1].trim();
      continue;
    }

    // Burmese honorifics detection for name
    const honorificMatch = rawLine.match(/^(?:ဦး|ဒေါ်|ကို|မ|ဆရာ|ဆရာမ)\s+([^\d\n=/*-]+)/);
    if (honorificMatch && honorificMatch[0] && !customerName) {
      customerName = honorificMatch[0].trim();
      continue;
    }

    // 2. Detect Customer Phone keywords
    const phoneMatch =
      rawLine.match(/(?:ဖုန်း|phone|ph|tel)\s*[:=\-]?\s*([0-9\-\+\s]{9,15})/i) ||
      rawLine.match(/((?:09|\+959|959)[0-9\-\s]{7,12})/);
    if (phoneMatch && phoneMatch[1] && !customerPhone) {
      customerPhone = phoneMatch[1].replace(/[^0-9+]/g, '').trim();
      continue;
    }

    // If first line has no numbers and looks like a name (e.g. "Ko Aung Kyaw" or "မသီတာ")
    if (
      lineIndex === 0 &&
      !customerName &&
      !/\d/.test(rawLine) &&
      rawLine.length >= 2 &&
      rawLine.length < 30
    ) {
      customerName = rawLine;
      continue;
    }

    // 3. Normalize digits from Myanmar to English
    const convertedLine = convertMyanmarToEnglishDigits(rawLine);

    // Clean common OCR noise and currency symbols
    const cleanedLine = convertedLine
      .replace(/([0-9])([oO])([0-9])/g, '$10$3')
      .replace(/([0-9])([lI])([0-9])/g, '$11$3')
      .replace(/(?:ကျပ်|ks|k|kyat|ဘတ်|thb)/gi, '')
      .replace(/\s*စီ(?:\s|$)/g, ' ') // Strip Myanmar 'စီ' (each)
      .replace(/[|]/g, ' ')
      .trim();

    let foundInLine = false;

    // ====================================================
    // A. 2D SPECIFIC KEYWORDS (အပူး၊ ဘရိတ်၊ ထိပ်၊ နောက်၊ ပါဝါ၊ နက္ခတ်၊ ညီကို)
    // ====================================================
    if (targetMode === '2d' || targetMode === 'auto') {
      // 0. Paired 2D notation: e.g. "24/42=1000", "24-42=1000", "24,42=500"
      const pairedMatch = cleanedLine.match(/^([0-9]{2})\s*[/,\-]\s*([0-9]{2})\s*[=:\-_/*x\s]\s*([0-9]+)$/);
      if (pairedMatch) {
        const num1 = pairedMatch[1];
        const num2 = pairedMatch[2];
        const amt = parseInt(pairedMatch[3], 10);
        if (amt > 0) {
          extractedItems.push({
            id: `scan-${Date.now()}-${idCounter++}`,
            number: num1,
            amount: amt,
            isRumble: false,
            originalRaw: `${num1}=${amt}`,
            isValid: true
          });
          extractedItems.push({
            id: `scan-${Date.now()}-${idCounter++}`,
            number: num2,
            amount: amt,
            isRumble: true,
            originalRaw: `${num2}=${amt}`,
            isValid: true
          });
          foundInLine = true;
          continue;
        }
      }
      // 1. အပူး (Doubles)
      const doubleMatch = cleanedLine.match(/(?:အပူး|double)\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (doubleMatch) {
        const amt = parseInt(doubleMatch[1], 10);
        if (amt > 0) {
          TWO_D_DOUBLES.forEach(d => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: d,
              amount: amt,
              isRumble: false,
              originalRaw: `${d}=${amt} (အပူး)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 2. ဘရိတ် (Breaks: e.g. 5 ဘရိတ် 2000)
      const breakMatch = cleanedLine.match(/([0-9])\s*ဘရိတ်\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (breakMatch) {
        const brk = parseInt(breakMatch[1], 10);
        const amt = parseInt(breakMatch[2], 10);
        if (brk >= 0 && brk <= 9 && amt > 0) {
          const brkNums = getTwoDBreakNumbers(brk);
          brkNums.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (${brk} ဘရိတ်)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 3. ထိပ် (Head: e.g. 1 ထိပ် 500)
      const headMatch = cleanedLine.match(/([0-9])\s*ထိပ်\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (headMatch) {
        const headDigit = parseInt(headMatch[1], 10);
        const amt = parseInt(headMatch[2], 10);
        if (headDigit >= 0 && headDigit <= 9 && amt > 0) {
          const headNums = getTwoDHeadNumbers(headDigit);
          headNums.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (${headDigit} ထိပ်)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 4. နောက် (Tail: e.g. 8 နောက် 1000)
      const tailMatch = cleanedLine.match(/([0-9])\s*နောက်\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (tailMatch) {
        const tailDigit = parseInt(tailMatch[1], 10);
        const amt = parseInt(tailMatch[2], 10);
        if (tailDigit >= 0 && tailDigit <= 9 && amt > 0) {
          const tailNums = getTwoDTailNumbers(tailDigit);
          tailNums.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (${tailDigit} နောက်)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 5. ပါဝါ (Power)
      const powerMatch = cleanedLine.match(/(?:ပါဝါ|power)\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (powerMatch) {
        const amt = parseInt(powerMatch[1], 10);
        if (amt > 0) {
          TWO_D_POWER.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (ပါဝါ)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 6. နက္ခတ် (Natkhat)
      const natkhatMatch = cleanedLine.match(/(?:နက္ခတ်|natkhat)\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (natkhatMatch) {
        const amt = parseInt(natkhatMatch[1], 10);
        if (amt > 0) {
          TWO_D_NATKHAT.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (နက္ခတ်)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 7. ညီကို (Brothers)
      const brotherMatch = cleanedLine.match(/(?:ညီကို|brothers)\s*[=:\-_/*x\s]?\s*([0-9]+)/i);
      if (brotherMatch) {
        const amt = parseInt(brotherMatch[1], 10);
        if (amt > 0) {
          TWO_D_BROTHERS.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n}=${amt} (ညီကို)`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }

      // 8. 2D R/Rumble / Reversal: e.g. "24R 1000", "24 R 500", "24ပတ် 1000", "24အာ 500"
      const twoDRMatch = cleanedLine.match(/([0-9]{2})\s*(?:r|R|ပတ်|ခွေ|အာ|ပတ်လည်)\s*[=:\-_/]?\s*([0-9]+)/i);
      if (twoDRMatch) {
        const baseNum = twoDRMatch[1];
        const amt = parseInt(twoDRMatch[2], 10);
        if (amt > 0) {
          const rev = baseNum.split('').reverse().join('');
          extractedItems.push({
            id: `scan-${Date.now()}-${idCounter++}`,
            number: baseNum,
            amount: amt,
            isRumble: false,
            originalRaw: `${baseNum}=${amt}`,
            isValid: true
          });
          if (rev !== baseNum) {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: rev,
              amount: amt,
              isRumble: true,
              originalRaw: `${rev}=${amt} (R)`,
              isValid: true
            });
          }
          foundInLine = true;
          continue;
        }
      }
    }

    // ====================================================
    // B. 3D RUMBLE / PERMUTATIONS PATTERNS
    // ====================================================
    if (targetMode === '3d' || targetMode === 'auto') {
      const rRegex = /([0-9]{3})\s*(?:r|R|ပတ်|ခွေ|ပတ်လည်)\s*[=:\-_/]?\s*([0-9]+)/i;
      const rMatch = cleanedLine.match(rRegex);
      if (rMatch) {
        const baseNum = rMatch[1];
        const amount = parseInt(rMatch[2], 10);
        if (amount > 0) {
          const perms = getPermutations(baseNum);
          perms.forEach((p, idx) => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: p,
              amount: amount,
              isRumble: true,
              originalRaw: `${baseNum} R (${perms.length} ခွေ - ${idx + 1})`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }
    }

    // ====================================================
    // C. MULTIPLE NUMBERS ON SAME LINE
    // ====================================================
    // 3D Multi: "123, 456, 789 = 1000" or "123 456 789 - 500"
    if (targetMode === '3d' || targetMode === 'auto') {
      const multiMatch3D = cleanedLine.match(/^([0-9]{3}(?:[\s,;/]+[0-9]{3})+)\s*[=:\-_/*x\s]\s*([0-9]+)$/);
      if (multiMatch3D) {
        const nums = multiMatch3D[1].split(/[\s,;/]+/).filter(s => s.length === 3);
        const amt = parseInt(multiMatch3D[2], 10);
        if (amt > 0 && nums.length > 0) {
          nums.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n} (${amt})`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }
    }

    // 2D Multi: "24, 35, 78 = 1000" or "24 35 78 - 500"
    if (targetMode === '2d' || targetMode === 'auto') {
      const multiMatch2D = cleanedLine.match(/^([0-9]{2}(?:[\s,;/]+[0-9]{2})+)\s*[=:\-_/*x\s]\s*([0-9]+)$/);
      if (multiMatch2D) {
        const nums = multiMatch2D[1].split(/[\s,;/]+/).filter(s => s.length === 2);
        const amt = parseInt(multiMatch2D[2], 10);
        if (amt > 0 && nums.length > 0) {
          nums.forEach(n => {
            extractedItems.push({
              id: `scan-${Date.now()}-${idCounter++}`,
              number: n,
              amount: amt,
              isRumble: false,
              originalRaw: `${n} (${amt})`,
              isValid: true
            });
          });
          foundInLine = true;
          continue;
        }
      }
    }

    // ====================================================
    // D. STANDARD PAIRS: NUMBER + AMOUNT
    // ====================================================
    // Formats: "123=1000", "24=500", "123-500", "24 1000", "123:5000", "24/1000", "123*500", "24x1000"
    const digitLengthRegex = targetMode === '2d' ? '([0-9]{2})' : targetMode === '3d' ? '([0-9]{3})' : '([0-9]{2,3})';
    const standardRegex = new RegExp(`${digitLengthRegex}\\s*[=:\\-_/*x\\s]\\s*([0-9]{2,8})`, 'g');
    let match: RegExpExecArray | null;

    while ((match = standardRegex.exec(cleanedLine)) !== null) {
      foundInLine = true;
      const num = match[1];
      const amt = parseInt(match[2], 10);

      const isValidLen = targetMode === '2d' ? num.length === 2 : targetMode === '3d' ? num.length === 3 : (num.length === 2 || num.length === 3);

      if (isValidLen && amt > 0) {
        extractedItems.push({
          id: `scan-${Date.now()}-${idCounter++}`,
          number: num,
          amount: amt,
          isRumble: false,
          originalRaw: match[0],
          isValid: true
        });
      }
    }

    // ====================================================
    // E. FALLBACK TOKEN PARSING (e.g. "123 1000" or "24 500")
    // ====================================================
    if (!foundInLine) {
      const tokens = cleanedLine.replace(/[^0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const first = tokens[0];
        const second = tokens[1];
        const amt = parseInt(second, 10);
        const isValidLen = targetMode === '2d' ? first.length === 2 : targetMode === '3d' ? first.length === 3 : (first.length === 2 || first.length === 3);

        if (isValidLen && amt > 0) {
          extractedItems.push({
            id: `scan-${Date.now()}-${idCounter++}`,
            number: first,
            amount: amt,
            isRumble: false,
            originalRaw: `${first}=${amt}`,
            isValid: true
          });
          foundInLine = true;
        }
      }
    }

    if (!foundInLine && /\d/.test(cleanedLine) && cleanedLine.length >= 3) {
      warnings.push(`ဖတ်မရသော အကြောင်းအရာ: "${rawLine}"`);
    }
  }

  const totalAmount = extractedItems.reduce((acc, it) => acc + (it.isValid ? it.amount : 0), 0);

  return {
    customerName: customerName || 'အထွေထွေ (Photo / Chat Entry)',
    customerPhone,
    extractedItems,
    totalAmount,
    rawText,
    warnings
  };
}

/**
 * Perform offline OCR using Tesseract.js with robust fallback to 'eng'
 */
export async function performOfflineOCR(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number, statusText: string) => void
): Promise<string> {
  const { createWorker } = await import('tesseract.js');

  onProgress?.(10, 'OCR Engine စတင်နေပါသည် (Initializing Offline OCR)...');

  let worker: any = null;

  try {
    worker = await createWorker('eng+mya', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress?.(20 + Math.round(pct * 0.75), `ဂဏန်းစာရင်း ဖတ်ယူနေပါသည်... (${pct}%)`);
        }
      }
    });
  } catch (err) {
    console.warn('eng+mya worker initialization failed, falling back to eng:', err);
    onProgress?.(15, 'English OCR Engine ဖြင့် ဆက်လက်ဆောင်ရွက်နေပါသည်...');
    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress?.(20 + Math.round(pct * 0.75), `ဂဏန်းစာရင်း ဖတ်ယူနေပါသည်... (${pct}%)`);
        }
      }
    });
  }

  try {
    onProgress?.(30, 'ပုံရိပ်အား စစ်ဆေးဖတ်ယူနေပါသည် (Recognizing Digits & Text)...');
    const ret = await worker.recognize(canvas);
    await worker.terminate();
    onProgress?.(100, 'ဖတ်ယူမှု ပြီးစီးပါပြီ (Done)');
    return ret.data.text;
  } catch (err) {
    try {
      await worker.terminate();
    } catch {
      // ignore
    }
    throw err;
  }
}
