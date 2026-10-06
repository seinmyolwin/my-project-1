import React, { useState, useRef, useEffect } from 'react';
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
  Smartphone,
  Tag,
  Ban,
  ShieldAlert,
  Sliders,
  ChevronDown,
  X,
  Camera
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDBetItem, TwoDVoucher, OverLimitItemInfo, OverLimitAction, BetItem } from '../../types';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import {
  getTwoDReversal,
  getTwoDIncludesNumbers,
  parseTwoDBatchInput,
  TWO_D_DOUBLES,
  TWO_D_POWER,
  TWO_D_NATKHAT,
  TWO_D_BROTHERS,
  getTwoDBreakNumbers,
  getTwoDHeadNumbers,
  getTwoDTailNumbers,
  getTwoDEvenEven,
  getTwoDOddOdd
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
}

export const TwoDQuickSaleEntry: React.FC<TwoDQuickSaleEntryProps> = ({
  onVoucherCreated,
  onOpenForwardModal,
  onOpenLimitsManager
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

  // Single Bet Input
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('1000');
  const [isRumble, setIsRumble] = useState(false);

  // Cart / Pending Bet Items
  const [items, setItems] = useState<TwoDBetItem[]>([]);

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
    showToast(isMyanmar ? `ဓါတ်ပုံမှ ဂဏန်း ${newTwoDItems.length} လုံး အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ` : `Added ${newTwoDItems.length} items from photo`, 'success');
  };

  const numberInputRef = useRef<HTMLInputElement>(null);

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

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const netPayable = subtotal - discountAmount;

  // Add items from single form (supports single number "24" or multiple numbers "35 56 54" with R)
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!rawInput) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit number (00-99)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    const hasRInInput = /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const effectiveRumble = isRumble || hasRInInput;

    const cleanForNumbers = rawInput.replace(/r|R|အာ|ပတ်လည်|ပတ်/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[=:\-_/,*+]/g, ' ').split(/\s+/).filter(Boolean);
    const targetNumbers = rawTokens.map(t => t.padStart(2, '0')).filter(n => /^\d{2}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit number (00-99)', 'error');
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
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
      setNumberInput('');
      setIsRumble(false);
      numberInputRef.current?.focus();
      showToast(
        isMyanmar
          ? `ဂဏန်းပေါင်း (${newItems.length}) ကွက် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ`
          : `Added ${newItems.length} items`,
        'success'
      );
    }
  };

  // Add Rumble/Reversal (အာ: e.g. 24 -> 24, 42)
  const handleAddRumbleClick = () => {
    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (rawInput) {
      const amt = parseFloat(amountInput);
      if (isNaN(amt) || amt <= 0) {
        playWarningSound();
        showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
        return;
      }
      const rawTokens = rawInput.replace(/r|R|အာ|ပတ်လည်|ပတ်/gi, ' ').replace(/[=:\-_/,*+]/g, ' ').split(/\s+/).filter(Boolean);
      const targetNumbers = rawTokens.map(t => t.padStart(2, '0')).filter(n => /^\d{2}$/.test(n));
      if (targetNumbers.length === 0) {
        playWarningSound();
        showToast(isMyanmar ? 'အာထိုးရန် ဂဏန်း (၀၀ မှ ၉၉) ထည့်ပါ' : 'Enter valid 2-digit numbers to rumble', 'error');
        numberInputRef.current?.focus();
        return;
      }
      const newItems: TwoDBetItem[] = [];
      const blockedFound: string[] = [];
      targetNumbers.forEach(cleanNum => {
        const revs = getTwoDReversal(cleanNum);
        revs.forEach(r => {
          if (isNumberBlocked(r)) {
            blockedFound.push(r);
          } else {
            newItems.push({
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              number: r,
              amount: amt,
              isRumble: true,
              originalInput: `${cleanNum} R`
            });
          }
        });
      });
      if (blockedFound.length > 0) {
        playWarningSound();
        showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${Array.from(new Set(blockedFound)).join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers`, 'warning');
      }
      if (newItems.length > 0) {
        playAddSound();
        setItems(prev => [...prev, ...newItems]);
        setNumberInput('');
        setIsRumble(false);
        numberInputRef.current?.focus();
        showToast(isMyanmar ? `အာ/ပတ်လည် (${newItems.length} ကွက်) အောင်မြင်စွာ ထည့်ပြီးပါပြီ` : `Added ${newItems.length} rumble items`, 'success');
      }
    } else {
      playTapSound();
      const nextState = !isRumble;
      setIsRumble(nextState);
      showToast(isMyanmar ? (nextState ? 'အာ (R) ဖွင့်ထားပါသည်' : 'အာ (R) ပိတ်ထားပါသည်') : (nextState ? 'Rumble ON' : 'Rumble OFF'), nextState ? 'success' : 'warning');
    }
  };

  // Add Break numbers for digit (ဘရိတ်: e.g. 5 -> 05, 14, 23, 32, 41, 50, 69, 78, 87, 96)
  const handleAddBreakDigit = () => {
    const cleanNum = numberInput.trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ဘရိတ်အတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၅)' : 'Enter a single digit (0-9) for break (e.g., 5)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digitChar = cleanNum[cleanNum.length - 1];
    if (!/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    const breakNumbers = getTwoDBreakNumbers(parseInt(digitChar, 10));
    const allowed = breakNumbers.filter(n => !isNumberBlocked(n));
    const blocked = breakNumbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] ဘရိတ် ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from break list`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] ဘရိတ် ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်` : `All numbers for this break are blocked`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `brk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: `${digitChar} ဘရိတ်`
    }));

    playAddSound();
    setItems(prev => [...prev, ...newItems]);
    setNumberInput('');
    setIsRumble(false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${digitChar}] ဘရိတ် (${newItems.length} ကွက်) အား တစ်ကွက်လျှင် ${formatAmount(amt, settings.currency)} ဖြင့် စာရင်းထဲသို့ ထည့်သွင်းပြီးပါပြီ`
        : `Added ${newItems.length} break numbers for [${digitChar}] at ${formatAmount(amt, settings.currency)} each`,
      'success'
    );
  };

  // Add all 2D numbers containing the specified single digit (e.g. 5 ပါ -> 19 numbers: 05, 15, 25, 35, 45, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 65, 75, 85, 95)
  const handleAddIncludesDigit = () => {
    const cleanNum = numberInput.trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ပါဝင်မည့် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၅)' : 'Enter a single digit (0-9) to include (e.g., 5)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    // Take the digit entered
    const digitChar = cleanNum[cleanNum.length - 1];
    if (!/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    const includeNumbers = getTwoDIncludesNumbers(digitChar);
    const allowed = includeNumbers.filter(n => !isNumberBlocked(n));
    const blocked = includeNumbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] အပါ ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from includes list`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] အပါ ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်` : `All numbers for this digit are blocked`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: `${digitChar} ပါ`
    }));

    playAddSound();
    setItems(prev => [...prev, ...newItems]);
    setNumberInput('');
    setIsRumble(false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${digitChar}] အပါ (${newItems.length} ကွက်) အား တစ်ကွက်လျှင် ${formatAmount(amt, settings.currency)} ဖြင့် စာရင်းထဲသို့ ထည့်သွင်းပြီးပါပြီ`
        : `Added ${newItems.length} numbers containing [${digitChar}] at ${formatAmount(amt, settings.currency)} each`,
      'success'
    );
  };

  // Add Head/Front numbers for digit (ရှေ့ပိတ် / ထိပ်စီး: e.g. 1 -> 10, 11, 12, 13, 14, 15, 16, 17, 18, 19)
  const handleAddHeadDigit = () => {
    const cleanNum = numberInput.trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'ရှေ့ပိတ်အတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁)' : 'Enter a single digit (0-9) for head/front (e.g., 1)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digitChar = cleanNum[cleanNum.length - 1];
    if (!/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    const headNumbers = getTwoDHeadNumbers(parseInt(digitChar, 10));
    const allowed = headNumbers.filter(n => !isNumberBlocked(n));
    const blocked = headNumbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] ရှေ့ပိတ် ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from head list`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] ရှေ့ပိတ် ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်` : `All head numbers for this digit are blocked`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `head-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: `${digitChar} ရှေ့ပိတ်`
    }));

    playAddSound();
    setItems(prev => [...prev, ...newItems]);
    setNumberInput('');
    setIsRumble(false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${digitChar}] ရှေ့ပိတ် (${newItems.length} ကွက်) အား တစ်ကွက်လျှင် ${formatAmount(amt, settings.currency)} ဖြင့် စာရင်းထဲသို့ ထည့်သွင်းပြီးပါပြီ`
        : `Added ${newItems.length} head numbers for [${digitChar}] at ${formatAmount(amt, settings.currency)} each`,
      'success'
    );
  };

  // Add Tail/Back numbers for digit (နောက်ပိတ်: e.g. 2 -> 02, 12, 22, 32, 42, 52, 62, 72, 82, 92)
  const handleAddTailDigit = () => {
    const cleanNum = numberInput.trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'နောက်ပိတ်အတွက် ဂဏန်း (၀ မှ ၉) တစ်လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၂)' : 'Enter a single digit (0-9) for tail/back (e.g., 2)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const digitChar = cleanNum[cleanNum.length - 1];
    if (!/^\d$/.test(digitChar)) {
      playWarningSound();
      showToast(isMyanmar ? 'ဂဏန်း (၀ မှ ၉) တစ်လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid digit (0-9)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    const tailNumbers = getTwoDTailNumbers(parseInt(digitChar, 10));
    const allowed = tailNumbers.filter(n => !isNumberBlocked(n));
    const blocked = tailNumbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] နောက်ပိတ် ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from tail list`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? `[${digitChar}] နောက်ပိတ် ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်` : `All tail numbers for this digit are blocked`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `tail-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: `${digitChar} နောက်ပိတ်`
    }));

    playAddSound();
    setItems(prev => [...prev, ...newItems]);
    setNumberInput('');
    setIsRumble(false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${digitChar}] နောက်ပိတ် (${newItems.length} ကွက်) အား တစ်ကွက်လျှင် ${formatAmount(amt, settings.currency)} ဖြင့် စာရင်းထဲသို့ ထည့်သွင်းပြီးပါပြီ`
        : `Added ${newItems.length} tail numbers for [${digitChar}] at ${formatAmount(amt, settings.currency)} each`,
      'success'
    );
  };

  // Add preset pattern
  const handleAddPattern = (numbers: string[], label: string) => {
    const amt = parseFloat(amountInput) || 1000;
    const allowed = numbers.filter(n => !isNumberBlocked(n));
    const blocked = numbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      showToast(isMyanmar ? `${label} ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from pattern`, 'warning');
    }

    if (allowed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? `${label} ဂဏန်းများအားလုံး ဒိုင်ကာဖြစ်နေပါသည်` : `All numbers for ${label} are blocked`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `pat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: label
    }));

    playAddSound();
    setItems(prev => [...prev, ...newItems]);
    setIsPatternOpen(false);
    showToast(isMyanmar ? `${label} (${newItems.length} ကွက်) ထည့်ပြီးပါပြီ` : `Added ${label} (${newItems.length} items)`, 'success');
  };

  // Process Batch Text
  const handleProcessBatch = () => {
    const defAmt = parseFloat(batchDefaultAmount) || 1000;
    const parsed = parseTwoDBatchInput(batchText, defAmt);

    if (parsed.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'ဖတ်ရှု၍ရသော ဂဏန်းမရှိပါ' : 'No valid 2D bets found', 'error');
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
    setBatchText('');
    setIsBatchOpen(false);
    showToast(isMyanmar ? `အကွက်ပေါင်း (${allowed.length}) ကွက် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ` : `Added ${allowed.length} items`, 'success');
  };

  // Handle Checkout & Over-Limit Check
  const handleSaveSale = () => {
    if (items.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'အရောင်းစာရင်းတွင် ဂဏန်းများ ထည့်သွင်းပါ' : 'Cart is empty', 'error');
      return;
    }

    // Check for numbers exceeding limit
    const overLimitList: OverLimitItemInfo[] = [];

    // Group items by number
    const itemSums: { [num: string]: number } = {};
    items.forEach(i => {
      itemSums[i.number] = (itemSums[i.number] || 0) + i.amount;
    });

    Object.keys(itemSums).forEach(num => {
      const addedAmt = itemSums[num];
      const currentSold = aggregates[num]?.totalSold || 0;
      const lmt = getNumberLimit(num);
      const remainingQuota = Math.max(0, lmt - currentSold);

      if (currentSold + addedAmt > lmt) {
        const excess = (currentSold + addedAmt) - lmt;
        overLimitList.push({
          id: `ovl-${num}`,
          number: num,
          originalAmount: addedAmt,
          existingSold: currentSold,
          limit: lmt,
          remainingQuota,
          excessAmount: excess,
          action: 'forward_excess'
        });
      }
    });

    if (overLimitList.length > 0) {
      setPendingOverLimitItems(overLimitList);
      setIsOverLimitModalOpen(true);
      return;
    }

    // Proceed to create voucher directly
    createFinalVoucher(items);
  };

  // Create Voucher with decision resolutions
  const createFinalVoucher = (
    finalItems: TwoDBetItem[],
    forwardItems?: { number: string; amount: number }[],
    masterAgentName?: string,
    masterAgentPhone?: string,
    forwardCommission?: number
  ) => {
    if (finalItems.length === 0) {
      showToast(isMyanmar ? 'ထည့်သွင်းရန် ဂဏန်းမရှိပါ' : 'No items to save', 'warning');
      return;
    }

    const sub = finalItems.reduce((acc, i) => acc + i.amount, 0);
    const disc = Math.round((sub * discountPercent) / 100);
    const net = sub - disc;

    const voucher = addVoucher({
      roundId: activeRound?.id || 'default',
      customerName: customerName.trim() || (isMyanmar ? 'အထွေထွေ' : 'Walk-in'),
      customerPhone: customerPhone.trim() || undefined,
      items: finalItems.map(i => ({
        number: i.number,
        amount: i.amount,
        betType: 'straight'
      })),
      subtotal: sub,
      discountPercent,
      discountAmount: disc,
      netPayable: net,
      notes: notes.trim() || undefined,
      isPaid: true,
      status: 'active'
    });

    // If there are forwarded items, create forward slip
    if (forwardItems && forwardItems.length > 0) {
      const fwdTotal = forwardItems.reduce((a, b) => a + b.amount, 0);
      const commRate = forwardCommission ?? 14;
      const commAmt = Math.round((fwdTotal * commRate) / 100);
      const netPaid = fwdTotal - commAmt;

      addForwardSlip({
        roundId: activeRound?.id || 'default',
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

    items.forEach(item => {
      const dec = decisions.find(d => d.number === item.number);
      if (!dec) {
        keptItems.push(item);
        return;
      }

      if (dec.action === 'reject') {
        // Drop item
        return;
      } else if (dec.action === 'accept_locally') {
        keptItems.push(item);
      } else if (dec.action === 'cap_at_limit') {
        if (dec.remainingQuota > 0) {
          keptItems.push({
            ...item,
            amount: Math.min(item.amount, dec.remainingQuota)
          });
        }
      } else if (dec.action === 'forward_all') {
        forwardList.push({ number: item.number, amount: item.amount });
      } else if (dec.action === 'forward_excess') {
        const excess = dec.excessAmount;
        const retainAmt = Math.max(0, item.amount - excess);
        if (retainAmt > 0) {
          keptItems.push({ ...item, amount: retainAmt });
        }
        if (excess > 0) {
          forwardList.push({ number: item.number, amount: excess });
        }
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

      {/* Main Grid: Input Form & Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Round Status Header */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  {isMyanmar ? 'လက်ရှိ ဇီးကွက်ပွဲစဉ်' : 'Active Round'}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {activeRound?.name || '02-Sep-2026 (ညနေ 04:30 PM)'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-200">
                {isMyanmar ? 'အလျော်ဆ' : 'Payout'}: {activeRound?.multiplier || settings.defaultMultiplier || 85}x
              </span>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                {activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'}
              </span>
            </div>
          </div>

          {/* Quick Input Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>{isMyanmar ? 'ဇီးကွက် အမြန်စာရင်းသွင်းရန်' : 'Quick Bet Entry'}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="ဓါတ်ပုံ / စလစ်ထဲမှ ဂဏန်းများကို အလိုအလျောက် ဖတ်ယူရန်"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'စကင်ဖတ်မည်' : 'Scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'စာသား ကူးထည့် (Batch)' : 'Batch Paste'}</span>
                </button>
              </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Number Input */}
                <div className="sm:col-span-4">
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
                    className={`w-full h-13 px-4 text-center font-mono text-xl sm:text-2xl font-black rounded-xl border transition-all ${
                      isInputBlocked
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Amount Input */}
                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isMyanmar ? 'ထိုးကြေး (ကျပ်)' : 'Amount'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1000"
                    value={amountInput}
                    onChange={(e) => setAmountInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
                    className="w-full h-13 px-4 text-right font-mono text-xl font-bold rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>

                {/* Add / Submit Button */}
                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={isInputBlocked}
                    className={`w-full h-13 font-black text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                      isInputBlocked
                        ? 'bg-rose-100 text-rose-700 cursor-not-allowed border border-rose-300'
                        : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isInputBlocked ? (
                      <>
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>{isMyanmar ? 'ဒိုင်ကာ' : 'Blocked'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span>{isMyanmar ? 'ထည့်မည်' : 'Add'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Compact 9 Action Buttons & Quick Amounts (Optimized for Mobile) */}
              <div className="pt-2 space-y-2.5">
                {/* 9 Action Buttons: အာ, ဘရိတ်, အပါ, ရှေ့ပိတ်, နောက်ပိတ်, အပူး, ပါဝါ, နက္ခတ်, ညီကို */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* 1. အာ (Rumble / Reversal) */}
                  <button
                    type="button"
                    onClick={handleAddRumbleClick}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isRumble
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                    title={isMyanmar ? 'အာ / ပတ်လည် (R)' : 'Rumble (R)'}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{isMyanmar ? 'အာ' : 'R'}</span>
                  </button>

                  {/* 2. ဘရိတ် (Break) */}
                  <button
                    type="button"
                    onClick={handleAddBreakDigit}
                    className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'ရိုက်ထည့်ထားသော ဂဏန်း၏ ဘရိတ် (၁၀ ကွက်) ထည့်မည်' : 'Break'}
                  >
                    <span>{isMyanmar ? 'ဘရိတ်' : 'Break'}</span>
                  </button>

                  {/* 3. အပါ (Includes) */}
                  <button
                    type="button"
                    onClick={handleAddIncludesDigit}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'ရိုက်ထည့်ထားသော ဂဏန်းပါဝင်သည့် အကွက် ၁၉ ကွက်လုံး ထည့်မည်' : 'Includes'}
                  >
                    <span>{isMyanmar ? 'အပါ' : 'Includes'}</span>
                  </button>

                  {/* 4. ရှေ့ပိတ် (Head) */}
                  <button
                    type="button"
                    onClick={handleAddHeadDigit}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'ရှေ့ပိတ် (၁၀ ကွက်) - ဥပမာ ၁ ရှေ့ပိတ်ဆိုလျှင် ၁၀ မှ ၁၉ အထိ' : 'Head'}
                  >
                    <span>{isMyanmar ? 'ရှေ့ပိတ်' : 'Head'}</span>
                  </button>

                  {/* 5. နောက်ပိတ် (Tail) */}
                  <button
                    type="button"
                    onClick={handleAddTailDigit}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'နောက်ပိတ် (၁၀ ကွက်) - ဥပမာ ၂ နောက်ပိတ်ဆိုလျှင် ၀၂ မှ ၉၂ အထိ' : 'Tail'}
                  >
                    <span>{isMyanmar ? 'နောက်ပိတ်' : 'Tail'}</span>
                  </button>

                  {/* 6. အပူး (Doubles) */}
                  <button
                    type="button"
                    onClick={() => handleAddPattern(TWO_D_DOUBLES, isMyanmar ? 'အပူး' : 'Doubles')}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'အပူး (၀၀ မှ ၉၉ - ၁၀ ကွက်)' : 'Doubles'}
                  >
                    <span>{isMyanmar ? 'အပူး' : 'Doubles'}</span>
                  </button>

                  {/* 7. ပါဝါ (Power) */}
                  <button
                    type="button"
                    onClick={() => handleAddPattern(TWO_D_POWER, isMyanmar ? 'ပါဝါ' : 'Power')}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'ပါဝါ (၁၀ ကွက်)' : 'Power'}
                  >
                    <span>{isMyanmar ? 'ပါဝါ' : 'Power'}</span>
                  </button>

                  {/* 8. နက္ခတ် (Natkhat) */}
                  <button
                    type="button"
                    onClick={() => handleAddPattern(TWO_D_NATKHAT, isMyanmar ? 'နက္ခတ်' : 'Natkhat')}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'နက္ခတ် (၁၀ ကွက်)' : 'Natkhat'}
                  >
                    <span>{isMyanmar ? 'နက္ခတ်' : 'Natkhat'}</span>
                  </button>

                  {/* 9. ညီကို (Brothers) */}
                  <button
                    type="button"
                    onClick={() => handleAddPattern(TWO_D_BROTHERS, isMyanmar ? 'ညီကို' : 'Brothers')}
                    className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={isMyanmar ? 'ညီကို (၂၀ ကွက်)' : 'Brothers'}
                  >
                    <span>{isMyanmar ? 'ညီကို' : 'Brothers'}</span>
                  </button>
                </div>

                {/* Quick Amount Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">
                    {isMyanmar ? 'အမြန်ငွေ:' : 'Quick:'}
                  </span>
                  {[500, 1000, 2000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setAmountInput(String(amt));
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors cursor-pointer"
                    >
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>
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

        {/* Right Column: Pending Cart & Voucher Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col h-full min-h-[500px]">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>{isMyanmar ? 'အရောင်းစာရင်း (ဘောင်ချာ)' : 'Ticket Items'}</span>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-black rounded-full">
                    {items.length}
                  </span>
                </h3>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playDeleteSound();
                    setItems([]);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'အားလုံးဖျက်' : 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] my-3 divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Layers className="w-10 h-10 stroke-1" />
                  <span className="text-sm font-medium">
                    {isMyanmar ? 'ဂဏန်းနှင့် ထိုးကြေး ထည့်သွင်းပါ' : 'No bet items added yet'}
                  </span>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono w-5">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xl font-black text-slate-900">
                        {item.number}
                      </span>
                      {item.isRumble && (
                        <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded">
                          R
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-800">
                        {formatAmount(item.amount, settings.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playDeleteSound();
                          setItems(prev => prev.filter(i => i.id !== item.id));
                        }}
                        className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
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
                    : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95'
                }`}
              >
                <Printer className="w-5 h-5" />
                <span>{isMyanmar ? 'ဘောင်ချာထုတ် / အရောင်းသိမ်းမည်' : 'Save & Print Voucher'}</span>
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
                placeholder={`ဥပမာ-\n24 1000\n42 1000\n24R 500\nအပူး 1000\n5 ဘရိတ် 2000`}
                className="w-full p-3 font-mono text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              ></textarea>
              <p className="text-[11px] text-slate-500">
                {isMyanmar
                  ? 'Format: ဂဏန်းနှင့် ငွေပမာဏကို ခြား၍ ရိုက်ထည့်နိုင်ပါသည် (ဥပမာ- 24 1000, 24R 1000, အပူး 1000, 0 ဘရိတ် 2000)'
                  : 'Enter numbers with amounts separated by spaces or newlines.'}
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
