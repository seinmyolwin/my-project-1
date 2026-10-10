import React, { useState, useId, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Receipt,
  FileText,
  AlertTriangle,
  Sparkles,
  Zap,
  RotateCcw,
  Check,
  Percent,
  User,
  Phone,
  Layers,
  ArrowRight,
  Camera,
  Upload,
  Ban,
  ShieldAlert,
  CheckCircle2,
  X,
  Edit3,
  Lock,
  ArrowLeft,
  Printer
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { BetItem, VoucherItem, Voucher } from '../types';
import { getPermutations, parseQuickBetText, formatAmount, LOTTERY_PATTERNS, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';
import { ImageSlipScannerModal } from './ImageSlipScannerModal';
import { OverLimitConfirmModal, OverLimitItemInfo } from './OverLimitConfirmModal';
import {
  playTapSound,
  playAddSound,
  playSuccessSound,
  playWarningSound,
  playDeleteSound
} from '../utils/audioUtils';

interface QuickSaleEntryProps {
  onVoucherCreated: (voucher: Voucher) => void;
  onOpenForwardModal?: (num?: string, amt?: number) => void;
  onOpenRoundManager?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: (active: boolean) => void;
}

export const QuickSaleEntry: React.FC<QuickSaleEntryProps> = ({
  onVoucherCreated,
  onOpenForwardModal,
  onOpenRoundManager,
  isFocusMode = false,
  onToggleFocusMode
}) => {
  const {
    activeRound,
    settings,
    addVoucher,
    aggregates,
    limits,
    blockedNumbers,
    vouchers,
    isNumberBlocked,
    getNumberLimit,
    addForwardSlip
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Form State
  const [customerName, setCustomerName] = useState('အထွေထွေ (General)');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(settings.defaultCustomerDiscount || 0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (typeof settings.defaultCustomerDiscount === 'number') {
      setDiscountPercent(settings.defaultCustomerDiscount);
    }
  }, [settings.defaultCustomerDiscount]);

  // Single Item Input
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('1000');
  const [isRumble, setIsRumble] = useState(false);

  // Staged Bet Items in current voucher (with localStorage draft checkpoint recovery)
  const [stagedItems, setStagedItems] = useState<BetItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_quick_sale_3d_draft_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // Tracking unconfirmed/active draft items (Yellow) vs confirmed staged items (Green)
  const [latestDraftIds, setLatestDraftIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pos_quick_sale_3d_draft_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [confirmClearActive, setConfirmClearActive] = useState(false);

  // Synchronize staged checkpoints to localStorage to protect against refresh / loss
  useEffect(() => {
    try {
      if (stagedItems.length > 0) {
        localStorage.setItem('pos_quick_sale_3d_draft_items', JSON.stringify(stagedItems));
        localStorage.setItem('pos_quick_sale_3d_draft_ids', JSON.stringify(latestDraftIds));
      } else {
        localStorage.removeItem('pos_quick_sale_3d_draft_items');
        localStorage.removeItem('pos_quick_sale_3d_draft_ids');
      }
    } catch {
      // safe fallback for private browsing
    }
  }, [stagedItems, latestDraftIds]);

  // Batch / Quick text mode toggle
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [rawBatchText, setRawBatchText] = useState('');
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  // Photo Slip Scanner Modal state
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Over-limit Decision Modal state
  const [isOverLimitModalOpen, setIsOverLimitModalOpen] = useState(false);
  const [pendingOverLimitItems, setPendingOverLimitItems] = useState<OverLimitItemInfo[]>([]);
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Floating Toast / Feedback notification
  const [toastNotification, setToastNotification] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
  } | null>(null);

  // Focus Mode States
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [lastAddedFeedback, setLastAddedFeedback] = useState<{
    text: string;
    number: string;
    type: string;
    amount: number;
    count: number;
  } | null>(null);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState(false);
  const voucherListEndRef = useRef<HTMLDivElement>(null);

  // Track dynamic virtual viewport height for mobile keyboards
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      setViewportHeight(window.visualViewport!.height);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Auto-dismiss last added feedback banner after 3.5 seconds
  useEffect(() => {
    if (lastAddedFeedback) {
      const timer = setTimeout(() => {
        setLastAddedFeedback(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lastAddedFeedback]);

  // Auto-scroll voucher ticket list to bottom whenever new items are added
  useEffect(() => {
    if (stagedItems.length > 0) {
      voucherListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [stagedItems.length]);

  const handleRequestExitFocus = () => {
    if (stagedItems.length > 0) {
      setShowExitConfirmModal(true);
    } else {
      onToggleFocusMode?.(false);
    }
  };

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  const handleAddFromScanner = (items: BetItem[], scannedCustomerName: string, scannedPhone: string) => {
    const allowedItems: BetItem[] = [];
    const blockedNums: string[] = [];

    items.forEach(it => {
      if (isNumberBlocked(it.number)) {
        blockedNums.push(it.number);
      } else {
        allowedItems.push(it);
      }
    });

    if (blockedNums.length > 0) {
      const uniqueBlocked = Array.from(new Set(blockedNums));
      setToastNotification({
        type: 'warning',
        message: `စလစ်ဓါတ်ပုံထဲမှ ဒိုင်ကာဂဏန်း [${uniqueBlocked.join(', ')}] များအား ထိုးကြေးတက်လာစေကာမူ လက်မခံဘဲ ပယ်ဖျက်ထားပါသည်`
      });
    }

    if (allowedItems.length > 0) {
      setStagedItems(prev => [...prev, ...allowedItems]);
      setLatestDraftIds(allowedItems.map(i => i.id));
      if (scannedCustomerName && (!customerName || customerName === 'အထွေထွေ (General)')) {
        setCustomerName(scannedCustomerName);
      }
      if (scannedPhone && !customerPhone) {
        setCustomerPhone(scannedPhone);
      }
    }
  };

  const numberInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Unique customer names list for auto-complete
  const previousCustomers = useMemo(() => {
    const names = new Set<string>();
    vouchers.forEach(v => {
      if (v.customerName && v.customerName !== 'အထွေထွေ (General)') {
        names.add(v.customerName);
      }
    });
    return Array.from(names);
  }, [vouchers]);

  // Real-time preview of numbers from numberInput (matching 2D logic & user spec)
  const parsedPreviewNumbers = useMemo(() => {
    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!rawInput) return [];

    const hasStraightKeyword = /ဒဲ့|တဲ့|တည့်/i.test(rawInput);
    const hasRInInput = /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const hasR = !hasStraightKeyword && (isRumble || hasRInInput);
    const cleanForNumbers = rawInput.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);

    // If last token is 4+ digits (like 1000, 5000) and there are prior tokens, treat as amount
    if (rawTokens.length > 1) {
      const lastToken = rawTokens[rawTokens.length - 1];
      if (lastToken.length >= 4 && /^\d+$/.test(lastToken)) {
        rawTokens.pop();
      }
    }

    const valid3D = rawTokens.map(t => t.padStart(3, '0')).filter(n => /^\d{3}$/.test(n));

    if (hasR) {
      const list: string[] = [];
      valid3D.forEach(n => {
        const perms = getPermutations(n);
        perms.forEach(r => {
          if (!list.includes(r)) list.push(r);
        });
      });
      return list;
    }
    return valid3D;
  }, [numberInput, isRumble]);

  // Current number limit check
  const isInputBlocked = useMemo(() => {
    return parsedPreviewNumbers.length === 1 && isNumberBlocked(parsedPreviewNumbers[0]);
  }, [parsedPreviewNumbers, isNumberBlocked]);

  const currentNumberWarning = useMemo(() => {
    if (parsedPreviewNumbers.length !== 1) return null;
    const num = parsedPreviewNumbers[0];
    const agg = aggregates[num];
    const isBlocked = isNumberBlocked(num);
    const limit = getNumberLimit(num);
    const currentSold = agg ? agg.totalSold : 0;
    const amt = parseInt(amountInput, 10) || 0;
    const totalWillBe = currentSold + amt;

    if (isBlocked) {
      return {
        type: 'danger',
        message: `⛔ ဤဂဏန်း [${num}] သည် ဒိုင်ကာဂဏန်း ဖြစ်ပါသည်! ထိုးကြေးမည်မျှတက်လာစေကာမူ လုံးဝလက်မခံပါ!`
      };
    }
    if (limit > 0 && totalWillBe > limit) {
      return {
        type: 'warning',
        message: `⚠️ ဂဏန်း [${num}] သတ်မှတ်ထိုးကြေး ကျော်လွန်နေပါသည် (ရောင်းပြီး: ${formatAmount(currentSold, settings.currency)} / ဘရိတ်: ${formatAmount(limit, settings.currency)}) - ဘောင်ချာထုတ်ချိန်တွင် ဒိုင်ကြီးဆီ ဆက်တင်နိုင်ပါသည်`
      };
    }
    if (limit > 0 && (totalWillBe / limit) >= (settings.lowStockAlertPercentage / 100)) {
      return {
        type: 'warning',
        message: `ဂဏန်း [${num}] လက်ကျန်နည်းနေပါသည် (${Math.round((totalWillBe / limit) * 100)}% ရောင်းပြီး)`
      };
    }
    return null;
  }, [parsedPreviewNumbers, amountInput, aggregates, isNumberBlocked, getNumberLimit, settings]);

  // Permutation count preview
  const permPreview = useMemo(() => {
    return parsedPreviewNumbers;
  }, [parsedPreviewNumbers]);

  // Calculate Subtotal and Net
  const subtotal = useMemo(() => {
    return stagedItems.reduce((acc, item) => acc + item.amount, 0);
  }, [stagedItems]);

  const discountAmount = useMemo(() => {
    if (discountPercent <= 0) return 0;
    return Math.round((subtotal * discountPercent) / 100);
  }, [subtotal, discountPercent]);

  const netPayable = subtotal - discountAmount;

  // Add Single or Multiple Bet Handler
  const handleAddBet = (e?: React.FormEvent) => {
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
      numberInputRef.current?.focus();
      return;
    }

    const hasStraightKeyword = /ဒဲ့|တဲ့|တည့်/i.test(rawInput);
    const hasRInInput = /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const effectiveRumble = hasStraightKeyword ? false : (isRumble || hasRInInput);

    const cleanForNumbers = rawInput.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);

    if (rawTokens.length === 0) {
      playWarningSound();
      numberInputRef.current?.focus();
      return;
    }

    let amount = parseInt(convertMyanmarToEnglishDigits(amountInput).trim(), 10);

    // Check inline amount
    if (isNaN(amount) || amount <= 0) {
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        const parsedLast = parseInt(lastToken, 10);
        if (!isNaN(parsedLast) && parsedLast > 0) {
          amount = parsedLast;
          rawTokens.pop();
        }
      }
    } else {
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        if (lastToken.length >= 4 && /^\d+$/.test(lastToken)) {
          const parsedLast = parseInt(lastToken, 10);
          if (!isNaN(parsedLast) && parsedLast > 0) {
            amount = parsedLast;
            rawTokens.pop();
          }
        }
      }
    }

    if (isNaN(amount) || amount <= 0) {
      playWarningSound();
      setToastNotification({
        type: 'warning',
        message: isMyanmar ? 'ထိုးကြေးငွေ ထည့်သွင်းပါ (ဥပမာ- ၁၀၀၀)' : 'Enter bet amount (e.g., 1000)'
      });
      amountInputRef.current?.focus();
      return;
    }

    const targetNumbers = rawTokens.map(t => t.padStart(3, '0')).filter(n => /^\d{3}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      setToastNotification({
        type: 'error',
        message: isMyanmar ? 'ဂဏန်း (၃ လုံး) မှန်ကန်စွာ ထည့်သွင်းပါ' : 'Enter valid 3-digit numbers'
      });
      numberInputRef.current?.focus();
      return;
    }

    const newItems: BetItem[] = [];
    const blockedFound: string[] = [];

    targetNumbers.forEach(cleanNum => {
      if (!effectiveRumble) {
        if (isNumberBlocked(cleanNum)) {
          blockedFound.push(cleanNum);
        } else {
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            number: cleanNum,
            amount: amount,
            isRumble: false,
            betType: 'straight',
            originalInput: cleanNum
          });
        }
      } else {
        const perms = getPermutations(cleanNum);
        const groupId = `r3d-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        perms.forEach(p => {
          if (isNumberBlocked(p)) {
            blockedFound.push(p);
          } else {
            if (!newItems.some(item => item.number === p && item.groupId === groupId)) {
              newItems.push({
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                number: p,
                amount: amount,
                isRumble: true,
                betType: 'rumble',
                groupId,
                originalNumber: cleanNum,
                originalAmount: amount,
                permutations: perms,
                originalInput: `${cleanNum} R`
              });
            }
          }
        });
      }
    });

    if (blockedFound.length > 0) {
      playWarningSound();
      setToastNotification({
        type: 'warning',
        message: `ဒိုင်ကာဂဏန်း [${Array.from(new Set(blockedFound)).join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်`
      });
    }

    if (newItems.length > 0) {
      playAddSound();
      setStagedItems(prev => [...prev, ...newItems]);
      setLatestDraftIds(newItems.map(i => i.id));
      
      const displayNum = targetNumbers.length === 1 ? targetNumbers[0] : `${targetNumbers[0]} (${targetNumbers.length} ကွက်)`;
      const typeName = effectiveRumble ? (isMyanmar ? 'ပတ်လည်' : 'R') : (isMyanmar ? 'ဒဲ့' : 'Direct');
      const totalEnteredAmt = amount * newItems.length;
      setLastAddedFeedback({
        text: `ဂဏန်း [${displayNum}] (${typeName}) ${formatAmount(totalEnteredAmt, settings.currency)}`,
        number: displayNum,
        type: typeName,
        amount: totalEnteredAmt,
        count: newItems.length
      });

      // Reset number input immediately, keep amountInput in focus mode for rapid-fire sequence!
      setNumberInput('');
      if (!isFocusMode) {
        setAmountInput('');
      }
      setIsRumble(false);
      numberInputRef.current?.focus();
      setToastNotification({
        type: 'success',
        message: isMyanmar
          ? `ဂဏန်း [${displayNum}] (${typeName}) ${formatAmount(totalEnteredAmt, settings.currency)} ထည့်ပြီးပါပြီ`
          : `Added ${newItems.length} items to voucher`
      });
    }
  };

  // ဒဲ့ (Straight / Direct Handler)
  const handleAddStraightClick = () => {
    playTapSound();
    setIsRumble(false);
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const cleanAmt = convertMyanmarToEnglishDigits(amountInput).trim();
    if (cleanNum) {
      let amt = parseInt(cleanAmt, 10);
      if (isNaN(amt) || amt <= 0) {
        const rawTokens = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ').replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
        if (rawTokens.length > 1) {
          const lastToken = rawTokens[rawTokens.length - 1];
          const parsedLast = parseInt(lastToken, 10);
          if (!isNaN(parsedLast) && parsedLast > 0) {
            amt = parsedLast;
          }
        }
      }
      if (!isNaN(amt) && amt > 0) {
        handleAddBet();
      } else {
        amountInputRef.current?.focus();
      }
    } else {
      numberInputRef.current?.focus();
    }
  };

  // ပတ်လည် (Rumble / Permutations) Handler matching 2D & user spec
  const handleAddRumbleClick = () => {
    playTapSound();
    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (rawInput) {
      const cleanForNumbers = rawInput.replace(/r|R|ပတ်လည်|အာ|ပတ်/gi, ' ');
      const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        if (lastToken.length >= 4 && /^\d+$/.test(lastToken)) {
          const amtVal = rawTokens.pop();
          if (amtVal && (!amountInput || amountInput === '0')) {
            setAmountInput(amtVal);
          }
        }
      }
      const targetNumbers = rawTokens.map(t => t.padStart(3, '0')).filter(n => /^\d{3}$/.test(n));

      if (targetNumbers.length > 0) {
        setIsRumble(true);
        amountInputRef.current?.focus();
        setToastNotification({
          type: 'success',
          message: isMyanmar
            ? `ပတ်လည် (R) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' နှိပ်ပါ`
            : `Rumble (R) selected. Enter amount and tap Add.`
        });
        return;
      }
    }
    const nextState = !isRumble;
    setIsRumble(nextState);
    setToastNotification({
      type: nextState ? 'success' : 'warning',
      message: isMyanmar ? (nextState ? 'ပတ်လည် (R) ဖွင့်ထားပါသည်' : 'ပတ်လည် (R) ပိတ်ထားပါသည်') : (nextState ? 'Rumble ON' : 'Rumble OFF')
    });
  };

  // Preset Patterns (အပူး, ပါဝါ, နက္ခတ်, ညီကို: fills numbers into number box matching 2D)
  const handleAddPatternPreset = (numbers: string[], label: string) => {
    playTapSound();
    setNumberInput(numbers.join(', '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    setToastNotification({
      type: 'success',
      message: isMyanmar
        ? `[${label}] (${numbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ။ ထိုးကြေးထည့်ပြီး 'ထည့်မည်' ကိုနှိပ်ပါ`
        : `Selected [${label}] (${numbers.length} numbers). Enter amount and tap Add.`
    });
  };

  // Edit Draft Item (fills input form and recalculates totals and limits upon update)
  const handleEditItem = (item: BetItem) => {
    playTapSound();
    const origNum = item.originalNumber || item.number;
    const origAmt = item.originalAmount || item.amount;
    const isR = item.isRumble || false;

    setNumberInput(origNum);
    setAmountInput(String(origAmt));
    setIsRumble(isR);

    // If item is part of a Rumble group, remove the entire group so it doesn't leave orphaned permutations
    if (item.groupId) {
      const gId = item.groupId;
      const removedIds = new Set(stagedItems.filter(i => i.groupId === gId).map(i => i.id));
      setStagedItems(prev => prev.filter(i => i.groupId !== gId));
      setLatestDraftIds(prev => prev.filter(id => !removedIds.has(id)));
    } else {
      setStagedItems(prev => prev.filter(i => i.id !== item.id));
      setLatestDraftIds(prev => prev.filter(id => id !== item.id));
    }

    numberInputRef.current?.focus();
    setToastNotification({
      type: 'warning',
      message: `ဂဏန်း [${origNum}] အား ပြင်ဆင်ရန် အောက်ပါအကွက်တွင် ဖြည့်သွင်းထားပါသည်`
    });
  };

  // Restart / Rollback from a specific Checkpoint item (Rule #9, #10)
  // Keeps all items before this index (or before this entire rumble group),
  // populates input controls with this item's data, and cleans up subsequent items.
  const handleRestartFromCheckpoint = (index: number, item: BetItem) => {
    playTapSound();
    let preservedItems: BetItem[];
    if (item.groupId) {
      const firstGroupIdx = stagedItems.findIndex(i => i.groupId === item.groupId);
      preservedItems = stagedItems.slice(0, firstGroupIdx >= 0 ? firstGroupIdx : index);
    } else {
      preservedItems = stagedItems.slice(0, index);
    }

    setStagedItems(preservedItems);
    setLatestDraftIds([]);
    setNumberInput(item.originalNumber || item.number);
    setAmountInput(String(item.originalAmount || item.amount));
    setIsRumble(item.isRumble || false);
    numberInputRef.current?.focus();
    setToastNotification({
      type: 'warning',
      message: `ဂဏန်း [${item.originalNumber || item.number}] မှ ပြန်လည်စတင်ရန် Input Box ထဲ ပြန်ထည့်ပေးထားပြီး ယခင် Checkpoint အထိ အပြည့်အဝ ထိန်းသိမ်းထားပါသည်`
    });
  };

  // Remove Item (removes entire rumble group if part of a group, avoiding orphaned permutations)
  const handleRemoveItem = (id: string) => {
    playDeleteSound();
    const target = stagedItems.find(i => i.id === id);
    if (target?.groupId) {
      const gId = target.groupId;
      const removedIds = new Set(stagedItems.filter(i => i.groupId === gId).map(i => i.id));
      setStagedItems(prev => prev.filter(item => item.groupId !== gId));
      setLatestDraftIds(prev => prev.filter(item => !removedIds.has(item)));
    } else {
      setStagedItems(prev => prev.filter(item => item.id !== id));
      setLatestDraftIds(prev => prev.filter(item => item !== id));
    }
  };

  // Add Pattern Numbers (e.g. Triples/Doubles, Power, Natkhat)
  const handleAddPattern = (name: string, numbers: string[]) => {
    const amount = parseInt(amountInput, 10) || 1000;
    const allowed = numbers.filter(n => !isNumberBlocked(n));
    const blocked = numbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      playWarningSound();
      setToastNotification({
        type: 'warning',
        message: `သတိပြုရန်: [${name}] အတွင်းမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] များအား ထိုးကြေးလက်မခံဘဲ ချန်လှပ်ထားပါသည်`
      });
    }

    if (allowed.length === 0) {
      playWarningSound();
      return;
    }

    const newItems: BetItem[] = allowed.map((num, idx) => ({
      id: `item-pat-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 3)}`,
      number: num,
      amount: amount,
      isRumble: false,
      originalInput: `${name} (${num})`
    }));
    playAddSound();
    setStagedItems(prev => [...prev, ...newItems]);
    setLatestDraftIds(newItems.map(i => i.id));
  };

  // Parse Text Batch
  const handleProcessBatchText = () => {
    if (!rawBatchText.trim()) return;
    const { items, errors } = parseQuickBetText(rawBatchText);
    const allowedItems: BetItem[] = [];
    const blockedErrors: string[] = [];

    items.forEach(it => {
      if (isNumberBlocked(it.number)) {
        blockedErrors.push(`⛔ ဂဏန်း [${it.number}] သည် ဒိုင်ကာဂဏန်း ဖြစ်သဖြင့် ထိုးကြေးတက်လာသော်လည်း လုံးဝလက်မခံပါ (ပယ်ဖျက်သည်)`);
      } else {
        allowedItems.push(it);
      }
    });

    setBatchErrors([...errors, ...blockedErrors]);

    if (allowedItems.length > 0) {
      playAddSound();
      setStagedItems(prev => [...prev, ...allowedItems]);
      setLatestDraftIds(allowedItems.map(i => i.id));
      setRawBatchText('');
      if (errors.length === 0 && blockedErrors.length === 0) {
        setShowBatchModal(false);
      }
    } else {
      playWarningSound();
    }
  };

  // Finalize and Save Voucher helper
  const finalizeAndSaveVoucher = (itemsToSave: BetItem[], extraNotes?: string) => {
    if (!activeRound || activeRound.status !== 'open') {
      playWarningSound();
      alert('လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ');
      setIsSavingVoucher(false);
      return;
    }

    const voucherItems: VoucherItem[] = itemsToSave.map(item => ({
      number: item.number,
      amount: item.amount,
      betType: item.isRumble ? 'rumble' : 'straight',
      groupId: item.groupId,
      originalNumber: item.originalNumber,
      originalAmount: item.originalAmount,
      permutations: item.permutations
    }));

    const finalSubtotal = itemsToSave.reduce((acc, item) => acc + item.amount, 0);
    const finalDiscount = discountPercent > 0 ? Math.round((finalSubtotal * discountPercent) / 100) : 0;
    const finalNetPayable = finalSubtotal - finalDiscount;

    const mergedNotes = [notes.trim(), extraNotes].filter(Boolean).join(' ');

    const newVoucher = addVoucher({
      roundId: activeRound?.id || 'default',
      customerName: customerName.trim() || 'အထွေထွေ (General)',
      customerPhone: customerPhone.trim(),
      items: voucherItems,
      subtotal: finalSubtotal,
      discountPercent,
      discountAmount: finalDiscount,
      netPayable: finalNetPayable,
      notes: mergedNotes,
      isPaid: true,
      status: 'active'
    });

    // Clear Staging
    setStagedItems([]);
    setLatestDraftIds([]);
    setNotes('');
    playSuccessSound();
    setToastNotification({
      type: 'success',
      message: `ဘောင်ချာ ${newVoucher.voucherNo} အား အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ`
    });
    setIsSavingVoucher(false);
    onVoucherCreated(newVoucher);
  };

  // Submit Voucher - checks for Blocked & Over-limit numbers
  const handleSaveVoucher = () => {
    if (!activeRound || activeRound.status !== 'open') {
      playWarningSound();
      alert('လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ');
      setToastNotification({
        type: 'error',
        message: 'လက်ရှိပွဲစဉ် ပိတ်ထားပါသည် (သို့မဟုတ် ပေါက်ဂဏန်းအတည်ပြုပြီးဖြစ်ပါသည်)။ စာရင်းသွင်းရန် ပွဲစဉ်အသစ် အရင်ဖွင့်ပါ'
      });
      return;
    }

    if (stagedItems.length === 0 || isSavingVoucher) {
      playWarningSound();
      return;
    }

    setIsSavingVoucher(true);

    // 1. Strict Fail-Safe: Check for any Blocked Numbers (ဒိုင်ကာဂဏန်း)
    const blockedFound = stagedItems.filter(item => isNumberBlocked(item.number));
    if (blockedFound.length > 0) {
      const bNums = Array.from(new Set(blockedFound.map(b => b.number)));
      alert(`⚠️ သတိပေးချက်: အောက်ပါဂဏန်းများသည် 'ဒိုင်ကာဂဏန်း' ဖြစ်သဖြင့် ထိုးကြေးတက်လာစေကာမူ လုံးဝလက်မခံနိုင်ပါ:\n\n[${bNums.join(', ')}]\n\nအဆိုပါဂဏန်းများကို စာရင်းမှ ဖယ်ရှားပေးပါမည်။`);
      setStagedItems(prev => prev.filter(item => !isNumberBlocked(item.number)));
      setIsSavingVoucher(false);
      return;
    }

    // 2. Over-Limit Check across cart items (Recorded separately for batch forwarding)
    const cartTotals: { [num: string]: number } = {};
    stagedItems.forEach(item => {
      cartTotals[item.number] = (cartTotals[item.number] || 0) + item.amount;
    });

    let hasOverLimit = false;
    Object.entries(cartTotals).forEach(([num, totalInCart]) => {
      const limit = getNumberLimit(num);
      const existingSold = aggregates[num]?.totalSold || 0;
      if (limit > 0 && (existingSold + totalInCart > limit)) {
        hasOverLimit = true;
      }
    });

    // Save voucher directly to ledger without interrupting the user
    finalizeAndSaveVoucher(stagedItems);

    if (hasOverLimit) {
      setToastNotification({
        message: isMyanmar
          ? 'ဘောင်ချာ သိမ်းဆည်းပြီးပါပြီ'
          : 'Voucher saved successfully.',
        type: 'success'
      });
    }
  };

  // Confirm over-limit resolution from OverLimitConfirmModal
  const handleConfirmOverLimit = (
    decisions: OverLimitItemInfo[],
    masterAgentName: string,
    masterAgentPhone: string,
    commissionRate: number
  ) => {
    const forwardItems: { number: string; amount: number }[] = [];
    const forwardNotesList: string[] = [];

    const decisionMap = new Map<string, OverLimitItemInfo>();
    decisions.forEach(d => decisionMap.set(d.number, d));

    const finalItems: BetItem[] = [];

    // Group staged items by number
    const itemsByNumber: { [num: string]: BetItem[] } = {};
    stagedItems.forEach(item => {
      if (!itemsByNumber[item.number]) itemsByNumber[item.number] = [];
      itemsByNumber[item.number].push(item);
    });

    Object.entries(itemsByNumber).forEach(([num, numItems]) => {
      const decision = decisionMap.get(num);

      if (!decision) {
        // Not an over-limit number, keep as is
        finalItems.push(...numItems);
        return;
      }

      if (decision.action === 'forward_excess') {
        // Retain customer's full bet on slip, forward the excess portion to Master Agent
        finalItems.push(...numItems);
        if (decision.excessAmount > 0) {
          forwardItems.push({ number: num, amount: decision.excessAmount });
          forwardNotesList.push(`${num} (+${formatAmount(decision.excessAmount, settings.currency)})`);
        }
      } else if (decision.action === 'forward_all') {
        // Retain on customer slip, forward all to Master Agent
        finalItems.push(...numItems);
        if (decision.originalAmount > 0) {
          forwardItems.push({ number: num, amount: decision.originalAmount });
          forwardNotesList.push(`${num} (အားလုံး ${formatAmount(decision.originalAmount, settings.currency)})`);
        }
      } else if (decision.action === 'accept_locally') {
        // Dealer retains 100% locally
        finalItems.push(...numItems);
      } else if (decision.action === 'cap_at_limit') {
        // Only accept up to remaining quota on the customer slip
        if (decision.remainingQuota > 0) {
          finalItems.push({
            ...numItems[0],
            amount: decision.remainingQuota
          });
        }
      } else if (decision.action === 'reject') {
        // Completely discard this number
      }
    });

    // Create Master Dealer Forward Slip if any items forwarded
    let forwardNotes = '';
    if (forwardItems.length > 0) {
      const fwdTotal = forwardItems.reduce((acc, i) => acc + i.amount, 0);
      const commRate = commissionRate || settings.defaultCommissionRate || 0;
      const commAmt = Math.round((fwdTotal * commRate) / 100);
      const netPaid = fwdTotal - commAmt;

      addForwardSlip({
        roundId: activeRound?.id || 'default',
        masterAgentName: masterAgentName || settings.defaultMasterAgentName || 'ဒိုင်ချုပ်ကြီး',
        masterAgentPhone: masterAgentPhone || settings.defaultMasterAgentPhone || '',
        items: forwardItems,
        totalAmount: fwdTotal,
        commissionRate: commRate,
        commissionAmount: commAmt,
        netPaid,
        notes: `ဖောက်သည် ${customerName || 'အထွေထွေ'} ၏ ဘောင်ချာမှ သတ်မှတ်ထိုးကြေး ပိုလျှံငွေ အထက်တင်ခြင်း`
      });

      forwardNotes = `(ဒိုင်ကြီးဆီ ဆက်တင်ငွေ: ${forwardNotesList.join(', ')})`;
    }

    setIsOverLimitModalOpen(false);
    setPendingOverLimitItems([]);

    if (finalItems.length > 0) {
      finalizeAndSaveVoucher(finalItems, forwardNotes);
    } else {
      alert(isMyanmar ? 'ထိုးဂဏန်းများ အားလုံး ပယ်ဖျက်လိုက်သဖြင့် ဘောင်ချာမထုတ်ပါ' : 'All bets rejected, voucher not created.');
      setStagedItems([]);
    }
  };

  const quickAmounts = [500, 1000, 2000, 3000, 5000, 10000, 20000];

  // =========================================================================
  // 3D QUICK ENTRY FOCUS MODE (FOR PHONES & TABLETS)
  // =========================================================================
  if (isFocusMode) {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden font-sans select-none"
        style={viewportHeight ? { height: `${viewportHeight}px` } : { height: '100dvh' }}
      >
        {/* Top Distraction-free Focus Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
          <button
            type="button"
            onClick={handleRequestExitFocus}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs min-h-[44px] cursor-pointer transition-colors shadow-2xs"
            title="Focus Mode မှ ထွက်မည်"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span>{isMyanmar ? 'ထွက်မည်' : 'Exit'}</span>
          </button>

          <div className="text-center min-w-0 flex-1 px-1">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{isMyanmar ? '3D အမြန်စာရင်းသွင်း' : '3D Quick Entry'}</span>
            </h2>
            <div className="text-[11px] text-indigo-700 font-bold truncate">
              {activeRound?.name || 'ပွဲစဉ်'} {activeRound?.status === 'open' ? '● ဖွင့်ထားသည်' : '● ပိတ်ထားသည်'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerModalOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-indigo-800 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
              title="စလစ်ဓါတ်ပုံ စကင်ဖတ်ရန်"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="min-h-[44px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors font-bold text-xs flex items-center gap-1"
              title="စာသားကူးထည့်ရန်"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isMyanmar ? 'ကူးထည့်' : 'Batch'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveVoucher}
              disabled={stagedItems.length === 0}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-all ${
                stagedItems.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ဘောင်ချာ' : 'Save'}</span>
            </button>
          </div>
        </header>

        {/* Voucher Draft & Items Table on TOP (Requirement 3) */}
        <section className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden border-b border-slate-200">
          {/* Customer & Discount Header */}
          <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">
                {customerName ? customerName : (isMyanmar ? 'အထွေထွေ (General)' : 'General')}
              </span>
              {customerPhone && (
                <span className="text-[11px] font-mono text-slate-500 truncate">({customerPhone})</span>
              )}
              {discountPercent > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                  -{discountPercent}%
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCustomerDetailsOpen(!isCustomerDetailsOpen)}
              className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer shrink-0 ml-2"
            >
              {isCustomerDetailsOpen ? (isMyanmar ? 'ပိတ်မည်' : 'Close') : (isMyanmar ? 'အမည်ပြင်' : 'Edit')}
            </button>
          </div>

          {/* Customer Details Drawer if opened */}
          {isCustomerDetailsOpen && (
            <div className="bg-slate-100/90 p-2.5 border-b border-slate-200 grid grid-cols-12 gap-2 animate-in fade-in duration-150 shrink-0">
              <input
                type="text"
                placeholder={isMyanmar ? 'ထိုးသူအမည်' : 'Customer Name'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="col-span-6 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
              />
              <input
                type="tel"
                placeholder={isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone'}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="col-span-4 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
              />
              <div className="col-span-2 relative">
                <input
                  type="number"
                  min={0}
                  max={30}
                  placeholder="%"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold text-center"
                />
              </div>
            </div>
          )}

          {/* Checkpoints Bar (Requirement 5) */}
          <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">
                {isMyanmar ? 'ထိုးဂဏန်းများ' : 'Bets'} ({stagedItems.length})
              </span>
              <span className="font-mono font-black text-sm text-indigo-700">
                {formatAmount(netPayable, settings.currency)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Yellow Draft Checkpoint */}
              <div
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                  latestDraftIds.length > 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-white text-slate-500 border-slate-200 opacity-60'
                }`}
                title={isMyanmar ? 'စစ်ဆေးဆဲ ဂဏန်းများ' : 'Draft items'}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{isMyanmar ? 'ဝါ (စစ်ဆေးဆဲ' : 'Yellow'}: {latestDraftIds.length}</span>
              </div>

              {/* Green Confirmed Checkpoint */}
              <div
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                  stagedItems.length - latestDraftIds.length > 0
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white text-slate-500 border-slate-200 opacity-60'
                }`}
                title={isMyanmar ? 'အတည်ပြုပြီး ဂဏန်းများ' : 'Confirmed items'}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>{isMyanmar ? 'စိမ်း (အတည်' : 'Green'}: {stagedItems.length - latestDraftIds.length}</span>
              </div>

              {/* Confirm all drafts button */}
              {latestDraftIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setLatestDraftIds([]);
                    setToastNotification({
                      type: 'success',
                      message: isMyanmar ? 'ဂဏန်းအားလုံးကို ယာယီအတည်ပြုပြီးပါပြီ' : 'Draft items confirmed'
                    });
                  }}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                  title="စစ်ဆေးဆဲ ဂဏန်းများအားလုံးကို ယာယီအတည်ပြုမည်"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{isMyanmar ? 'ယာယီအတည်' : 'OK'}</span>
                </button>
              )}

              {/* Clear all items */}
              {stagedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playDeleteSound();
                    setStagedItems([]);
                    setLatestDraftIds([]);
                    setToastNotification({
                      type: 'warning',
                      message: isMyanmar ? 'စာရင်းသွင်းထားသော ဂဏန်းအားလုံးကို ဖျက်လိုက်ပါပြီ' : 'Cleared all items'
                    });
                  }}
                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="အားလုံးဖျက်မည်"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Items List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50">
            {stagedItems.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-slate-400 space-y-2 py-8">
                <Receipt className="w-8 h-8 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  {isMyanmar ? 'ဘောင်ချာထဲတွင် ဂဏန်းများ မရှိသေးပါ' : 'No items added yet'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isMyanmar ? 'အောက်ပါအကွက်တွင် ဂဏန်းရိုက်ပြီး “ထည့်မည်” ကို နှိပ်ပါ' : 'Type number below and press Add'}
                </p>
              </div>
            ) : (
              stagedItems.map((item, idx) => {
                const isDraft = latestDraftIds.includes(item.id);
                const isLatest = lastAddedFeedback && lastAddedFeedback.number.includes(item.number);
                return (
                  <div
                    key={item.id}
                    className={`py-2 px-3 flex items-center justify-between rounded-xl transition-all ${
                      isDraft
                        ? 'bg-amber-50/95 border-2 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/40'
                        : 'bg-emerald-50/90 border border-emerald-300 text-emerald-950 shadow-2xs'
                    } ${isLatest ? 'animate-pulse' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-mono w-5 font-bold shrink-0 ${isDraft ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                        {item.number}
                      </span>
                      {item.isRumble && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-900 text-[10px] font-black rounded shrink-0">
                          R
                        </span>
                      )}
                      {item.originalInput && item.originalInput !== item.number && (
                        <span className="text-[10px] font-medium text-slate-500 truncate max-w-[80px]">
                          {item.originalInput}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          isDraft
                            ? 'bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {isDraft ? (isMyanmar ? 'စစ်ဆေးဆဲ' : 'Draft') : (isMyanmar ? 'အတည်' : 'OK')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm sm:text-base font-black text-emerald-700">
                        {formatAmount(item.amount, settings.currency)}
                      </span>
                      {/* Touch-friendly Large Edit Button (min 44px) - Requirement 5 */}
                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 text-slate-700 active:text-indigo-800 transition-colors cursor-pointer"
                        title={isMyanmar ? 'ပြင်ဆင်မည်' : 'Edit item'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {/* Touch-friendly Large Delete Button (min 44px) - Requirement 5 */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 transition-colors cursor-pointer"
                        title={isMyanmar ? 'ဖျက်မည်' : 'Delete item'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={voucherListEndRef} />
          </div>
        </section>

        {/* Bottom Docked Section: Number/Stake Input & Add (Requirement 3) */}
        <footer className="shrink-0 bg-white border-t border-slate-200 p-2 sm:p-3 shadow-xl space-y-2">
          {/* Instant Feedback Banner (Requirement 4) */}
          {lastAddedFeedback && (
            <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
                <span className="truncate">✓ {lastAddedFeedback.text}</span>
              </div>
              <span className="text-[10px] text-emerald-100 font-mono shrink-0 ml-1">
                {isMyanmar ? 'ဘောင်ချာထဲသို့ ဝင်သွားပါပြီ' : 'Added to slip'}
              </span>
            </div>
          )}

          {/* Quick Shortcuts Bar (3D Patterns) */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={handleAddStraightClick}
              className={`px-3 py-1.5 text-xs font-black rounded-lg shrink-0 cursor-pointer transition-all ${
                !isRumble ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <span>{isMyanmar ? 'ဒဲ့' : 'Direct'}</span>
            </button>
            <button
              type="button"
              onClick={handleAddRumbleClick}
              className={`px-3 py-1.5 text-xs font-black rounded-lg shrink-0 cursor-pointer transition-all ${
                isRumble ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <span>{isMyanmar ? 'ပတ်လည်' : 'R'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.triples, isMyanmar ? 'အပူး' : 'Triples')}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
            >
              <span>{isMyanmar ? 'အပူး' : 'Triples'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.consecutives, isMyanmar ? 'ညီကို' : 'Brothers')}
              className="px-2.5 py-1.5 bg-teal-50 text-teal-800 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
            >
              <span>{isMyanmar ? 'ညီကို' : 'Brothers'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.getPowerPairs().slice(0, 15), isMyanmar ? 'ပါဝါ' : 'Power')}
              className="px-2.5 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
            >
              <span>{isMyanmar ? 'ပါဝါ' : 'Power'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.getNatkhatPairs().slice(0, 15), isMyanmar ? 'နက္ခတ်' : 'Natkhat')}
              className="px-2.5 py-1.5 bg-rose-50 text-rose-800 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
            >
              <span>{isMyanmar ? 'နက္ခတ်' : 'Natkhat'}</span>
            </button>
          </div>

          {/* Main Input Controls: Number -> Stake -> Add (Requirement 6) */}
          <form onSubmit={handleAddBet} className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Number Input */}
              <div className="col-span-5">
                <input
                  ref={numberInputRef}
                  type="text"
                  placeholder={isMyanmar ? 'ဂဏန်း' : 'Number'}
                  value={numberInput}
                  onChange={(e) => {
                    const val = convertMyanmarToEnglishDigits(e.target.value);
                    setNumberInput(val);
                    if (latestDraftIds.length > 0 && val.trim().length > 0) {
                      setLatestDraftIds([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (numberInput.trim().length > 0) {
                        amountInputRef.current?.focus();
                        amountInputRef.current?.select();
                      }
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
                  className={`w-full h-12 px-2 text-center font-mono text-xl sm:text-2xl font-black rounded-xl border transition-all ${
                    isInputBlocked
                      ? 'border-rose-400 bg-rose-50 text-rose-800'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 bg-slate-50 focus:bg-white text-slate-900'
                  }`}
                  autoFocus
                />
              </div>

              {/* Stake Input */}
              <div className="col-span-4">
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={isMyanmar ? 'ထိုးကြေး' : 'Stake'}
                  value={amountInput}
                  onChange={(e) => {
                    const val = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '');
                    setAmountInput(val);
                    if (latestDraftIds.length > 0 && val.trim().length > 0) {
                      setLatestDraftIds([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBet();
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
                  className="w-full h-12 px-2 text-right font-mono text-base sm:text-lg font-black rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 bg-slate-50 focus:bg-white text-slate-900 transition-all"
                />
              </div>

              {/* Add Button */}
              <div className="col-span-3">
                <button
                  type="submit"
                  disabled={isInputBlocked || isSubmitting}
                  className={`w-full h-12 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer ${
                    isInputBlocked || isSubmitting
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>{isMyanmar ? 'ထည့်မည်' : 'Add'}</span>
                </button>
              </div>
            </div>

            {/* Quick Stake Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setAmountInput(String(amt));
                    numberInputRef.current?.focus();
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 text-slate-700 text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>
          </form>

          {/* Bottom Total & Save Voucher Bar */}
          {stagedItems.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold truncate">
                <span>{isMyanmar ? 'ကျသင့်ငွေ:' : 'Total:'}</span>
                <span className="font-mono font-black text-sm text-indigo-700">
                  {formatAmount(netPayable, settings.currency)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSaveVoucher}
                className="flex-1 max-w-[200px] h-10 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'ဘောင်ချာထုတ်မည်' : 'Save Slip'}</span>
              </button>
            </div>
          )}
        </footer>

        {/* Exit Confirmation Dialog (Requirement 9) */}
        {showExitConfirmModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h4 className="font-black text-base text-slate-900">
                  {isMyanmar ? 'Focus Mode မှ ထွက်မည်လား?' : 'Exit Focus Mode?'}
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isMyanmar
                  ? `လက်ရှိဘောင်ချာထဲတွင် စာရင်းသွင်းထားသော ဂဏန်း (${stagedItems.length}) ကွက် ရှိနေပါသေးသည်။ ထွက်လိုက်ပါက အဆိုပါ ဂဏန်းများကို သိမ်းဆည်းမည် မဟုတ်ပါ။`
                  : `You have ${stagedItems.length} items in the current slip. Exiting without saving will discard them.`}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExitConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  {isMyanmar ? 'ဆက်လက်သွင်းမည်' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitConfirmModal(false);
                    onToggleFocusMode?.(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                >
                  {isMyanmar ? 'ထွက်မည် (ဖျက်မည်)' : 'Discard & Exit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals for 3D Focus Mode */}
        {showBatchModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>{isMyanmar ? 'စာသားကူးထည့်ရန် (Batch Paste)' : 'Batch Paste'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea
                value={rawBatchText}
                onChange={(e) => setRawBatchText(convertMyanmarToEnglishDigits(e.target.value))}
                placeholder={`123=1000\n456-500\n789R=1000\n555=2000`}
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-semibold cursor-pointer"
                >
                  {isMyanmar ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleProcessBatchText();
                    setShowBatchModal(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {isMyanmar ? 'စာရင်းသွင်းမည်' : 'Process'}
                </button>
              </div>
            </div>
          </div>
        )}

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

        <ImageSlipScannerModal
          isOpen={isScannerModalOpen}
          onClose={() => setIsScannerModalOpen(false)}
          onAddBetsToCart={handleAddFromScanner}
          mode="3d"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Mobile/Tablet Enter Focus Mode Banner */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => onToggleFocusMode?.(true)}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{isMyanmar ? '⚡ အမြန်စာရင်းသွင်း Focus Mode သို့ဝင်မည်' : '⚡ Enter Quick Entry Focus Mode'}</span>
        </button>
      </div>
      {/* Floating / Top Toast Notification */}
      {toastNotification && (
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200 ${
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
            <span className="text-xs sm:text-sm font-bold">
              {toastNotification.message}
            </span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner / Round Status notice */}
      {(!activeRound || activeRound.status !== 'open') && (
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

      {/* Main Grid: Left = Entry Controls, Right = Slip Preview / Items Cart (On Mobile/Tablet, Voucher Draft on Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Desktop Left / Mobile Bottom): Quick Entry Pad & Helpers */}
        <div className="order-2 lg:order-1 lg:col-span-7 space-y-5">
          
          {/* Main Keypad / Input Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            
            {/* Box Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900">
                    {isMyanmar ? 'အမြန်သွင်း' : 'Fast Entry'}
                  </h2>
                </div>
              </div>

              {/* Action Buttons (Photo Scan & Batch Text) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Photo OCR Scanner Trigger */}
                <button
                  type="button"
                  onClick={() => setIsScannerModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-transform active:scale-95 shadow-2xs cursor-pointer whitespace-nowrap"
                  title="ဓါတ်ပုံ / စလစ်ထဲမှ ဂဏန်းများကို အလိုအလျောက် ဖတ်ယူရန်"
                >
                  <Camera className="w-3 h-3 shrink-0" />
                  <span>{isMyanmar ? 'စကင်ဖတ်' : 'Scan'}</span>
                </button>

                {/* Batch Text Input Trigger */}
                <button
                  type="button"
                  onClick={() => setShowBatchModal(!showBatchModal)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title="စာသားကူးထည့်ရန် (Batch Paste)"
                >
                  <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>{isMyanmar ? 'စာသားကူး' : 'Batch'}</span>
                </button>
              </div>
            </div>

            {/* Batch Text Drawer (if toggled) */}
            {showBatchModal && (
              <div className="bg-slate-50 border border-indigo-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    {isMyanmar ? 'SMS / စာသားများမှ တိုက်ရိုက်ကူးထည့်ရန် (Shallow Parser)' : 'Paste Text from SMS/Chat'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    နမူနာ: 123=1000, 456=500, 789R=1000
                  </span>
                </div>
                <textarea
                  value={rawBatchText}
                  onChange={(e) => setRawBatchText(convertMyanmarToEnglishDigits(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder={`123=1000\n456-500\n789R=1000\n555=2000`}
                  rows={4}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
                {batchErrors.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-700 space-y-1">
                    {batchErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowBatchModal(false); setBatchErrors([]); }}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-xl font-semibold cursor-pointer"
                  >
                    ပိတ်မည်
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessBatchText}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    စာရင်းထဲသို့ ထည့်သွင်းမည်
                  </button>
                </div>
              </div>
            )}

            {/* Direct Form */}
            <form onSubmit={handleAddBet} className="space-y-3.5">
              {/* 1. Number Input (Full width on top matching 2D) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMyanmar ? 'ဂဏန်း (၀၀၀-၉၉၉)' : 'Number (000-999)'}
                </label>
                <div className="relative">
                  <input
                    ref={numberInputRef}
                    type="text"
                    value={numberInput}
                    onChange={(e) => {
                      const val = convertMyanmarToEnglishDigits(e.target.value);
                      setNumberInput(val);
                      if (latestDraftIds.length > 0 && val.trim().length > 0) {
                        setLatestDraftIds([]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (numberInput.trim().length > 0) {
                          amountInputRef.current?.focus();
                          amountInputRef.current?.select();
                        }
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
                    placeholder={isMyanmar ? '၃၄၅ သို့ ၄၅၆, ၇၈၉, ၄၅၇' : '345 or 456, 789, 457'}
                    className={`w-full h-12 sm:h-13 px-4 text-center font-mono text-xl sm:text-2xl font-black rounded-xl border transition-all ${
                      isInputBlocked
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 bg-slate-50 focus:bg-white text-indigo-950'
                    }`}
                    autoFocus
                  />
                  {parsedPreviewNumbers.length === 1 && (
                    <span className="absolute right-3 top-3.5 text-emerald-600">
                      <Check className="w-5 h-5" />
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Action Buttons right below Number Input: ဒဲ့, ပတ်လည်, အပူး, ညီကို, ပါဝါ, နက္ခတ် */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {/* 0. ဒဲ့ (Straight / Direct) */}
                <button
                  type="button"
                  onClick={handleAddStraightClick}
                  className={`px-3 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                    !isRumble
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                  }`}
                  title={isMyanmar ? 'ဒဲ့ / တိုက်ရိုက်ထိုးကြေး (Straight / Direct)' : 'Direct'}
                >
                  <Check className="w-3 h-3" />
                  <span>{isMyanmar ? 'ဒဲ့' : 'Direct'}</span>
                </button>

                {/* 1. ပတ်လည် (Rumble / Permutations) */}
                <button
                  type="button"
                  onClick={handleAddRumbleClick}
                  className={`px-3 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                    isRumble
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-1 ring-indigo-500 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                  }`}
                  title={isMyanmar ? 'ပတ်လည် (R)' : 'Rumble'}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isMyanmar ? 'ပတ်လည်' : 'R'}</span>
                </button>

                {/* 2. အပူး (Triples) */}
                <button
                  type="button"
                  onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.triples, isMyanmar ? 'အပူး' : 'Triples')}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title={isMyanmar ? 'အပူး (၁၀ ကွက်)' : 'Triples'}
                >
                  <span>{isMyanmar ? 'အပူး' : 'Triples'}</span>
                </button>

                {/* 3. ညီကို (Consecutives) */}
                <button
                  type="button"
                  onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.consecutives, isMyanmar ? 'ညီကို' : 'Brothers')}
                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title={isMyanmar ? 'ညီကို (၂၀ ကွက်)' : 'Brothers'}
                >
                  <span>{isMyanmar ? 'ညီကို' : 'Brothers'}</span>
                </button>

                {/* 4. ပါဝါ (Power Pairs) */}
                <button
                  type="button"
                  onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.getPowerPairs().slice(0, 15), isMyanmar ? 'ပါဝါ' : 'Power')}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title={isMyanmar ? 'ပါဝါအတွဲများ (၁၅ ကွက်)' : 'Power'}
                >
                  <span>{isMyanmar ? 'ပါဝါ' : 'Power'}</span>
                </button>

                {/* 5. နက္ခတ် (Natkhat) */}
                <button
                  type="button"
                  onClick={() => handleAddPatternPreset(LOTTERY_PATTERNS.getNatkhatPairs().slice(0, 15), isMyanmar ? 'နက္ခတ်' : 'Natkhat')}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title={isMyanmar ? 'နက္ခတ်အတွဲများ (၁၅ ကွက်)' : 'Natkhat'}
                >
                  <span>{isMyanmar ? 'နက္ခတ်' : 'Natkhat'}</span>
                </button>
              </div>

              {/* 3. Live Preview Info Bar & Number Badges Grid (Direct preview matching 2D & user spec!) */}
              {parsedPreviewNumbers.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs font-bold text-indigo-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      <span>{isMyanmar ? 'ရွေးချယ်ထားသော ဂဏန်း:' : 'Selected:'}</span>
                      <span className="font-mono font-black text-sm text-indigo-800">
                        {parsedPreviewNumbers.length} {isMyanmar ? 'ကွက်' : 'bets'}
                      </span>
                    </div>
                    {parseFloat(amountInput) > 0 && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-indigo-600">{isMyanmar ? 'စုစုပေါင်း:' : 'Total:'}</span>
                        <span className="font-black text-sm text-slate-900">
                          {(parsedPreviewNumbers.length * parseFloat(amountInput)).toLocaleString()} {settings.currency}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Direct visual grid of parsed numbers matching user request */}
                  {parsedPreviewNumbers.length > 1 && (
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-24 overflow-y-auto">
                      {parsedPreviewNumbers.map((num, idx) => (
                        <span
                          key={`${num}-${idx}`}
                          className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-950 font-mono text-xs font-black rounded-md shadow-2xs"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Compact Amount (Left) and Add Button (Right) side-by-side matching 2D */}
              <div className="grid grid-cols-12 gap-2.5 items-center pt-1">
                {/* Amount Input */}
                <div className="col-span-7 sm:col-span-8">
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={isMyanmar ? 'ထိုးကြေးငွေ (ဥပမာ- ၁၀၀၀)' : 'Amount (e.g., 1000)'}
                      value={amountInput}
                      onChange={(e) => {
                        const val = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '');
                        setAmountInput(val);
                        if (latestDraftIds.length > 0 && val.trim().length > 0) {
                          setLatestDraftIds([]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBet();
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
                      className="w-full h-11 px-3 text-right font-mono text-base sm:text-lg font-bold rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 bg-slate-50 focus:bg-white transition-all pr-9"
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
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer shadow-indigo-700/20'
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

              {/* Real-time Warning if stock/limit is reached */}
              {currentNumberWarning && (
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium animate-pulse ${
                  currentNumberWarning.type === 'danger'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{currentNumberWarning.message}</span>
                </div>
              )}

              {/* Quick Amount Preset Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  {isMyanmar ? 'အမြန်ငွေပမာဏ ရွေးချယ်ရန်:' : 'Quick Amount Presets:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(String(amt))}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        amountInput === String(amt)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Quick Stats of Current Staged Bets */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-500 shadow-2xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>
                {isMyanmar ? 'လတ်တလော စာရင်းသွင်းထားသော ဂဏန်းအရေအတွက်:' : 'Staged Bet Count:'}
              </span>
              <span className="font-bold text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                {stagedItems.length}
              </span>
            </div>
            {stagedItems.length > 0 && (
              <div className="flex items-center gap-2">
                {latestDraftIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setLatestDraftIds([]);
                      setToastNotification({
                        type: 'success',
                        message: isMyanmar ? 'ဂဏန်းအားလုံးကို ယာယီအတည်ပြုပြီးပါပြီ' : 'Draft items confirmed'
                      });
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 transition-colors shadow-2xs active:scale-95"
                    title={isMyanmar ? 'စစ်ဆေးဆဲ ဂဏန်းများကို ယာယီအတည်ပြုမည်' : 'Confirm Drafts'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isMyanmar ? 'ယာယီအတည်' : 'Confirm'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playDeleteSound();
                    setStagedItems([]);
                    setLatestDraftIds([]);
                    setToastNotification({
                      type: 'warning',
                      message: isMyanmar ? 'စာရင်းသွင်းထားသော ဂဏန်းအားလုံးကို ဖျက်လိုက်ပါပြီ' : 'Cleared all staged items'
                    });
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  title={isMyanmar ? 'အားလုံးဖျက်မည်' : 'Clear All'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'အားလုံးဖျက်' : 'Clear'}</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Desktop Right / Mobile Top): Customer Info & Staged Voucher Invoice Review */}
        <div className="order-1 lg:order-2 lg:col-span-5 space-y-5">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col h-full justify-between space-y-5">
            
            {/* Voucher Header & Customer Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    {isMyanmar ? 'ဘောင်ချာ / ပြေစာ အချက်အလက်' : 'Slip / Voucher Details'}
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2.5 py-1 rounded-lg font-semibold">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isMyanmar ? 'ဝယ်သူအမည်' : 'Customer Name'}</span>
                  </label>
                  <input
                    type="text"
                    list="customer-suggestions"
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
                    placeholder="ဦးကျော် / မလှ"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                  />
                  <datalist id="customer-suggestions">
                    {previousCustomers.map((name, i) => (
                      <option key={i} value={name} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone (Optional)'}</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9+]*"
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
                    placeholder="09-xxxxxxx"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              {/* Staged Items List Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1 pb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{isMyanmar ? 'ထိုးဂဏန်းများ (အရောင်းစာရင်း)' : 'Bet Numbers'}</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-black rounded-full">
                      {stagedItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          if (latestDraftIds.length === 0 && stagedItems.length > 0) {
                            playTapSound();
                            setLatestDraftIds(stagedItems.map(i => i.id));
                            setToastNotification({
                              type: 'warning',
                              message: isMyanmar ? 'ဂဏန်းအားလုံးကို စစ်ဆေးဆဲအဖြစ် သတ်မှတ်ထားပါသည်' : 'Marked all as draft'
                            });
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
                            setToastNotification({
                              type: 'success',
                              message: isMyanmar ? 'စစ်ဆေးဆဲ ဂဏန်းများကို ယာယီအတည်ပြုပြီးပါပြီ' : 'Draft items confirmed'
                            });
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

                    {stagedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          playDeleteSound();
                          setStagedItems([]);
                          setLatestDraftIds([]);
                          setToastNotification({
                            type: 'warning',
                            message: isMyanmar ? 'စာရင်းသွင်းထားသော ဂဏန်းအားလုံးကို ဖျက်လိုက်ပါပြီ' : 'Cleared all items'
                          });
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer ml-1 hover:underline"
                        title={isMyanmar ? 'အားလုံးဖျက်မည်' : 'Clear All'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isMyanmar ? 'အားလုံးဖျက်' : 'Clear'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-64 overflow-y-auto space-y-1.5 p-1.5">
                  {stagedItems.length === 0 ? (
                    <div className="py-8 px-4 text-center text-slate-400 text-xs space-y-2.5">
                      <p>{isMyanmar ? 'ဂဏန်းများ ထည့်သွင်းထားခြင်း မရှိသေးပါ' : 'No numbers added to slip yet'}</p>
                      <button
                        type="button"
                        onClick={() => setIsScannerModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isMyanmar ? 'ဓါတ်ပုံစလစ် ရိုက်ထည့်ရန် နှိပ်ပါ' : 'Scan Voucher Photo'}</span>
                      </button>
                    </div>
                  ) : (
                    stagedItems.map((item, idx) => {
                      const isDraft = latestDraftIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all group ${
                            isDraft
                              ? 'bg-amber-50/95 border-2 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/30'
                              : 'bg-emerald-50/80 border border-emerald-300 text-emerald-950 shadow-2xs hover:bg-emerald-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-[11px] w-5 text-right font-bold ${isDraft ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {idx + 1}.
                            </span>
                            <span className="font-mono font-black text-slate-900 text-sm tracking-wider">
                              {item.number}
                            </span>
                            {item.isRumble && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded font-mono font-bold">
                                R
                              </span>
                            )}
                            {item.originalInput && item.originalInput !== item.number && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[90px]">
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
                            <span className="font-mono font-bold text-emerald-700 mr-1">
                              {formatAmount(item.amount, settings.currency)}
                            </span>
                            {/* Checkpoint Restart (Rule #8, #9, #10) */}
                            <button
                              type="button"
                              onClick={() => handleRestartFromCheckpoint(idx, item)}
                              className="px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-0.5"
                              title={isMyanmar ? 'ဤဂဏန်းမှ စ၍ ပြန်လည်စတင်မည် (နောက်ပိုင်းအကွက်များ ဖယ်ရှားပြီး input ထဲ ပြန်ထည့်မည်)' : 'Restart checkpoint from here'}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">{isMyanmar ? 'ပြန်စ' : 'Revert'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className={`p-1 transition-colors cursor-pointer rounded-lg ${
                                isDraft
                                  ? 'text-amber-900 hover:text-indigo-600 hover:bg-amber-200/70'
                                  : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60'
                              }`}
                              title={isMyanmar ? 'ပြင်ဆင်မည်' : 'Edit item'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
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
              </div>

              {/* Discount / Commission & Notes */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Percent className="w-3 h-3 text-slate-400" />
                    <span>{isMyanmar ? 'လျှော့ငွေ (%)' : 'Discount (%)'}</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {isMyanmar ? 'မှတ်ချက်' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ဥပမာ: KPay ပေးပြီး"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Calculations & Save Button */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {/* Financial Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{isMyanmar ? 'စုစုပေါင်း ထိုးကြေး' : 'Subtotal'}:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatAmount(subtotal, settings.currency)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>{isMyanmar ? `လျှော့ငွေ (${discountPercent}%)` : `Discount (${discountPercent}%)`}:</span>
                    <span className="font-mono font-bold">
                      -{formatAmount(discountAmount, settings.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>{isMyanmar ? 'အသားတင် ပေးချေငွေ' : 'Net Total'}:</span>
                  <span className="font-mono text-base text-emerald-700">
                    {formatAmount(netPayable, settings.currency)}
                  </span>
                </div>
              </div>

              {/* Main Submit Voucher Button */}
              <button
                type="button"
                onClick={handleSaveVoucher}
                disabled={stagedItems.length === 0 || isSavingVoucher}
                className={`w-full py-3.5 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer ${
                  stagedItems.length === 0 || isSavingVoucher
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : (!activeRound || activeRound.status !== 'open')
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {(!activeRound || activeRound.status !== 'open') ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                <span>
                  {(!activeRound || activeRound.status !== 'open')
                    ? (isMyanmar ? 'ပွဲစဉ်ပိတ်ထားသည် (စာရင်းမသွင်းပါ)' : 'Round Closed (Cannot Save)')
                    : (isMyanmar ? 'ဘောင်ချာ ထုတ်ယူမည် (Save & Print)' : 'Generate Voucher')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Photo Slip OCR Scanner Modal */}
      <ImageSlipScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onAddBetsToCart={handleAddFromScanner}
        mode="3d"
      />

      {/* Over-Limit / Dealer Forwarding Decision Modal */}
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
    </div>
  );
};
