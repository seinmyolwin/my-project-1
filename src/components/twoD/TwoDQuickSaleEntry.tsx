import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Check,
  Smartphone,
  Tag,
  Ban,
  ShieldAlert,
  Sliders,
  ChevronDown,
  X,
  Camera,
  Edit3,
  Lock
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDBetItem, TwoDVoucher, OverLimitItemInfo, OverLimitAction, BetItem, TwoDNumberAggregate, TwoDQuickActionButtonsConfig } from '../../types';
import { DEFAULT_2D_ACTION_BUTTONS } from '../../utils/storage';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import {
  getTwoDReversal,
  getTwoDIncludesNumbers,
  parseTwoDBatchInput,
  is2DRoundClosed,
  TWO_D_DOUBLES,
  TWO_D_POWER,
  TWO_D_NATKHAT,
  TWO_D_BROTHERS,
  getTwoDBreakNumbers,
  getTwoDHeadNumbers,
  getTwoDTailNumbers,
  getTwoDEvenEven,
  getTwoDOddOdd,
  getTwoDKhway,
  getTwoDKhwayPuu,
  getTwoDKhwayRumble,
  getTwoDKhwayPuuRumble
} from '../../utils/twoDLotteryUtils';
import { OverLimitConfirmModal } from '../OverLimitConfirmModal';
import { ImageSlipScannerModal } from '../ImageSlipScannerModal';
import {
  playTapSound,
  playAddSound,
  playSuccessSound,
  playWarningSound,
  playDeleteSound
} from '../../utils/audioUtils';

interface TwoDQuickSaleEntryProps {
  onVoucherCreated: (voucher: TwoDVoucher) => void;
  onOpenForwardModal?: (num?: string, amt?: number) => void;
  onOpenLimitsManager?: (num?: string) => void;
  onOpenRoundManager?: () => void;
}

export const TwoDQuickSaleEntry: React.FC<TwoDQuickSaleEntryProps> = ({
  onVoucherCreated,
  onOpenForwardModal,
  onOpenLimitsManager,
  onOpenRoundManager
}) => {
  const {
    settings,
    activeRound,
    addVoucher,
    addForwardSlip,
    aggregates,
    limits,
    isNumberBlocked,
    getNumberLimit
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(settings.defaultCustomerDiscount || 0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (typeof settings.defaultCustomerDiscount === 'number') {
      setDiscountPercent(settings.defaultCustomerDiscount);
    }
  }, [settings.defaultCustomerDiscount]);

  // Single Bet Input
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [isRumble, setIsRumble] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitTimeRef = useRef(0);

  // Cart / Pending Bet Items
  const [items, setItems] = useState<TwoDBetItem[]>([]);
  // Tracking unconfirmed/active draft items (Yellow) vs confirmed staged items (Green)
  const [latestDraftIds, setLatestDraftIds] = useState<string[]>([]);

  // Batch text entry modal
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchDefaultAmount, setBatchDefaultAmount] = useState('1000');

  // Over-limit Decision Modal
  const [isOverLimitModalOpen, setIsOverLimitModalOpen] = useState(false);
  const [pendingOverLimitItems, setPendingOverLimitItems] = useState<OverLimitItemInfo[]>([]);

  // Pattern shortcut menu dropdown
  const [isPatternOpen, setIsPatternOpen] = useState(false);

  // Toast notification
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Photo Slip Scanner Modal state
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const handleAddFromScanner = (scannedItems: BetItem[], scannedCustomerName: string, scannedPhone: string) => {
    if (scannedCustomerName && !customerName) {
      setCustomerName(scannedCustomerName);
    }
    if (scannedPhone && !customerPhone) {
      setCustomerPhone(scannedPhone);
    }

    const newTwoDItems: TwoDBetItem[] = scannedItems.map((it, idx) => ({
      id: `twoD-scan-${Date.now()}-${idx}`,
      number: it.number.slice(0, 2),
      amount: it.amount,
      isRumble: it.isRumble,
      originalInput: it.originalInput || it.number
    }));

    setItems(prev => [...prev, ...newTwoDItems]);
    setLatestDraftIds(newTwoDItems.map(i => i.id));
    showToast(isMyanmar ? `ဓါတ်ပုံမှ ဂဏန်း ${newTwoDItems.length} လုံး အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ` : `Added ${newTwoDItems.length} items from photo`, 'success');
  };

  const numberInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    numberInputRef.current?.focus();
  }, []);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  // Check if current input number is blocked
  const isInputBlocked = numberInput.length === 2 && isNumberBlocked(numberInput);

  // Quick Action Buttons visibility & active status config
  const enabledButtons = useMemo<TwoDQuickActionButtonsConfig>(() => {
    return {
      ...DEFAULT_2D_ACTION_BUTTONS,
      ...(settings.quickActionButtons || {})
    };
  }, [settings.quickActionButtons]);

  const hasAnyButtonVisible = useMemo(() => {
    return Object.values(enabledButtons).some(Boolean);
  }, [enabledButtons]);

  // Real-time preview of numbers from numberInput
  const parsedPreviewNumbers = useMemo(() => {
    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!rawInput) return [];

    // Check if user typed any of the 4 Khway keywords directly (only if enabled)
    // 1. ခွေပူးအာ / ခွေပူးr
    if (enabledButtons.khwayPuuRumble && /ခွေပူး[rအာ]|ခွေ\s*ပူး\s*[rအာ]|ပါခွေ[rအာ]|ခွေ[rအာ]ပူး/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        return getTwoDKhwayPuuRumble(nums[0]);
      }
    }
    // 2. ခွေအာ / ခွေr
    if (enabledButtons.khwayRumble && /ခွေ[rအာ]|ခွေ\s*[rအာ]/i.test(rawInput) && !/ပူး/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        return getTwoDKhwayRumble(nums[0]);
      }
    }
    // 3. ခွေပူး
    if (enabledButtons.khwayPuu && /ခွေပူး|ခွေ\s*ပူး|ပါခွေ/i.test(rawInput) && !/[rအာ]/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        return getTwoDKhwayPuu(nums[0]);
      }
    }
    // 4. ခွေ (ရိုးရိုးခွေ)
    if (enabledButtons.khway && /ခွေ/i.test(rawInput) && !/ပူး|[rအာ]/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        return getTwoDKhway(nums[0]);
      }
    }

    const hasStraightKeyword = enabledButtons.straight && /ဒဲ့|တဲ့|တည့်/i.test(rawInput);
    const hasRInInput = enabledButtons.rumble && /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const hasR = !hasStraightKeyword && ((enabledButtons.rumble && isRumble) || hasRInInput);
    const cleanForNumbers = rawInput.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);

    // If last token is 3+ digits (like 500, 1000) and there are prior tokens, treat as amount
    if (rawTokens.length > 1) {
      const lastToken = rawTokens[rawTokens.length - 1];
      if (lastToken.length >= 3 && /^\d+$/.test(lastToken)) {
        rawTokens.pop();
      }
    }

    const valid2D = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));

    if (hasR) {
      const list: string[] = [];
      valid2D.forEach(n => {
        const revs = getTwoDReversal(n);
        revs.forEach(r => {
          if (!list.includes(r)) list.push(r);
        });
      });
      return list;
    }
    return valid2D;
  }, [numberInput, isRumble, enabledButtons]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const netPayable = subtotal - discountAmount;

  // Add items to Voucher / Cart - ONLY when "ထည့်မည်" is clicked
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Debounce protection against double-click or accidental multi-tap
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 400 || isSubmitting) {
      return;
    }
    lastSubmitTimeRef.current = now;
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 400);

    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!rawInput) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း ရိုက်ထည့်ပါ သို့မဟုတ် အမြန်ခုလုတ် နှိပ်ပါ' : 'Enter number or select shortcut', 'error');
      numberInputRef.current?.focus();
      return;
    }

    // Direct typed keyword support for the 4 Khway variations:
    const khwayAmtMatch = rawInput.match(/\s+(\d+)$/);
    const khwayInlineAmt = khwayAmtMatch ? parseFloat(khwayAmtMatch[1]) : undefined;

    // Helper to insert generated Khway items
    const insertKhwayItems = (generatedNumbers: string[], label: string, specifiedAmt?: number) => {
      if (generatedNumbers.length === 0) return false;
      const targetAmt = specifiedAmt || parseFloat(convertMyanmarToEnglishDigits(amountInput).trim());
      if (isNaN(targetAmt) || targetAmt <= 0) {
        playWarningSound();
        showToast(isMyanmar ? 'ထိုးကြေးငွေ ထည့်သွင်းပါ (ဥပမာ- ၅၀၀)' : 'Enter bet amount (e.g., 500)', 'warning');
        amountInputRef.current?.focus();
        return true;
      }

      const newItems: TwoDBetItem[] = [];
      const blockedFound: string[] = [];
      generatedNumbers.forEach((n) => {
        if (isNumberBlocked(n)) {
          blockedFound.push(n);
        } else {
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            number: n,
            amount: targetAmt,
            originalInput: label
          });
        }
      });
      if (blockedFound.length > 0) {
        playWarningSound();
        showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${blockedFound.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers`, 'warning');
      }
      if (newItems.length > 0) {
        playAddSound();
        setItems((prev) => [...prev, ...newItems]);
        setLatestDraftIds(newItems.map(i => i.id));
        setNumberInput('');
        setAmountInput('');
        setIsRumble(false);
        numberInputRef.current?.focus();
        showToast(
          isMyanmar ? `${label} (${newItems.length} ကွက်) စာရင်းသွင်းပြီးပါပြီ` : `Added ${label} (${newItems.length} bets)`,
          'success'
        );
      }
      return true;
    };

    // 1. ခွေပူးအာ / ခွေပူးr
    if (enabledButtons.khwayPuuRumble && /ခွေပူး[rအာ]|ခွေ\s*ပူး\s*[rအာ]|ပါခွေ[rအာ]|ခွေ[rအာ]ပူး/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        if (insertKhwayItems(getTwoDKhwayPuuRumble(nums[0]), `${nums[0]} ခွေပူးr`, khwayInlineAmt)) return;
      }
    }

    // 2. ခွေအာ / ခွေr
    if (enabledButtons.khwayRumble && /ခွေ[rအာ]|ခွေ\s*[rအာ]/i.test(rawInput) && !/ပူး/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        if (insertKhwayItems(getTwoDKhwayRumble(nums[0]), `${nums[0]} ခွေr`, khwayInlineAmt)) return;
      }
    }

    // 3. ခွေပူး
    if (enabledButtons.khwayPuu && /ခွေပူး|ခွေ\s*ပူး|ပါခွေ/i.test(rawInput) && !/[rအာ]/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        if (insertKhwayItems(getTwoDKhwayPuu(nums[0]), `${nums[0]} ခွေပူး`, khwayInlineAmt)) return;
      }
    }

    // 4. ခွေ (ရိုးရိုးခွေ)
    if (enabledButtons.khway && /ခွေ/i.test(rawInput) && !/ပူး|[rအာ]/i.test(rawInput)) {
      const nums = rawInput.match(/\d+/g);
      if (nums && nums.length >= 1) {
        if (insertKhwayItems(getTwoDKhway(nums[0]), `${nums[0]} ခွေ`, khwayInlineAmt)) return;
      }
    }

    const hasStraightKeyword = enabledButtons.straight && /ဒဲ့|တဲ့|တည့်/i.test(rawInput);
    const hasRInInput = enabledButtons.rumble && /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const effectiveRumble = hasStraightKeyword ? false : ((enabledButtons.rumble && isRumble) || hasRInInput);

    const cleanForNumbers = rawInput.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);

    if (rawTokens.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter valid 2-digit number (00-99)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    let amt = parseFloat(convertMyanmarToEnglishDigits(amountInput).trim());

    // Check if amount is specified inline (e.g. "22,33,22,44, 500" or "၁၃,၂၄,၃၆,၄၆,၂၇,၈၄, ၁၀၀၀")
    if (isNaN(amt) || amt <= 0) {
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        const parsedLast = parseFloat(lastToken);
        if (!isNaN(parsedLast) && parsedLast > 0) {
          amt = parsedLast;
          rawTokens.pop();
        }
      }
    } else {
      // Amount in amountInput, but if inline amount specified at end of string
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        if (lastToken.length >= 3 && /^\d+$/.test(lastToken)) {
          const parsedLast = parseFloat(lastToken);
          if (!isNaN(parsedLast) && parsedLast > 0) {
            amt = parsedLast;
            rawTokens.pop();
          }
        }
      }
    }

    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေ ထည့်သွင်းပါ (ဥပမာ- ၅၀၀)' : 'Enter bet amount (e.g., 500)', 'warning');
      amountInputRef.current?.focus();
      return;
    }

    const targetNumbers = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter valid 2-digit number (00-99)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const newItems: TwoDBetItem[] = [];
    const blockedFound: string[] = [];

    targetNumbers.forEach(cleanNum => {
      if (effectiveRumble) {
        const revs = getTwoDReversal(cleanNum);
        revs.forEach(r => {
          if (isNumberBlocked(r)) {
            blockedFound.push(r);
          } else {
            newItems.push({
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              number: r,
              amount: amt,
              isRumble: true,
              originalInput: `${cleanNum} R`
            });
          }
        });
      } else {
        if (isNumberBlocked(cleanNum)) {
          blockedFound.push(cleanNum);
        } else {
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            number: cleanNum,
            amount: amt,
            isRumble: false,
            originalInput: cleanNum
          });
        }
      }
    });

    if (blockedFound.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${Array.from(new Set(blockedFound)).join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers`, 'warning');
    }

    if (newItems.length > 0) {
      playAddSound();
      setItems(prev => [...prev, ...newItems]);
      setLatestDraftIds(newItems.map(i => i.id));
      // Reset inputs immediately: number cleared, amount cleared to 0/empty to prevent accidental repeats!
      setNumberInput('');
      setAmountInput('');
      setIsRumble(false);
      numberInputRef.current?.focus();
      showToast(
        isMyanmar
          ? `ဂဏန်းပေါင်း (${newItems.length}) ကွက် ဘောင်ချာထဲသို့ ထည့်သွင်းပြီးပါပြီ`
          : `Added ${newItems.length} items to voucher`,
        'success'
      );
    }
  };

  // 0. ဒဲ့ (Straight / Direct - တိုက်ရိုက် / ပတ်လည်မပါ)
  const handleAddStraightClick = () => {
    playTapSound();
    setIsRumble(false);

    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const cleanAmt = convertMyanmarToEnglishDigits(amountInput).trim();

    if (cleanNum) {
      let amt = parseFloat(cleanAmt);
      if (isNaN(amt) || amt <= 0) {
        const rawTokens = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ').replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
        if (rawTokens.length > 1) {
          const lastToken = rawTokens[rawTokens.length - 1];
          const parsedLast = parseFloat(lastToken);
          if (!isNaN(parsedLast) && parsedLast > 0) {
            amt = parsedLast;
          }
        }
      }

      if (!isNaN(amt) && amt > 0) {
        handleAddItem();
      } else {
        amountInputRef.current?.focus();
        showToast(
          isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်ထိုးကြေး) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး \'ထည့်မည်\' ကိုနှိပ်ပါ' : 'Direct (Straight) selected. Enter amount.',
          'warning'
        );
      }
    } else {
      numberInputRef.current?.focus();
      showToast(
        isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်ထိုးကြေး) ရွေးထားသည်။ ဂဏန်းရိုက်ထည့်ပါ' : 'Direct (Straight) mode active.',
        'warning'
      );
    }
  };

  // 1. Rumble/Reversal (အာ: e.g. 24 -> fills "24 42" in number box)
  const handleEditItem = (item: TwoDBetItem) => {
    playTapSound();
    setNumberInput(item.number);
    setAmountInput(String(item.amount));
    setIsRumble(item.isRumble || false);
    setItems(prev => prev.filter(i => i.id !== item.id));
    setLatestDraftIds(prev => prev.filter(id => id !== item.id));
    numberInputRef.current?.focus();
    showToast(isMyanmar ? `ဂဏန်း [${item.number}] အား ပြင်ဆင်ရန် အောက်ပါအကွက်တွင် ဖြည့်သွင်းထားပါသည်` : `Editing item [${item.number}]`, 'warning');
  };

  // Restart / Rollback from a specific Checkpoint item (Rule #8, #9, #10)
  const handleRestartFromCheckpoint = (index: number, item: TwoDBetItem) => {
    playTapSound();
    const preservedItems = items.slice(0, index);
    setItems(preservedItems);
    setLatestDraftIds([]);
    setNumberInput(item.number);
    setAmountInput(String(item.amount));
    setIsRumble(item.isRumble || false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${item.number}] မှ ပြန်လည်စတင်ရန် Input Box ထဲ ပြန်ထည့်ပေးထားပြီး ယခင် Checkpoint အထိ အပြည့်အဝ ထိန်းသိမ်းထားပါသည်`
        : `Restarted from checkpoint [${item.number}]`,
      'warning'
    );
  };

  const handleAddRumbleClick = () => {
    playTapSound();
    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (rawInput) {
      const cleanForNumbers = rawInput.replace(/r|R|အာ|ပတ်လည်|ပတ်/gi, ' ');
      const rawTokens = cleanForNumbers.replace(/[=:\-_/,*+]/g, ' ').split(/\s+/).filter(Boolean);
      const targetNumbers = rawTokens.map(t => t.padStart(2, '0')).filter(n => /^\d{2}$/.test(n));

      if (targetNumbers.length > 0) {
        const expanded: string[] = [];
        targetNumbers.forEach(n => {
          const revs = getTwoDReversal(n);
          revs.forEach(r => {
            if (!expanded.includes(r)) expanded.push(r);
          });
        });
        setNumberInput(expanded.join(' '));
        setIsRumble(false);
        amountInputRef.current?.focus();
        showToast(isMyanmar ? `အာ ${expanded.length} ကွက် ပြင်ဆင်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ` : `Applied rumble (${expanded.length} numbers). Enter amount and tap Add.`, 'success');
        return;
      }
    }
    const nextState = !isRumble;
    setIsRumble(nextState);
    showToast(isMyanmar ? (nextState ? 'အာ (R) ဖွင့်ထားပါသည်' : 'အာ (R) ပိတ်ထားပါသည်') : (nextState ? 'Rumble ON' : 'Rumble OFF'), nextState ? 'success' : 'warning');
  };

  // 2. Break numbers for digit (ဘရိတ်: fills 10 break numbers into number box)
  const handleAddBreakDigit = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ဘရိတ်အတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၅)' : 'Enter a single digit (0-9) for break (e.g., 5)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digits = cleanNum.match(/\d/g);
    const digitChar = digits ? digits[digits.length - 1] : '';
    if (!digitChar || !/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const breakNumbers = getTwoDBreakNumbers(parseInt(digitChar, 10));
    setNumberInput(breakNumbers.join(' '));
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${digitChar}] ဘရိတ် (၁၀ ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${digitChar}] break (10 numbers). Enter amount and tap Add.`,
      'success'
    );
  };

  // 3. Includes numbers (အပါ: fills 19 numbers containing digit into number box)
  const handleAddIncludesDigit = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ပါဝင်မည့် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၅)' : 'Enter a single digit (0-9) to include (e.g., 5)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digits = cleanNum.match(/\d/g);
    const digitChar = digits ? digits[digits.length - 1] : '';
    if (!digitChar || !/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const includeNumbers = getTwoDIncludesNumbers(digitChar);
    setNumberInput(includeNumbers.join(' '));
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${digitChar}] အပါ (၁၉ ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${digitChar}] includes (19 numbers). Enter amount and tap Add.`,
      'success'
    );
  };

  // 4. Head/Front numbers (ထိပ် / ရှေ့ပိတ်: fills 10 head numbers into number box)
  const handleAddHeadDigit = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိပ်စီးအတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁)' : 'Enter a single digit (0-9) for head/front (e.g., 1)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digits = cleanNum.match(/\d/g);
    const digitChar = digits ? digits[digits.length - 1] : '';
    if (!digitChar || !/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const headNumbers = getTwoDHeadNumbers(parseInt(digitChar, 10));
    setNumberInput(headNumbers.join(' '));
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${digitChar}] ထိပ်စီး (၁၀ ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${digitChar}] head (10 numbers). Enter amount and tap Add.`,
      'success'
    );
  };

  // 5. Tail/Back numbers (နောက်ပိတ်: fills 10 tail numbers into number box)
  const handleAddTailDigit = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'နောက်ပိတ်အတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၂)' : 'Enter a single digit (0-9) for tail/back (e.g., 2)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digits = cleanNum.match(/\d/g);
    const digitChar = digits ? digits[digits.length - 1] : '';
    if (!digitChar || !/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const tailNumbers = getTwoDTailNumbers(parseInt(digitChar, 10));
    setNumberInput(tailNumbers.join(' '));
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${digitChar}] နောက်ပိတ် (၁၀ ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${digitChar}] tail (10 numbers). Enter amount and tap Add.`,
      'success'
    );
  };

  // 6. ခွေ (ရိုးရိုးခွေ / အရှေ့မှအနောက်သို့သာတွဲ / အာမပါ / အပူးမပါ)
  // ဥပမာ- "၁၂၃၄" ခွေ -> 12 13 14 23 24 34 (၆ ကွက်)
  // ဥပမာ- "၂၃၄၅၆" ခွေ -> (၁၀ ကွက်)
  const handleAddKhwayClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const digitsOnly = cleanNum.replace(/\D/g, '');
    const uniqueDigits = Array.from(new Set(digitsOnly.split('')));

    if (uniqueDigits.length < 2) {
      playWarningSound();
      showToast(
        isMyanmar
          ? 'ခွေရန် အနည်းဆုံး မတူသော ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁၂၃၄ သို့ ၂၃၄၅၆)'
          : 'Enter at least 2 distinct digits (e.g., 1234)',
        'warning'
      );
      numberInputRef.current?.focus();
      return;
    }

    const khwayNumbers = getTwoDKhway(digitsOnly);
    setNumberInput(khwayNumbers.join(' '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${uniqueDigits.join('')}] ခွေ (${khwayNumbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ`
        : `Khway: [${uniqueDigits.join('')}] (${khwayNumbers.length} bets). Enter amount and tap Add.`,
      'success'
    );
  };

  // 7. ခွေပူး (ရိုးရိုးခွေ + အပူးပါ / အာမပါ)
  // ဥပမာ- "၁၂၃၄" ခွေပူး -> ခွေ ၆ ကွက် + အပူး ၄ ကွက် = စုစုပေါင်း ၁၀ ကွက်
  // ဥပမာ- "၂၃၄၅၆" ခွေပူး -> ခွေ ၁၀ ကွက် + အပူး ၅ ကွက် = စုစုပေါင်း ၁၅ ကွက်
  const handleAddKhwayPuuClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const digitsOnly = cleanNum.replace(/\D/g, '');
    const uniqueDigits = Array.from(new Set(digitsOnly.split('')));

    if (uniqueDigits.length < 2) {
      playWarningSound();
      showToast(
        isMyanmar
          ? 'ခွေပူးရန် အနည်းဆုံး မတူသော ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁၂၃၄ သို့ ၂၃၄၅၆)'
          : 'Enter at least 2 distinct digits for Khway Puu (e.g., 1234)',
        'warning'
      );
      numberInputRef.current?.focus();
      return;
    }

    const khwayPuuNumbers = getTwoDKhwayPuu(digitsOnly);
    setNumberInput(khwayPuuNumbers.join(' '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${uniqueDigits.join('')}] ခွေပူး (${khwayPuuNumbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ`
        : `Khway Puu: [${uniqueDigits.join('')}] (${khwayPuuNumbers.length} bets with doubles). Enter amount and tap Add.`,
      'success'
    );
  };

  // 8. ခွေr (ခွေပြီး အာပါ လှည့်တွဲခြင်း / အပူးမပါ)
  // ဥပမာ- "၁၂၃၄" ခွေr -> ၁၂ ကွက်
  const handleAddKhwayRumbleClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const digitsOnly = cleanNum.replace(/\D/g, '');
    const uniqueDigits = Array.from(new Set(digitsOnly.split('')));

    if (uniqueDigits.length < 2) {
      playWarningSound();
      showToast(
        isMyanmar
          ? 'ခွေr အတွက် အနည်းဆုံး မတူသော ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁၂၃၄)'
          : 'Enter at least 2 distinct digits for Khway R (e.g., 1234)',
        'warning'
      );
      numberInputRef.current?.focus();
      return;
    }

    const khwayRumbleNumbers = getTwoDKhwayRumble(digitsOnly);
    setNumberInput(khwayRumbleNumbers.join(' '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${uniqueDigits.join('')}] ခွေr (${khwayRumbleNumbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ`
        : `Khway R: [${uniqueDigits.join('')}] (${khwayRumbleNumbers.length} bets). Enter amount and tap Add.`,
      'success'
    );
  };

  // 9. ခွေပူးr (ခွေ + အပူး + အာ အကုန်လုံးပါ)
  // ဥပမာ- "၁၂၃၄" ခွေပူးr -> ခွေအာ ၁၂ ကွက် + အပူး ၄ ကွက် = စုစုပေါင်း ၁၆ ကွက်
  const handleAddKhwayPuuRumbleClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const digitsOnly = cleanNum.replace(/\D/g, '');
    const uniqueDigits = Array.from(new Set(digitsOnly.split('')));

    if (uniqueDigits.length < 2) {
      playWarningSound();
      showToast(
        isMyanmar
          ? 'ခွေပူးr အတွက် အနည်းဆုံး မတူသော ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁၂၃၄)'
          : 'Enter at least 2 distinct digits for Khway Puu R (e.g., 1234)',
        'warning'
      );
      numberInputRef.current?.focus();
      return;
    }

    const khwayPuuRumbleNumbers = getTwoDKhwayPuuRumble(digitsOnly);
    setNumberInput(khwayPuuRumbleNumbers.join(' '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${uniqueDigits.join('')}] ခွေပူးr (အကုန်ပါ ${khwayPuuRumbleNumbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ`
        : `Khway Puu R: [${uniqueDigits.join('')}] (${khwayPuuRumbleNumbers.length} bets all-inclusive). Enter amount and tap Add.`,
      'success'
    );
  };

  // 10-13. Preset Patterns (အပူး, ပါဝါ, နက္ခတ်, ညီကို: fills numbers into number box)
  const handleAddPattern = (numbers: string[], label: string) => {
    playTapSound();
    setNumberInput(numbers.join(' '));
    setIsPatternOpen(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `[${label}] (${numbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${label}] (${numbers.length} numbers). Enter amount and tap Add.`,
      'success'
    );
  };

  // Process Batch Text
  const handleProcessBatch = () => {
    if (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) {
      playWarningSound();
      showToast(isMyanmar ? 'ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် စာရင်း ထည့်သွင်း၍ မရတော့ပါ' : 'Round is closed', 'error');
      return;
    }

    if (!settings.defaultMultiplier || !settings.defaultCommissionRate) {
      playWarningSound();
      showToast(isMyanmar ? 'ပေါက်ကြေး သို့မဟုတ် ကော်မရှင် သတ်မှတ်ထားခြင်း မရှိသေးပါ (Settings တွင် ပြင်ဆင်ပါ)' : 'Missing settings multiplier/commission', 'error');
      return;
    }

    const defAmt = parseFloat(batchDefaultAmount) || 1000;
    const result = parseTwoDBatchInput(batchText, defAmt);
    const parsed = Array.isArray(result) ? result : (result as any).items;
    const warnings = (result as any).warnings || [];

    if (warnings && warnings.length > 0) {
      showToast(warnings.join(', '), 'warning');
    }

    if (parsed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ဖတ်ရှု၍ရသော 2D ဂဏန်းမရှိပါ' : 'No valid 2D bets found', 'error');
      return;
    }

    const blocked = parsed.filter(p => isNumberBlocked(p.number));
    const allowed = parsed.filter(p => !isNumberBlocked(p.number));

    if (blocked.length > 0) {
      playWarningSound();
      const list = Array.from(new Set(blocked.map(b => b.number))).join(', ');
      showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${list}] များကို အလိုအလျောက် ပယ်ဖျက်ထားပါသည်` : `Removed blocked numbers`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထည့်သွင်းထားသော ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်' : 'All entered numbers are blocked', 'error');
      return;
    }

    playAddSound();
    setItems(prev => [...prev, ...allowed]);
    setLatestDraftIds(allowed.map(i => i.id));
    setBatchText('');
    setIsBatchOpen(false);
    showToast(isMyanmar ? `အကွက်ပေါင်း (${allowed.length}) ကွက် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ` : `Added ${allowed.length} items`, 'success');
  };

  // Handle Checkout & Automatic Over-Limit Aggregation
  const handleSaveSale = () => {
    if (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) {
      playWarningSound();
      alert(isMyanmar
        ? 'လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ'
        : 'The current round is closed or settled. Please open a new round before saving.');
      showToast(isMyanmar
        ? 'လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ'
        : 'Round is closed or settled', 'error');
      return;
    }

    if (!settings.defaultMultiplier || !settings.defaultCommissionRate) {
      playWarningSound();
      showToast(isMyanmar ? 'ပေါက်ကြေး သို့မဟုတ် ကော်မရှင် သတ်မှတ်ထားခြင်း မရှိသေးပါ (Settings တွင် ပြင်ဆင်ပါ)' : 'Missing settings multiplier/commission', 'error');
      return;
    }

    if (items.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'အရောင်းစာရင်းတွင် ဂဏန်းများ ထည့်သွင်းပါ' : 'Cart is empty', 'error');
      return;
    }

    // Re-check if any numbers in cart are blocked
    const blockedInCart = items.filter(i => isNumberBlocked(i.number));
    if (blockedInCart.length > 0) {
      playWarningSound();
      const list = Array.from(new Set(blockedInCart.map(b => b.number))).join(', ');
      showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${list}] များ ပါဝင်နေပါသည် (ကျေးဇူးပြု၍ စာရင်းမှ ဖယ်ရှားပါ)` : `Contains blocked numbers: ${list}`, 'error');
      return;
    }

    // Check if any numbers in this voucher exceed limits (tracked for batch forwarding)
    const itemSums: { [num: string]: number } = {};
    items.forEach(i => {
      itemSums[i.number] = (itemSums[i.number] || 0) + i.amount;
    });

    let hasOverLimit = false;
    Object.keys(itemSums).forEach(num => {
      const addedAmt = itemSums[num];
      const currentSold = aggregates[num]?.totalSold || 0;
      const lmt = getNumberLimit(num);
      if (lmt > 0 && currentSold + addedAmt > lmt) {
        hasOverLimit = true;
      }
    });

    // Save voucher directly to ledger without interrupting the user
    createFinalVoucher(items);

    if (hasOverLimit) {
      showToast(
        isMyanmar
          ? 'ဘောင်ချာသိမ်းပြီးပါပြီ (ဘရိတ်ကျော်ဂဏန်းများကို \'ဒိုင်ကြီးဆီတင်မည်\' တွင် စုစည်းထားပါသည်)'
          : 'Voucher saved. Excess numbers recorded for Master Agent forward.',
        'warning'
      );
    }
  };

  // Create Voucher with decision resolutions
  const createFinalVoucher = (
    finalItems: TwoDBetItem[],
    forwardItems?: { number: string; amount: number }[],
    masterAgentName?: string,
    masterAgentPhone?: string,
    forwardCommission?: number
  ) => {
    if (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) {
      alert(isMyanmar
        ? 'လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ'
        : 'The current round is closed or settled. Please open a new round before saving.');
      showToast(isMyanmar
        ? 'လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ'
        : 'Round is closed', 'error');
      return;
    }

    if (finalItems.length === 0) {
      showToast(isMyanmar ? 'ထည့်သွင်းရန် ဂဏန်းမရှိပါ' : 'No items to save', 'warning');
      return;
    }

    const sub = finalItems.reduce((acc, i) => acc + i.amount, 0);
    const disc = Math.round((sub * discountPercent) / 100);
    const net = sub - disc;

    const voucher = addVoucher({
      roundId: activeRound.id,
      customerName: customerName.trim() || (isMyanmar ? 'အထွေထွေ' : 'Walk-in'),
      customerPhone: customerPhone.trim() || undefined,
      items: finalItems.map(i => ({
        number: i.number,
        amount: i.amount,
        betType: i.isRumble ? 'rumble' : 'straight'
      })),
      subtotal: sub,
      discountPercent,
      discountAmount: disc,
      netPayable: net,
      notes: notes.trim() || undefined,
      isPaid: true,
      status: 'active'
    });

    const isDup = (voucher as any)?.isDuplicate;

    // If there are forwarded items, create forward slip (only if not duplicate)
    if (!isDup && forwardItems && forwardItems.length > 0) {
      const fwdTotal = forwardItems.reduce((a, b) => a + b.amount, 0);
      const commRate = forwardCommission ?? settings.defaultCommissionRate;
      const commAmt = Math.round((fwdTotal * commRate) / 100);
      const netPaid = fwdTotal - commAmt;

      addForwardSlip({
        roundId: activeRound.id,
        masterAgentName: masterAgentName || settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
        masterAgentPhone: masterAgentPhone || settings.defaultMasterAgentPhone || '09-970001111',
        items: forwardItems,
        totalAmount: fwdTotal,
        commissionRate: commRate,
        commissionAmount: commAmt,
        netPaid,
        notes: `ဘောင်ချာ [${voucher.voucherNo}] မှ ဘရိတ်ကျော်ဂဏန်းများ လွှဲတင်ခြင်း`
      });

      playSuccessSound();
      showToast(isMyanmar ? `ဘောင်ချာနှင့် ဒိုင်ကြီးလွှဲစာရင်း (${formatAmount(fwdTotal, settings.currency)}) အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ` : 'Voucher & Forward Slip created', 'success');
    } else {
      playSuccessSound();
      showToast(isMyanmar ? `ဘောင်ချာ [${voucher.voucherNo}] ထုတ်ပြီးပါပြီ` : `Voucher created`, 'success');
    }

    // Reset Form
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setDiscountPercent(settings.defaultCustomerDiscount || 0);

    onVoucherCreated(voucher);
  };

  const handleConfirmOverLimit = (
    decisions: OverLimitItemInfo[],
    masterAgentName: string,
    masterAgentPhone: string,
    forwardCommission: number
  ) => {
    setIsOverLimitModalOpen(false);

    const keptItems: TwoDBetItem[] = [];
    const forwardList: { number: string; amount: number }[] = [];

    // Group items by number to apply decision per number across items
    const itemsByNumber: { [num: string]: TwoDBetItem[] } = {};
    items.forEach(item => {
      if (!itemsByNumber[item.number]) itemsByNumber[item.number] = [];
      itemsByNumber[item.number].push(item);
    });

    Object.keys(itemsByNumber).forEach(num => {
      const numberItems = itemsByNumber[num];
      const dec = decisions.find(d => d.number === num);

      if (!dec) {
        keptItems.push(...numberItems);
        return;
      }

      if (dec.action === 'reject') {
        return;
      } else if (dec.action === 'accept_locally') {
        keptItems.push(...numberItems);
      } else if (dec.action === 'forward_all') {
        numberItems.forEach(it => {
          forwardList.push({ number: it.number, amount: it.amount });
        });
      } else if (dec.action === 'cap_at_limit') {
        let remQuota = dec.remainingQuota;
        numberItems.forEach(it => {
          const retainAmt = Math.min(it.amount, remQuota);
          remQuota -= retainAmt;
          if (retainAmt > 0) {
            keptItems.push({ ...it, amount: retainAmt });
          }
        });
      } else if (dec.action === 'forward_excess') {
        let remQuota = dec.remainingQuota;
        numberItems.forEach(it => {
          const retainAmt = Math.min(it.amount, remQuota);
          const forwardAmt = it.amount - retainAmt;
          remQuota -= retainAmt;
          if (retainAmt > 0) {
            keptItems.push({ ...it, amount: retainAmt });
          }
          if (forwardAmt > 0) {
            forwardList.push({ number: it.number, amount: forwardAmt });
          }
        });
      }
    });

    createFinalVoucher(keptItems, forwardList, masterAgentName, masterAgentPhone, forwardCommission);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Toast Alert */}
      {toastNotification && (
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-3 shadow-md ${
            toastNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : toastNotification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastNotification.type === 'error' ? (
              <Ban className="w-5 h-5 text-rose-600 shrink-0" />
            ) : toastNotification.type === 'warning' ? (
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-bold">{toastNotification.message}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Closed / Settled Round Alert Banner */}
      {(!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-rose-950">
                {isMyanmar
                  ? `လက်ရှိပွဲစဉ် [${activeRound?.name || ''}] ပိတ်ထားပါသည် (${activeRound?.status === 'settled' ? `ပေါက်မဲ ${activeRound?.winningNumber || ''} အတည်ပြုပြီး` : 'ပိတ်ထားသည်'})`
                  : 'Current round is closed or settled'}
              </h4>
              <p className="text-[11px] sm:text-xs text-rose-800">
                {isMyanmar
                  ? 'ဂဏန်းနှင့် ထိုးကြေးများ စမ်းသပ်ရိုက်နှိပ်နိုင်သော်လည်း နောက်ပွဲစဉ်အသစ် မဖွင့်မချင်း အရောင်းစာရင်းနှင့် ဘောင်ချာများ လုံးဝမှတ်တမ်းမယူပါ/စာရင်းမသွင်းပါ။'
                  : 'You can test inputting numbers, but no sales or vouchers will be recorded until a new round is opened.'}
              </p>
            </div>
          </div>
          {onOpenRoundManager && (
            <button
              type="button"
              onClick={onOpenRoundManager}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shrink-0 transition-all shadow-xs cursor-pointer"
            >
              {isMyanmar ? 'ပွဲစဉ်အသစ် ဖွင့်ရန်' : 'Open Round'}
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Input Form & Cart (On Mobile/Tablet, Voucher Draft on Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Desktop Left / Mobile Bottom): Input Form (7 cols) */}
        <div className="order-2 lg:order-1 lg:col-span-7 space-y-5">
          {/* Quick Input Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>{isMyanmar ? 'အမြန်သွင်း' : 'Quick Entry'}</span>
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsScannerModalOpen(true)}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap active:scale-95"
                  title="ဓါတ်ပုံ / စလစ်ထဲမှ ဂဏန်းများကို အလိုအလျောက် ဖတ်ယူရန်"
                >
                  <Camera className="w-3 h-3 shrink-0" />
                  <span>{isMyanmar ? 'စကင်ဖတ်' : 'Scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(true)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap active:scale-95"
                  title="စာသားကူးထည့်ရန် (Batch Paste)"
                >
                  <Layers className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{isMyanmar ? 'စာသားကူး' : 'Batch'}</span>
                </button>
              </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleAddItem} className="space-y-3.5">
              {/* 1. Number Input (Full width on top) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMyanmar ? 'ဂဏန်း (၀၀-၉၉)' : 'Number (00-99)'}
                </label>
                <input
                  ref={numberInputRef}
                  type="text"
                  placeholder="24 သို့ 35 56 54"
                  value={numberInput}
                  onChange={(e) => {
                    const val = convertMyanmarToEnglishDigits(e.target.value);
                    setNumberInput(val);
                    if (latestDraftIds.length > 0 && val.trim().length > 0) {
                      setLatestDraftIds([]);
                    }
                  }}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  className={`w-full h-12 sm:h-13 px-4 text-center font-mono text-2xl sm:text-3xl font-black rounded-xl border transition-all ${
                    isInputBlocked
                      ? 'border-rose-400 bg-rose-50 text-rose-800'
                      : 'border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white'
                  }`}
                />
              </div>

              {/* Action Buttons below Number Input: ဒဲ့, ပတ်လည်, ရိတ်, အပါ, ထိပ်, ပိတ်, ပူး, ပါဝါ, နက္ခတ်, ညီကို, ခွေ, ခွေပူး, ခွေr, ခွေပူးr */}
              {hasAnyButtonVisible && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {/* 0. ဒဲ့ (Straight / Direct) */}
                  {enabledButtons.straight && (
                    <button
                      type="button"
                      onClick={handleAddStraightClick}
                      className={`px-2.5 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                        !isRumble
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                      }`}
                      title={isMyanmar ? 'ဒဲ့ / တိုက်ရိုက်ထိုးကြေး (Straight / Direct)' : 'Straight / Direct'}
                    >
                      <Check className="w-3 h-3" />
                      <span>{isMyanmar ? 'ဒဲ့' : 'Direct'}</span>
                    </button>
                  )}

                  {/* 1. အာ (Rumble / Reversal) */}
                  {enabledButtons.rumble && (
                    <button
                      type="button"
                      onClick={handleAddRumbleClick}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                        isRumble
                          ? 'bg-teal-600 text-white ring-1 ring-teal-500'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                      }`}
                      title={isMyanmar ? 'အာ (R)' : 'Rumble (R)'}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isMyanmar ? 'အာ' : 'R'}</span>
                    </button>
                  )}

                  {/* 2. ရိတ် (Break / ဘရိတ်) */}
                  {enabledButtons.break && (
                    <button
                      type="button"
                      onClick={handleAddBreakDigit}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ရိတ် (ဘရိတ် ၁၀ ကွက်)' : 'Break'}
                    >
                      <span>{isMyanmar ? 'ရိတ်' : 'Break'}</span>
                    </button>
                  )}

                  {/* 3. အပါ (Includes / အပါ) */}
                  {enabledButtons.includes && (
                    <button
                      type="button"
                      onClick={handleAddIncludesDigit}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'အပါ (၁၉ ကွက်)' : 'Includes'}
                    >
                      <span>{isMyanmar ? 'အပါ' : 'Includes'}</span>
                    </button>
                  )}

                  {/* 4. ထိပ် (Head / ထိပ်စီး) */}
                  {enabledButtons.head && (
                    <button
                      type="button"
                      onClick={handleAddHeadDigit}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ထိပ် (ထိပ်စီး ၁၀ ကွက်)' : 'Head'}
                    >
                      <span>{isMyanmar ? 'ထိပ်' : 'Head'}</span>
                    </button>
                  )}

                  {/* 5. ပိတ် (Tail / နောက်ပိတ်) */}
                  {enabledButtons.tail && (
                    <button
                      type="button"
                      onClick={handleAddTailDigit}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ပိတ် (နောက်ပိတ် ၁၀ ကွက်)' : 'Tail'}
                    >
                      <span>{isMyanmar ? 'ပိတ်' : 'Tail'}</span>
                    </button>
                  )}

                  {/* 6. ပူး (Doubles / အပူး) */}
                  {enabledButtons.doubles && (
                    <button
                      type="button"
                      onClick={() => handleAddPattern(TWO_D_DOUBLES, isMyanmar ? 'ပူး' : 'Doubles')}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ပူး (အပူး ၁၀ ကွက်)' : 'Doubles'}
                    >
                      <span>{isMyanmar ? 'ပူး' : 'Doubles'}</span>
                    </button>
                  )}

                  {/* 7. ပါဝါ (Power) */}
                  {enabledButtons.power && (
                    <button
                      type="button"
                      onClick={() => handleAddPattern(TWO_D_POWER, isMyanmar ? 'ပါဝါ' : 'Power')}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ပါဝါ (၁၀ ကွက်)' : 'Power'}
                    >
                      <span>{isMyanmar ? 'ပါဝါ' : 'Power'}</span>
                    </button>
                  )}

                  {/* 8. နက္ခတ် (Natkhat) */}
                  {enabledButtons.natkhat && (
                    <button
                      type="button"
                      onClick={() => handleAddPattern(TWO_D_NATKHAT, isMyanmar ? 'နက္ခတ်' : 'Natkhat')}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'နက္ခတ် (၁၀ ကွက်)' : 'Natkhat'}
                    >
                      <span>{isMyanmar ? 'နက္ခတ်' : 'Natkhat'}</span>
                    </button>
                  )}

                  {/* 9. ညီကို (Brothers) */}
                  {enabledButtons.brothers && (
                    <button
                      type="button"
                      onClick={() => handleAddPattern(TWO_D_BROTHERS, isMyanmar ? 'ညီကို' : 'Brothers')}
                      className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ညီကို (၂၀ ကွက်)' : 'Brothers'}
                    >
                      <span>{isMyanmar ? 'ညီကို' : 'Brothers'}</span>
                    </button>
                  )}

                  {/* 10. ခွေ (Khway - ရိုးရိုးခွေ) */}
                  {enabledButtons.khway && (
                    <button
                      type="button"
                      onClick={handleAddKhwayClick}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ခွေ (ရိုးရိုးခွေ - ဥပမာ ၁၂၃၄ -> ၆ ကွက်၊ ၂၃၄၅၆ -> ၁၀ ကွက်)' : 'Khway'}
                    >
                      <span>{isMyanmar ? 'ခွေ' : 'Khway'}</span>
                    </button>
                  )}

                  {/* 11. ခွေပူး (Khway Puu - ရိုးရိုးခွေ + အပူး) */}
                  {enabledButtons.khwayPuu && (
                    <button
                      type="button"
                      onClick={handleAddKhwayPuuClick}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ခွေပူး (ခွေ + အပူး - ဥပမာ ၁၂၃၄ -> ၁၀ ကွက်၊ ၂၃၄၅၆ -> ၁၅ ကွက်)' : 'Khway Puu'}
                    >
                      <span>{isMyanmar ? 'ခွေပူး' : 'Khway Puu'}</span>
                    </button>
                  )}

                  {/* 12. ခွေr (Khway Rumble - လှည့်တွဲ / အပြန်အလှန်) */}
                  {enabledButtons.khwayRumble && (
                    <button
                      type="button"
                      onClick={handleAddKhwayRumbleClick}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ခွေr (ခွေအာ လှည့်တွဲ - ဥပမာ ၁၂၃၄ -> ၁၂ ကွက်၊ ၂၃၄၅၆ -> ၂၀ ကွက်)' : 'Khway R'}
                    >
                      <span>{isMyanmar ? 'ခွေr' : 'Khway R'}</span>
                    </button>
                  )}

                  {/* 13. ခွေပူးr (Khway Puu Rumble - ခွေအာ + အပူးပါ အကုန်ပါ) */}
                  {enabledButtons.khwayPuuRumble && (
                    <button
                      type="button"
                      onClick={handleAddKhwayPuuRumbleClick}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                      title={isMyanmar ? 'ခွေပူးr (ခွေအာ + အပူး - ဥပမာ ၁၂၃၄ -> ၁၆ ကွက်၊ ၂၃၄၅၆ -> ၂၅ ကွက်)' : 'Khway Puu R'}
                    >
                      <span>{isMyanmar ? 'ခွေပူးr' : 'Khway Puu R'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Live Preview Info Bar if numbers are entered or selected */}
              {parsedPreviewNumbers.length > 0 && (
                <div className="flex items-center justify-between px-3.5 py-2 bg-teal-50/80 border border-teal-200/80 rounded-xl text-xs font-bold text-teal-900 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                    <span>{isMyanmar ? 'ရွေးချယ်ထားသော ဂဏန်း:' : 'Selected:'}</span>
                    <span className="font-mono font-black text-sm text-teal-800">
                      {parsedPreviewNumbers.length} {isMyanmar ? 'ကွက်' : 'bets'}
                    </span>
                  </div>
                  {parseFloat(amountInput) > 0 && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-teal-600">စုစုပေါင်း:</span>
                      <span className="font-black text-sm text-slate-900">
                        {(parsedPreviewNumbers.length * parseFloat(amountInput)).toLocaleString()} {settings.currency}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Compact Amount (Left) and Add Button (Right) side-by-side */}
              <div className="grid grid-cols-12 gap-2.5 items-center pt-1">
                {/* Amount Input */}
                <div className="col-span-7 sm:col-span-8">
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="ထိုးကြေးငွေ (ဥပမာ- ၅၀၀)"
                      value={amountInput}
                      onChange={(e) => {
                        const val = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '');
                        setAmountInput(val);
                        if (latestDraftIds.length > 0 && val.trim().length > 0) {
                          setLatestDraftIds([]);
                        }
                      }}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      className="w-full h-11 px-3 text-right font-mono text-base sm:text-lg font-bold rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all pr-9"
                    />
                    <span className="absolute right-2.5 top-3 text-[11px] font-bold text-slate-400 pointer-events-none">
                      {settings.currency}
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <div className="col-span-5 sm:col-span-4">
                  <button
                    type="submit"
                    disabled={isInputBlocked || isSubmitting}
                    className={`w-full h-11 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                      isInputBlocked || isSubmitting
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                        : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95 cursor-pointer shadow-teal-700/20'
                    }`}
                  >
                    {isInputBlocked ? (
                      <>
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>{isMyanmar ? 'ဒိုင်ကာ' : 'Blocked'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{isMyanmar ? 'ထည့်မည်' : 'Add'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4. Quick Amount Chips: ၂၅၀, ၅၀၀, 1k, 2k, 3k, 4k, 5k, 10K */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5">
                <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">
                  {isMyanmar ? 'အမြန်ငွေ:' : 'Quick:'}
                </span>
                {[
                  { label: '၂၅၀', value: 250 },
                  { label: '၅၀၀', value: 500 },
                  { label: '1K', value: 1000 },
                  { label: '2K', value: 2000 },
                  { label: '3K', value: 3000 },
                  { label: '4K', value: 4000 },
                  { label: '5K', value: 5000 },
                  { label: '10K', value: 10000 }
                ].map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setAmountInput(String(chip.value));
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:bg-teal-100 active:text-teal-900 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Blocked Number Warning */}
              {isInputBlocked && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-900 text-xs font-bold">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {isMyanmar
                      ? `ဂဏန်း [${numberInput}] အား ဒိုင်ကာဂဏန်းအဖြစ် သတ်မှတ်ထားသဖြင့် စာရင်းထဲသို့ ထည့်သွင်းခွင့် မပြုပါ`
                      : `Number [${numberInput}] is strictly blocked by dealer.`}
                  </span>
                </div>
              )}
            </form>
          </div>

          {/* Customer & Discount Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-teal-600" />
              <span>{isMyanmar ? 'ထိုးသူဖောက်သည် အချက်အလက်' : 'Customer Info'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder={isMyanmar ? 'ထိုးသူအမည် (ဥပမာ- ကိုညီညီ)' : 'Customer name'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9+]*"
                  placeholder={isMyanmar ? 'ဖုန်းနံပါတ် (မဖြစ်မနေ မဟုတ်ပါ)' : 'Phone number'}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="sm:col-span-3">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={30}
                    placeholder="0"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    className="w-full h-11 pl-3.5 pr-8 text-sm font-bold text-right rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-slate-500">% လျှော့</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Desktop Right / Mobile Top): Pending Cart & Voucher Preview (5 cols) */}
        <div className="order-1 lg:order-2 lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col h-full min-h-[500px]">
            {/* Batch Master Agent Forwarding Trigger */}
            {onOpenForwardModal && (() => {
              const excessAggs = (Object.values(aggregates) as TwoDNumberAggregate[]).filter(
                a => a.limit > 0 && Math.max(0, a.totalSold - (a.forwardedAmount || 0)) > a.limit
              );
              const totalExcessAmount = excessAggs.reduce(
                (sum, a) => sum + (Math.max(0, a.totalSold - (a.forwardedAmount || 0)) - a.limit),
                0
              );
              return (
                <div className="mb-2 sm:mb-3.5 bg-gradient-to-r from-amber-50 via-teal-50 to-slate-50 border border-amber-200/80 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-1.5 sm:gap-2 shadow-2xs">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-teal-950 block truncate">
                          {isMyanmar ? 'ဒိုင်ကြီးဆီတင်မည်' : 'Forward to Master'}
                        </span>
                        {excessAggs.length > 0 && (
                          <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                            {excessAggs.length} ကွက်
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-teal-800 font-semibold truncate block">
                        {excessAggs.length > 0
                          ? `သတ်မှတ်ဘရိတ်ကျော်: ${excessAggs.length} လုံး (${formatAmount(totalExcessAmount, settings.currency)})`
                          : 'ပိုနေသော 2D ဂဏန်းများကို စုစည်းလွှဲတင်ရန်'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenForwardModal()}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                  >
                    {isMyanmar ? 'ဒိုင်ကြီးဆီတင်မည်' : 'Forward'}
                  </button>
                </div>
              );
            })()}

            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>{isMyanmar ? 'အရောင်းစာရင်း (ဘောင်ချာ)' : 'Ticket Items'}</span>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-black rounded-full">
                    {items.length}
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (latestDraftIds.length === 0 && items.length > 0) {
                        playTapSound();
                        setLatestDraftIds(items.map(i => i.id));
                        showToast(isMyanmar ? 'ဂဏန်းအားလုံးကို စစ်ဆေးဆဲအဖြစ် သတ်မှတ်ထားပါသည်' : 'Marked all as draft', 'warning');
                      }
                    }}
                    className={`flex items-center gap-1 font-medium transition-colors ${
                      latestDraftIds.length > 0
                        ? 'text-amber-800 font-bold bg-amber-100/90 px-1.5 py-0.5 rounded-full border border-amber-300'
                        : 'text-amber-700'
                    }`}
                    title={isMyanmar ? 'စစ်ဆေးဆဲ (Draft)' : 'Draft items'}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 border border-amber-600 animate-pulse" />
                    <span>{isMyanmar ? 'စစ်ဆေးဆဲ' : 'Draft'}</span>
                    {latestDraftIds.length > 0 && (
                      <span className="font-mono text-[9px] bg-amber-200 px-1 rounded-full font-bold">
                        {latestDraftIds.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (latestDraftIds.length > 0) {
                        playTapSound();
                        setLatestDraftIds([]);
                        showToast(isMyanmar ? 'စစ်ဆေးဆဲ ဂဏန်းများကို ယာယီအတည်ပြုပြီးပါပြီ' : 'Draft items confirmed', 'success');
                      }
                    }}
                    className={`flex items-center gap-1 font-medium transition-colors ${
                      latestDraftIds.length > 0
                        ? 'text-emerald-800 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full border border-emerald-300 cursor-pointer shadow-2xs active:scale-95'
                        : 'text-emerald-700'
                    }`}
                    title={isMyanmar ? 'စစ်ဆေးဆဲ ဂဏန်းများအားလုံးကို ယာယီအတည်ပြုမည်' : 'Confirm all drafts'}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-700" />
                    <span>{isMyanmar ? 'ယာယီအတည်' : 'Confirmed'}</span>
                  </button>
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playDeleteSound();
                      setItems([]);
                      setLatestDraftIds([]);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isMyanmar ? 'အားလုံးဖျက်' : 'Clear'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] my-3 space-y-1.5 p-1">
              {items.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Layers className="w-10 h-10 stroke-1" />
                  <span className="text-sm font-medium">
                    {isMyanmar ? 'ဂဏန်းနှင့် ထိုးကြေး ထည့်သွင်းပါ' : 'No bet items added yet'}
                  </span>
                </div>
              ) : (
                items.map((item, idx) => {
                  const isDraft = latestDraftIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`py-2 px-2.5 flex items-center justify-between rounded-xl transition-all group ${
                        isDraft
                          ? 'bg-amber-50/95 border-2 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/30'
                          : 'bg-emerald-50/80 border border-emerald-300 text-emerald-950 shadow-2xs hover:bg-emerald-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono w-5 font-bold ${isDraft ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {idx + 1}.
                        </span>
                        <span className="font-mono text-xl font-black text-slate-900">
                          {item.number}
                        </span>
                        {item.isRumble && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-900 text-[10px] font-bold rounded">
                            R
                          </span>
                        )}
                        {item.originalInput && item.originalInput !== item.number && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
                            {item.originalInput}
                          </span>
                        )}
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => {
                              playTapSound();
                              setLatestDraftIds(prev => prev.filter(id => id !== item.id));
                            }}
                            title={isMyanmar ? 'ဤဂဏန်းကို ယာယီအတည်ပြုရန် နှိပ်ပါ' : 'Click to confirm this bet'}
                            className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                            <span>{isMyanmar ? 'စစ်ဆေးဆဲ' : 'Draft'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              playTapSound();
                              setLatestDraftIds(prev => [...prev, item.id]);
                            }}
                            title={isMyanmar ? 'စစ်ဆေးဆဲအဖြစ် ပြန်ထားရန် နှိပ်ပါ' : 'Click to mark as draft'}
                            className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{isMyanmar ? 'ယာယီအတည်' : 'OK'}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-bold text-emerald-700 mr-1">
                          {formatAmount(item.amount, settings.currency)}
                        </span>
                        {/* Checkpoint Restart (Rule #8, #9, #10) */}
                        <button
                          type="button"
                          onClick={() => handleRestartFromCheckpoint(idx, item)}
                          className="px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-0.5"
                          title={isMyanmar ? 'ဤဂဏန်းမှ စ၍ ပြန်လည်စတင်မည် (နောက်ပိုင်းအကွက်များ ဖယ်ရှားပြီး input ထဲ ပြန်ထည့်မည်)' : 'Restart checkpoint from here'}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">{isMyanmar ? 'ပြန်စ' : 'Revert'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className={`p-1 cursor-pointer transition-colors rounded-lg ${
                            isDraft
                              ? 'text-amber-900 hover:text-teal-700 hover:bg-amber-200/70'
                              : 'text-slate-500 hover:text-teal-700 hover:bg-slate-200/60'
                          }`}
                          title={isMyanmar ? 'ပြင်ဆင်မည်' : 'Edit item'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playDeleteSound();
                            setItems(prev => prev.filter(i => i.id !== item.id));
                            setLatestDraftIds(prev => prev.filter(id => id !== item.id));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors rounded-lg hover:bg-rose-50"
                          title={isMyanmar ? 'ဖျက်မည်' : 'Delete item'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Financial Summary */}
            <div className="border-t border-slate-200 pt-4 space-y-2.5 bg-slate-50/50 p-4 rounded-xl">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{isMyanmar ? 'စုစုပေါင်း ထိုးကြေး' : 'Subtotal'}:</span>
                <span className="font-bold text-slate-900">{formatAmount(subtotal, settings.currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-bold">
                  <span>{isMyanmar ? `ဖောက်သည်လျှော့ငွေ (${discountPercent}%)` : 'Discount'}:</span>
                  <span>- {formatAmount(discountAmount, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>{isMyanmar ? 'ကျသင့်ငွေ (Net Payable)' : 'Net Payable'}:</span>
                <span className="text-teal-600 text-lg font-mono">
                  {formatAmount(netPayable, settings.currency)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-2.5">
              <button
                type="button"
                onClick={handleSaveSale}
                disabled={items.length === 0}
                className={`w-full h-13 font-black text-base rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                  items.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound))
                    ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                    : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95'
                }`}
              >
                {(!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
                <span>
                  {(!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound))
                    ? (isMyanmar ? 'ပွဲစဉ်ပိတ်ထားသည် (စာရင်းမသွင်းပါ)' : 'Round Closed (Cannot Save)')
                    : (isMyanmar ? 'ဘောင်ချာထုတ် / အရောင်းသိမ်းမည်' : 'Save & Print Voucher')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Paste Modal */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600" />
                <span>{isMyanmar ? 'ဇီးကွက် စာသားကူးထည့်ခြင်း (Batch Paste)' : 'Batch Paste'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-bold">
                  {isMyanmar ? 'ပုံမှန်ထိုးကြေး (မပါရှိပါက သတ်မှတ်မည့်ငွေ)' : 'Default amount'}:
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={batchDefaultAmount}
                  onChange={(e) => setBatchDefaultAmount(e.target.value.replace(/\D/g, ''))}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  className="w-24 h-8 px-2 text-right text-xs font-bold rounded-lg border border-slate-300"
                />
              </div>

              <textarea
                rows={6}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`ဥပမာ-\n1234 ခွေ 500\n1234 ခွေပူး 500\n1234 ခွေအာ 500\n1234 ခွေပူးအာ 500\n24 1000\n24R 500\nအပူး 1000\n5 ဘရိတ် 2000`}
                className="w-full p-3 font-mono text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              ></textarea>
              <p className="text-[11px] text-slate-500">
                {isMyanmar
                  ? 'Format: ဂဏန်းနှင့် ငွေပမာဏကို ခြား၍ ရိုက်ထည့်နိုင်ပါသည် (ဥပမာ- 1234 ခွေ 500, 1234 ခွေပူး 500, 1234 ခွေအာ 500, 1234 ခွေပူးအာ 500, 24R 1000, အပူး 1000)'
                  : 'Enter numbers with amounts separated by spaces or newlines (e.g., 1234 Khway 500).'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isMyanmar ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleProcessBatch}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {isMyanmar ? 'စာရင်းသွင်းမည်' : 'Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Over-Limit / Dealer Forwarding Modal */}
      <OverLimitConfirmModal
        isOpen={isOverLimitModalOpen}
        onClose={() => {
          setIsOverLimitModalOpen(false);
          setPendingOverLimitItems([]);
        }}
        overLimitItems={pendingOverLimitItems}
        customerName={customerName}
        onConfirm={handleConfirmOverLimit}
      />

      {/* Image Slip Scanner Modal */}
      <ImageSlipScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onAddBetsToCart={handleAddFromScanner}
        mode="2d"
      />
    </div>
  );
};
