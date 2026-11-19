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
  Lock,
  Receipt,
  User,
  Phone,
  Percent,
  BookOpen,
  Terminal,
  FileText,
  Clock,
  Send,
  XCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDBetItem, TwoDVoucher, OverLimitItemInfo, OverLimitAction, TwoDNumberAggregate, TwoDQuickActionButtonsConfig, TwoDQuickButtonItem } from '../../types';
import { DEFAULT_2D_ACTION_BUTTONS, DEFAULT_2D_CUSTOM_BUTTONS } from '../../utils/storage';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import { getTelegramOrders } from '../../utils/telegramIntegration';
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
import {
  saveRawClip,
  compressImageForArchive,
  StagedRawSource,
  pruneStagedRawSources,
  retainStagedRawSources,
  buildClipPayloadFromStagedSources
} from '../../utils/rawClipsUtils';
import { OverLimitConfirmModal } from '../OverLimitConfirmModal';
import { InlinePhotoScanWorkspace } from '../InlinePhotoScanWorkspace';
import {
  playTapSound,
  playAddSound,
  playSuccessSound,
  playWarningSound,
  playDeleteSound
} from '../../utils/audioUtils';
import { generateUUID } from '../../utils/restorePoints';

interface TwoDQuickSaleEntryProps {
  onVoucherCreated: (voucher: TwoDVoucher) => void;
  onOpenForwardModal?: (num?: string, amt?: number) => void;
  onOpenLimitsManager?: (num?: string) => void;
  onOpenRoundManager?: () => void;
  onOpenCommandRules?: () => void;
  onOpenRawClipsModal?: () => void;
  onOpenTelegramHub?: () => void;
}

export const TwoDQuickSaleEntry: React.FC<TwoDQuickSaleEntryProps> = ({
  onVoucherCreated,
  onOpenForwardModal,
  onOpenLimitsManager,
  onOpenRoundManager,
  onOpenCommandRules,
  onOpenRawClipsModal,
  onOpenTelegramHub
}) => {
  const {
    settings,
    activeRound,
    addVoucher,
    addForwardSlip,
    aggregates,
    limits,
    isNumberBlocked,
    getNumberLimit,
    vouchers
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0) /* no discounts */;
  const [notes, setNotes] = useState('');

  // Single Bet Input
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [isRumble, setIsRumble] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitTimeRef = useRef(0);

  // Cart / Pending Bet Items
  const [items, setItems] = useState<TwoDBetItem[]>([]);
  const [stagedRawSources, setStagedRawSources] = useState<StagedRawSource[]>([]);
  // Tracking unconfirmed/active draft items (Yellow) vs confirmed staged items (Green)
  const [latestDraftIds, setLatestDraftIds] = useState<string[]>([]);

  // Batch text entry modal
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchDefaultAmount, setBatchDefaultAmount] = useState('1000');

  // Real-time Telegram Order status counts (Pending vs Approved vs Rejected)
  const [telegramCounts, setTelegramCounts] = useState<{ pending: number; approved: number; rejected: number }>({
    pending: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    const updateTelegramStatus = () => {
      try {
        const orders = getTelegramOrders();
        const pending = orders.filter(o => o.status === 'pending_review').length;
        const approved = orders.filter(o => o.status === 'approved').length;
        const rejected = orders.filter(o => o.status === 'rejected').length;
        setTelegramCounts({ pending, approved, rejected });
      } catch {
        // ignore fallback
      }
    };
    updateTelegramStatus();
    const interval = setInterval(updateTelegramStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Over-limit Decision Modal
  const [isOverLimitModalOpen, setIsOverLimitModalOpen] = useState(false);
  const [pendingOverLimitItems, setPendingOverLimitItems] = useState<OverLimitItemInfo[]>([]);

  // Pattern shortcut menu dropdown
  const [isPatternOpen, setIsPatternOpen] = useState(false);

  // Toast notification
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Inline Photo Scan Workspace state (visible directly on bet entry screen)
  const [isPhotoWorkspaceOpen, setIsPhotoWorkspaceOpen] = useState(false);
  const [workspacePhotoSrc, setWorkspacePhotoSrc] = useState<string | null>(null);
  const [workspaceRawText, setWorkspaceRawText] = useState('');
  const [workspaceCustomerName, setWorkspaceCustomerName] = useState('');
  const [scanTriggerNonce, setScanTriggerNonce] = useState(0);
  const compressedWorkspacePhotoRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!workspacePhotoSrc) {
      compressedWorkspacePhotoRef.current = null;
      return;
    }
    compressImageForArchive(workspacePhotoSrc).then((compressed) => {
      if (!cancelled) {
        compressedWorkspacePhotoRef.current = compressed;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspacePhotoSrc]);

  // Instant Ctrl+V image paste support right on the 2D bet entry screen
  useEffect(() => {
    const handleGlobalImagePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const blob = clipboardItems[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                setWorkspacePhotoSrc(ev.target.result as string);
                setIsPhotoWorkspaceOpen(true);
                setScanTriggerNonce((n) => n + 1);
              }
            };
            reader.readAsDataURL(blob);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', handleGlobalImagePaste);
    return () => window.removeEventListener('paste', handleGlobalImagePaste);
  }, []);

  const handleApplyInlineScannedText = async (
    editedText: string,
    fullImageSrc: string | null,
    detectedCustomer?: string
  ) => {
    const cleanText = editedText.trim();
    if (!cleanText) return;

    const defAmt = parseFloat(batchDefaultAmount) || 1000;
    const result = parseTwoDBatchInput(cleanText, defAmt);
    const parsed: TwoDBetItem[] = Array.isArray(result) ? result : (result as any).items;
    const warnings: string[] = (result as any).warnings || [];

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

    const addedIds = allowed.map((i: TwoDBetItem) => i.id);
    playAddSound();
    setItems(prev => [...prev, ...allowed]);
    setLatestDraftIds(addedIds);

    const compressedPhoto = fullImageSrc
      ? (compressedWorkspacePhotoRef.current || await compressImageForArchive(fullImageSrc))
      : undefined;

    setStagedRawSources(prev => [
      ...prev,
      {
        id: `src-${generateUUID()}`,
        source: compressedPhoto ? 'ocr' : 'batch_paste',
        rawText: cleanText,
        imageDataUrl: compressedPhoto,
        itemIds: addedIds
      }
    ]);

    if (detectedCustomer && !customerName) {
      setCustomerName(detectedCustomer);
    }

    showToast(
      isMyanmar
        ? `ဂဏန်း ${allowed.length} ကွက် ဘောင်ချာထဲ ထည့်သွင်းပြီးပါပြီ (ဘောင်ချာအတည်ပြုပါက မူရင်းဓာတ်ပုံကို Archive ထဲသိမ်းပေးမည်)`
        : `Added ${allowed.length} bets to voucher cart`,
      'success'
    );
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

  // Unique customer names list for auto-complete (matching 3D)
  const previousCustomers = useMemo(() => {
    const names = new Set<string>();
    vouchers.forEach(v => {
      if (v.customerName && v.customerName !== 'အထွေထွေ' && v.customerName !== 'အထွေထွေ (General)') {
        names.add(v.customerName);
      }
    });
    return Array.from(names);
  }, [vouchers]);

  // Quick Action Buttons visibility & active status config
  const enabledButtons = useMemo<TwoDQuickActionButtonsConfig>(() => {
    return {
      ...DEFAULT_2D_ACTION_BUTTONS,
      ...(settings.quickActionButtons || {})
    };
  }, [settings.quickActionButtons]);

  // Active 2D Customizable Quick Bet Buttons
  const active2DButtons = useMemo<TwoDQuickButtonItem[]>(() => {
    const list = settings.custom2DButtons && settings.custom2DButtons.length > 0
      ? settings.custom2DButtons
      : DEFAULT_2D_CUSTOM_BUTTONS;
    return list.filter(b => b.isEnabled);
  }, [settings.custom2DButtons]);

  const hasAnyButtonVisible = useMemo(() => {
    return active2DButtons.length > 0 || Object.values(enabledButtons).some(Boolean);
  }, [active2DButtons, enabledButtons]);

  // Real-time preview of numbers from numberInput
  const parsedPreviewNumbers = useMemo<string[]>(() => {
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

    // Check if user typed special pattern keywords (Break '3b300', '3b400', '3b', '3ဘရိတ်', Head/Tail '4 ထိပ် 500 ပိတ် 200', Multi-command, etc.)
    const isSpecialPattern = /[bB]|ဘရိတ်|ထိပ်|ပိတ်|h|t|အပါ|\bပါ\b|စုံစုံ|မမ|စုံမ|မစုံ|ပါဝါ|နက္ခတ်|ညီကို/i.test(rawInput) ||
                            (/\s{2,}/.test(rawInput)) ||
                            (/(?:r|R|အာ|ပတ်လည်|ပတ်)/i.test(rawInput) && /\d{2}\s+\d{2}/.test(rawInput));
    if (isSpecialPattern) {
      const defAmt = parseFloat(amountInput) || 1000;
      const parsedRes = parseTwoDBatchInput(rawInput, defAmt);
      const list = Array.isArray(parsedRes) ? parsedRes : (parsedRes as any).items;
      if (list && list.length > 0) {
        return Array.from(new Set<string>(list.map((it: any) => String(it.number))));
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
  }, [numberInput, isRumble, enabledButtons, amountInput]);

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
            id: `item-${generateUUID()}`,
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
        const newIds = newItems.map(i => i.id);
        const khwayTypedLine = khwayInlineAmt ? rawInput : `${rawInput}=${targetAmt}`;
        setItems((prev) => [...prev, ...newItems]);
        setLatestDraftIds(newIds);
        setStagedRawSources(prev => [
          ...prev,
          {
            id: `src-${generateUUID()}`,
            source: 'manual',
            rawText: khwayTypedLine,
            itemIds: newIds
          }
        ]);
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

    // Direct pattern syntax support (Break '3b300', '3b400', '3b', '3ဘရိတ် 300', Head/Tail '4 ထိပ် 500 ပိတ် 200', multi-rumble '45 67 78 65r500', multi-clauses)
    const isSpecialPattern = /[bB]|ဘရိတ်|ထိပ်|ပိတ်|အပါ|\bပါ\b|စုံစုံ|မမ|စုံမ|မစုံ|ပါဝါ|နက္ခတ်|ညီကို/.test(rawInput) ||
                            (/\s{2,}/.test(rawInput)) ||
                            (/(?:r|R|အာ|ပတ်လည်|ပတ်)/i.test(rawInput) && /\d{2}\s+\d{2}/.test(rawInput)) ||
                            (/\d{1,2}\s*\/\s*\d{1,2}/.test(rawInput));

    if (isSpecialPattern) {
      const defAmt = parseFloat(convertMyanmarToEnglishDigits(amountInput).trim()) || 1000;
      const parsedRes = parseTwoDBatchInput(rawInput, defAmt);
      const parsedList = Array.isArray(parsedRes) ? parsedRes : (parsedRes as any).items;

      if (parsedList && parsedList.length > 0) {
        const newItems: TwoDBetItem[] = [];
        const blockedFound: string[] = [];

        parsedList.forEach((it: any) => {
          if (isNumberBlocked(it.number)) {
            blockedFound.push(it.number);
          } else {
            newItems.push({
              id: `item-${generateUUID()}`,
              number: it.number,
              amount: it.amount || defAmt,
              isRumble: it.isRumble,
              betType: it.betType || 'straight',
              groupId: it.groupId,
              originalNumber: it.originalNumber,
              originalAmount: it.originalAmount,
              permutations: it.permutations,
              originalInput: it.originalInput || it.number
            });
          }
        });

        if (blockedFound.length > 0) {
          playWarningSound();
          showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${Array.from(new Set(blockedFound)).join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers`, 'warning');
        }

        if (newItems.length > 0) {
          playAddSound();
          const newIds = newItems.map(i => i.id);
          const hasAmountInsideInput = /\d{2,}$/.test(rawInput) && !/\b\d{2}$/.test(rawInput.trim());
          const patternTypedLine = (hasAmountInsideInput || !amountInput.trim())
            ? rawInput
            : `${rawInput}=${defAmt}`;
          setItems((prev) => [...prev, ...newItems]);
          setLatestDraftIds(newIds);
          setStagedRawSources(prev => [
            ...prev,
            {
              id: `src-${generateUUID()}`,
              source: 'manual',
              rawText: patternTypedLine,
              itemIds: newIds
            }
          ]);
          setNumberInput('');
          setAmountInput('');
          setIsRumble(false);
          numberInputRef.current?.focus();

          const totalAmt = newItems.reduce((sum, it) => sum + it.amount, 0);
          showToast(
            isMyanmar ? `ဂဏန်း [${newItems.length} ကွက်] ${formatAmount(totalAmt, settings.currency)} စာရင်းသွင်းပြီးပါပြီ` : `Added ${newItems.length} bets (${formatAmount(totalAmt, settings.currency)})`,
            'success'
          );
        }
        return;
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
    let usedInlineAmount = false;

    // Check if amount is specified inline (e.g. "22,33,22,44, 500" or "၁၃,၂၄,၃၆,၄၆,၂၇,၈၄, ၁၀၀၀")
    if (isNaN(amt) || amt <= 0) {
      if (rawTokens.length > 1) {
        const lastToken = rawTokens[rawTokens.length - 1];
        const parsedLast = parseFloat(lastToken);
        if (!isNaN(parsedLast) && parsedLast > 0) {
          amt = parsedLast;
          rawTokens.pop();
          usedInlineAmount = true;
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
            usedInlineAmount = true;
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
        const groupId = `r2d-${generateUUID()}`;
        revs.forEach(r => {
          if (isNumberBlocked(r)) {
            blockedFound.push(r);
          } else {
            newItems.push({
              id: `item-${generateUUID()}`,
              number: r,
              amount: amt,
              isRumble: true,
              betType: 'rumble',
              groupId,
              originalNumber: cleanNum,
              originalAmount: amt,
              permutations: revs,
              originalInput: `${cleanNum} R`
            });
          }
        });
      } else {
        if (isNumberBlocked(cleanNum)) {
          blockedFound.push(cleanNum);
        } else {
          newItems.push({
            id: `item-${generateUUID()}`,
            number: cleanNum,
            amount: amt,
            isRumble: false,
            betType: 'straight',
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
      const newIds = newItems.map(i => i.id);
      const rSuffix = isRumble && !hasRInInput && !hasStraightKeyword ? ' R' : '';
      const manualTypedLine = usedInlineAmount
        ? `${rawInput}${rSuffix}`
        : `${rawInput}${rSuffix}=${amt}`;
      setItems(prev => [...prev, ...newItems]);
      setLatestDraftIds(newIds);
      setStagedRawSources(prev => [
        ...prev,
        {
          id: `src-${generateUUID()}`,
          source: 'manual',
          rawText: manualTypedLine,
          itemIds: newIds
        }
      ]);
      
      const displayNum = targetNumbers.length === 1 ? targetNumbers[0] : `${targetNumbers[0]} (${targetNumbers.length} ကွက်)`;
      const typeName = effectiveRumble ? (isMyanmar ? 'အာ' : 'R') : (isMyanmar ? 'ဒဲ့' : 'Direct');
      const totalEnteredAmt = amt * newItems.length;

      setNumberInput('');
      setAmountInput('');
      setIsRumble(false);
      numberInputRef.current?.focus();
      showToast(
        isMyanmar
          ? `ဂဏန်း [${displayNum}] (${typeName}) ${formatAmount(totalEnteredAmt, settings.currency)} ထည့်ပြီးပါပြီ`
          : `Added ${newItems.length} items to voucher`,
        'success'
      );
    }
  };

  // 0. ဒဲ့ (Straight / Direct - တိုက်ရိုက်ဂဏန်းများ ဂဏန်းကွက်ထဲ ထည့်သွင်းခြင်း)
  const handleAddStraightClick = () => {
    playTapSound();
    setIsRumble(false);
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (cleanNum) {
      const cleanForNumbers = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
      const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
      const targetNumbers = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));
      if (targetNumbers.length > 0) {
        setNumberInput(targetNumbers.join(' '));
        amountInputRef.current?.focus();
        showToast(
          isMyanmar ? `ဒဲ့ [${targetNumbers.join(' ')}] (${targetNumbers.length} ကွက်) ဂဏန်းကွက်ထဲ ထည့်သွင်းပြီးပါပြီ။ ထိုးကြေးထည့်ပါ` : `Direct: ${targetNumbers.length} numbers selected.`,
          'success'
        );
      } else {
        amountInputRef.current?.focus();
        showToast(isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်) ရွေးထားပါသည်' : 'Direct mode active.', 'success');
      }
    } else {
      numberInputRef.current?.focus();
      showToast(isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်) အတွက် ဂဏန်း ရိုက်ထည့်ပါ' : 'Enter number for direct bet', 'warning');
    }
  };

  // 1. Rumble/Reversal (အာ: e.g. 24 -> 24 42 အပြန်အလှန်ဂဏန်းအားလုံး ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာခြင်း)
  const handleAddRumbleClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!cleanNum) {
      playWarningSound();
      showToast(isMyanmar ? 'အာ (R) အတွက် ဂဏန်း ရိုက်ထည့်ပါ (ဥပမာ- ၂၄)' : 'Enter number to reverse (e.g. 24)', 'warning');
      numberInputRef.current?.focus();
      return;
    }

    const cleanForNumbers = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
    const targetNumbers = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      showToast(isMyanmar ? 'အာ (R) အတွက် ၂ လုံးဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ထည့်ပါ' : 'Enter valid 2-digit number (00-99)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const reversedList: string[] = [];
    targetNumbers.forEach(n => {
      const revs = getTwoDReversal(n);
      revs.forEach(r => {
        if (!reversedList.includes(r)) {
          reversedList.push(r);
        }
      });
    });

    setNumberInput(reversedList.join(' '));
    setIsRumble(false);
    amountInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `အာ [${reversedList.join(' ')}] (${reversedList.length} ကွက်) ဂဏန်းကွက်ထဲ ထည့်သွင်းပြီးပါပြီ။ ထိုးကြေးထည့်ပါ`
        : `Rumble: [${reversedList.join(' ')}] (${reversedList.length} numbers). Enter amount.`,
      'success'
    );
  };

  // 1. Rumble/Reversal (အာ: e.g. 24 -> fills "24" in number box, isRumble ON)
  const handleEditItem = (item: TwoDBetItem) => {
    playTapSound();
    const origNum = item.originalNumber || item.number;
    const origAmt = item.originalAmount || item.amount;
    const isR = item.isRumble || false;

    setNumberInput(origNum);
    setAmountInput(String(origAmt));
    setIsRumble(isR);

    // If item is part of a Rumble group, remove the entire group to avoid leaving orphaned permutations
    if (item.groupId) {
      const gId = item.groupId;
      const removedIds = new Set(items.filter(i => i.groupId === gId).map(i => i.id));
      setItems(prev => prev.filter(i => i.groupId !== gId));
      setLatestDraftIds(prev => prev.filter(id => !removedIds.has(id)));
      setStagedRawSources(prev => pruneStagedRawSources(prev, removedIds));
    } else {
      setItems(prev => prev.filter(i => i.id !== item.id));
      setLatestDraftIds(prev => prev.filter(id => id !== item.id));
      setStagedRawSources(prev => pruneStagedRawSources(prev, new Set([item.id])));
    }

    numberInputRef.current?.focus();
    showToast(isMyanmar ? `ဂဏန်း [${origNum}] အား ပြင်ဆင်ရန် အောက်ပါအကွက်တွင် ဖြည့်သွင်းထားပါသည်` : `Editing item [${origNum}]`, 'warning');
  };

  // Restart / Rollback from a specific Checkpoint item (Rule #8, #9, #10)
  const handleRestartFromCheckpoint = (index: number, item: TwoDBetItem) => {
    playTapSound();
    let preservedItems: TwoDBetItem[];
    if (item.groupId) {
      const firstGroupIdx = items.findIndex(i => i.groupId === item.groupId);
      preservedItems = items.slice(0, firstGroupIdx >= 0 ? firstGroupIdx : index);
    } else {
      preservedItems = items.slice(0, index);
    }

    setItems(preservedItems);
    setStagedRawSources(prev => retainStagedRawSources(prev, new Set(preservedItems.map(i => i.id))));
    setLatestDraftIds([]);
    setNumberInput(item.originalNumber || item.number);
    setAmountInput(String(item.originalAmount || item.amount));
    setIsRumble(item.isRumble || false);
    numberInputRef.current?.focus();
    showToast(
      isMyanmar
        ? `ဂဏန်း [${item.originalNumber || item.number}] မှ ပြန်လည်စတင်ရန် Input Box ထဲ ပြန်ထည့်ပေးထားပြီး ယခင် Checkpoint အထိ အပြည့်အဝ ထိန်းသိမ်းထားပါသည်`
        : `Restarted from checkpoint [${item.originalNumber || item.number}]`,
      'warning'
    );
  };

  // Remove Item Helper (removes entire rumble group if part of a group)
  const handleRemoveItem = (id: string) => {
    playDeleteSound();
    const target = items.find(i => i.id === id);
    if (target?.groupId) {
      const gId = target.groupId;
      const removedIds = new Set(items.filter(i => i.groupId === gId).map(i => i.id));
      setItems(prev => prev.filter(item => item.groupId !== gId));
      setLatestDraftIds(prev => prev.filter(item => !removedIds.has(item)));
      setStagedRawSources(prev => pruneStagedRawSources(prev, removedIds));
    } else {
      setItems(prev => prev.filter(item => item.id !== id));
      setLatestDraftIds(prev => prev.filter(item => item !== id));
      setStagedRawSources(prev => pruneStagedRawSources(prev, new Set([id])));
    }
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

  const handleCustomButtonClick = (btn: TwoDQuickButtonItem) => {
    if (btn.actionType === 'straight') {
      handleAddStraightClick();
      return;
    }
    if (btn.actionType === 'rumble') {
      handleAddRumbleClick();
      return;
    }
    if (btn.actionType === 'break') {
      handleAddBreakDigit();
      return;
    }
    if (btn.actionType === 'includes') {
      handleAddIncludesDigit();
      return;
    }
    if (btn.actionType === 'head') {
      handleAddHeadDigit();
      return;
    }
    if (btn.actionType === 'tail') {
      handleAddTailDigit();
      return;
    }
    if (btn.actionType === 'khway') {
      handleAddKhwayClick();
      return;
    }
    if (btn.actionType === 'khwayPuu') {
      handleAddKhwayPuuClick();
      return;
    }
    if (btn.actionType === 'khwayRumble') {
      handleAddKhwayRumbleClick();
      return;
    }
    if (btn.actionType === 'khwayPuuRumble') {
      handleAddKhwayPuuRumbleClick();
      return;
    }
    if (btn.customNumbers && btn.customNumbers.length > 0) {
      handleAddPattern(btn.customNumbers, btn.nameMyanmar || btn.label);
      return;
    }
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

    const originalBatchText = batchText.trim();
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

    const addedIds = allowed.map((i: TwoDBetItem) => i.id);
    playAddSound();
    setItems(prev => [...prev, ...allowed]);
    setLatestDraftIds(addedIds);
    if (originalBatchText) {
      setStagedRawSources(prev => [
        ...prev,
        {
          id: `src-${generateUUID()}`,
          source: 'batch_paste',
          rawText: originalBatchText,
          itemIds: addedIds
        }
      ]);
    }
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
    const itemSums = new Map<string, number>();
    items.forEach(i => {
      itemSums.set(i.number, (itemSums.get(i.number) || 0) + i.amount);
    });

    let hasOverLimit = false;
    itemSums.forEach((addedAmt, num) => {
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
          ? 'ဘောင်ချာ သိမ်းဆည်းပြီးပါပြီ'
          : 'Voucher saved successfully.',
        'success'
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
      customerName: customerName.trim() || 'အထွေထွေ',
      items: finalItems.map(i => ({
        number: i.number,
        amount: i.amount,
        betType: i.isRumble ? 'rumble' : 'straight',
        groupId: i.groupId,
        originalNumber: i.originalNumber,
        originalAmount: i.originalAmount,
        permutations: i.permutations
      })),
      subtotal: sub,
      discountPercent,
      discountAmount: disc,
      netPayable: net,
      notes: notes.trim() || undefined,
      isPaid: true,
      status: 'active'
    });

    const clipPayload = buildClipPayloadFromStagedSources(
      stagedRawSources,
      new Set(finalItems.map(i => i.id)),
      finalItems
    );
    const resolvedPhotoForArchive = clipPayload.imageDataUrl || compressedWorkspacePhotoRef.current || undefined;
    const resolvedImageUrls = clipPayload.imageUrls && clipPayload.imageUrls.length > 0
      ? clipPayload.imageUrls
      : (resolvedPhotoForArchive ? [resolvedPhotoForArchive] : undefined);
    const resolvedRawTextForArchive = clipPayload.rawText || workspaceRawText.trim();

    saveRawClip({
      category: '2d',
      roundId: activeRound.id,
      roundName: activeRound.name || `${activeRound.drawDate || '2D'} (2D)`,
      date: activeRound.drawDate || new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      voucherNumber: voucher.voucherNo || `ဘောင်ချာ (2D)`,
      customerName: voucher.customerName || customerName.trim() || 'အထွေထွေ',
      customerPhone: voucher.customerPhone || customerPhone || undefined,
      rawText: resolvedRawTextForArchive,
      imageDataUrl: resolvedPhotoForArchive,
      imageUrls: resolvedImageUrls,
      itemCount: finalItems.length,
      totalAmountPreview: sub,
      source: resolvedPhotoForArchive ? 'ocr' : clipPayload.source
    });

    const isDup = (voucher as any)?.isDuplicate;

    // If there are forwarded items, create forward slip (only if not duplicate)
    if (!isDup && forwardItems && forwardItems.length > 0) {
      const fwdTotal = forwardItems.reduce((a, b) => a + b.amount, 0);
      const commRate = forwardCommission ?? settings.defaultCommissionRate;
      const commAmt = Math.round((fwdTotal * commRate) / 100);
      const netPaid = fwdTotal - commAmt;

      const resolvedAgent = (masterAgentName || settings.defaultMasterAgentName || '').trim();
      if (!resolvedAgent) {
        showToast('ဒိုင်ချုပ်အမည် သတ်မှတ်ပါ', 'error');
        return;
      }

      addForwardSlip({
        roundId: activeRound.id,
        masterAgentName: resolvedAgent,
        masterAgentPhone: (masterAgentPhone || settings.defaultMasterAgentPhone || '').trim(),
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

    // Reset Form & Inline Photo Workspace after Voucher Confirmation
    setItems([]);
    setStagedRawSources([]);
    setLatestDraftIds([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setDiscountPercent(0);
    setWorkspacePhotoSrc(null);
    setWorkspaceRawText('');
    setWorkspaceCustomerName('');
    setIsPhotoWorkspaceOpen(false);
    compressedWorkspacePhotoRef.current = null;

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

    // Iterate items directly in exact chronological entry order (never auto-sort via plain object keys)
    const decisionMap = new Map<string, OverLimitItemInfo>();
    decisions.forEach(d => decisionMap.set(d.number, d));
    const remQuotaMap = new Map<string, number>();

    items.forEach(it => {
      const dec = decisionMap.get(it.number);

      if (!dec) {
        keptItems.push(it);
        return;
      }

      if (dec.action === 'reject') {
        return;
      } else if (dec.action === 'accept_locally') {
        keptItems.push(it);
      } else if (dec.action === 'forward_all') {
        forwardList.push({ number: it.number, amount: it.amount });
      } else if (dec.action === 'cap_at_limit') {
        const remQuota = remQuotaMap.has(it.number) ? remQuotaMap.get(it.number)! : dec.remainingQuota;
        const retainAmt = Math.min(it.amount, remQuota);
        remQuotaMap.set(it.number, remQuota - retainAmt);
        if (retainAmt > 0) {
          keptItems.push({ ...it, amount: retainAmt });
        }
      } else if (dec.action === 'forward_excess') {
        const remQuota = remQuotaMap.has(it.number) ? remQuotaMap.get(it.number)! : dec.remainingQuota;
        const retainAmt = Math.min(it.amount, remQuota);
        const forwardAmt = it.amount - retainAmt;
        remQuotaMap.set(it.number, remQuota - retainAmt);
        if (retainAmt > 0) {
          keptItems.push({ ...it, amount: retainAmt });
        }
        if (forwardAmt > 0) {
          forwardList.push({ number: it.number, amount: forwardAmt });
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

      {/* Telegram Incoming Orders Status Indicators Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
            <Send className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
              <span>{isMyanmar ? 'Telegram အမှာစာများ အခြေအနေ' : 'Telegram Orders Status'}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {isMyanmar ? 'စောင့်ဆိုင်းဆဲ / အတည်ပြုပြီး အမှာစာ စာရင်းများ' : 'Live Telegram order monitoring'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Pending Orders Badge */}
          <button
            type="button"
            onClick={() => onOpenTelegramHub?.()}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              telegramCounts.pending > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300/60 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
            title={isMyanmar ? 'စောင့်ဆိုင်းဆဲ အမှာစာများ ကြည့်ရန်' : 'View Pending Orders'}
          >
            <Clock className="w-3.5 h-3.5 text-amber-200" />
            <span>{isMyanmar ? 'စောင့်ဆိုင်းဆဲ' : 'Pending'}: {telegramCounts.pending}</span>
          </button>

          {/* Approved Orders Badge */}
          <button
            type="button"
            onClick={() => onOpenTelegramHub?.()}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              telegramCounts.approved > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
            title={isMyanmar ? 'အတည်ပြုပြီး အမှာစာများ ကြည့်ရန်' : 'View Approved Orders'}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>{isMyanmar ? 'အတည်ပြုပြီး' : 'Approved'}: {telegramCounts.approved}</span>
          </button>

          {/* Rejected Orders Badge */}
          {telegramCounts.rejected > 0 && (
            <button
              type="button"
              onClick={() => onOpenTelegramHub?.()}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title={isMyanmar ? 'ပယ်ဖျက်ပြီး အမှာစာများ ကြည့်ရန်' : 'View Rejected Orders'}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-200" />
              <span>{isMyanmar ? 'ပယ်ဖျက်ပြီး' : 'Rejected'}: {telegramCounts.rejected}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Photo Scan & Editable Copied Text Workspace right on the Bet Entry screen */}
      <InlinePhotoScanWorkspace
        isOpen={isPhotoWorkspaceOpen}
        onClose={() => setIsPhotoWorkspaceOpen(false)}
        mode="2d"
        isMyanmar={isMyanmar}
        currency={settings.currency}
        defaultAmount={parseFloat(batchDefaultAmount) || 1000}
        activeImageSrc={workspacePhotoSrc}
        onImageChange={(src) => {
          setWorkspacePhotoSrc(src);
          if (src) setScanTriggerNonce((n) => n + 1);
        }}
        rawText={workspaceRawText}
        onRawTextChange={setWorkspaceRawText}
        detectedCustomerName={workspaceCustomerName}
        onDetectedCustomerNameChange={setWorkspaceCustomerName}
        onApplyCustomerNameToVoucher={(name) => setCustomerName(name)}
        onApplyParsedText={handleApplyInlineScannedText}
        scanTriggerNonce={scanTriggerNonce}
      />

      {/* Main Grid: Input Form & Cart (On Mobile/Tablet, Voucher Draft on Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Desktop Left / Mobile Bottom): Quick Entry Pad & Helpers (7 cols) */}
        <div className="order-2 lg:order-2 lg:col-span-7 space-y-5">
          {/* Main Keypad / Input Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            {/* Box Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900">
                    {isMyanmar ? 'အမြန်သွင်း' : 'Fast Entry'}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPhotoWorkspaceOpen(prev => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-transform active:scale-95 shadow-2xs cursor-pointer whitespace-nowrap"
                  title="ဓါတ်ပုံ / စလစ်ထဲမှ ဂဏန်းများကို အလိုအလျောက် ဖတ်ယူရန်"
                >
                  <Camera className="w-3 h-3 shrink-0" />
                  <span>{isMyanmar ? 'စကင်ဖတ်' : 'Scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-teal-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title="စာသားကူးထည့်ရန် (Batch Paste)"
                >
                  <FileText className="w-3 h-3 text-teal-500 shrink-0" />
                  <span>{isMyanmar ? 'စာသားကူး' : 'Batch'}</span>
                </button>
              </div>
            </div>

            {/* Direct Form */}
            <form onSubmit={handleAddItem} className="space-y-3.5">
              {/* 1. Number Input (Full width on top matching 3D) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMyanmar ? 'ဂဏန်း (၀၀-၉၉)' : 'Number (00-99)'}
                </label>
                <div className="relative">
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
                    className={`w-full h-12 sm:h-13 px-4 text-center font-mono text-xl sm:text-2xl font-black rounded-xl border transition-all ${
                      isInputBlocked
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white text-slate-900'
                    }`}
                    autoFocus
                  />
                  {parsedPreviewNumbers.length === 1 && !isInputBlocked && (
                    <span className="absolute right-3 top-3.5 text-emerald-600">
                      <Check className="w-5 h-5" />
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Action Buttons right below Number Input: Configured by Owner in Settings */}
              {hasAnyButtonVisible && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {active2DButtons.map((btn) => {
                    if (btn.actionType === 'straight') {
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={handleAddStraightClick}
                          className={`px-3 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                            !isRumble
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                          }`}
                          title={btn.desc}
                        >
                          <Check className="w-3 h-3" />
                          <span>{btn.label}</span>
                        </button>
                      );
                    }
                    if (btn.actionType === 'rumble') {
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={handleAddRumbleClick}
                          className={`px-3 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                            isRumble
                              ? 'bg-teal-600 hover:bg-teal-700 text-white ring-1 ring-teal-500 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                          }`}
                          title={btn.desc}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{btn.label}</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleCustomButtonClick(btn)}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                        title={btn.desc}
                      >
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. Live Preview Info Bar & Number Badges Grid (matching 3D) */}
              {parsedPreviewNumbers.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-teal-50/90 border border-teal-200/90 rounded-xl text-xs font-bold text-teal-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                      <span>{isMyanmar ? 'ရွေးချယ်ထားသော ဂဏန်း:' : 'Selected:'}</span>
                      <span className="font-mono font-black text-sm text-teal-800">
                        {parsedPreviewNumbers.length} {isMyanmar ? 'ကွက်' : 'bets'}
                      </span>
                    </div>
                    {parseFloat(amountInput) > 0 && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-teal-600">{isMyanmar ? 'စုစုပေါင်း:' : 'Total:'}</span>
                        <span className="font-black text-sm text-slate-900">
                          {(parsedPreviewNumbers.length * parseFloat(amountInput)).toLocaleString()} {settings.currency}
                        </span>
                      </div>
                    )}
                  </div>

                  {parsedPreviewNumbers.length > 1 && (
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-24 overflow-y-auto">
                      {parsedPreviewNumbers.map((num, idx) => (
                        <span
                          key={`${num}-${idx}`}
                          className="px-2 py-0.5 bg-white border border-teal-200 text-teal-950 font-mono text-xs font-black rounded-md shadow-2xs"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Compact Amount (Left) and Add Button (Right) side-by-side matching 3D */}
              <div className="grid grid-cols-12 gap-2.5 items-center pt-1">
                {/* Amount Input */}
                <div className="col-span-7 sm:col-span-8">
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={isMyanmar ? 'ထိုးကြေးငွေ (ဥပမာ- ၅၀၀)' : 'Amount (e.g., 500)'}
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
                          handleAddItem();
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

              {/* Blocked Number Warning */}
              {isInputBlocked && (
                <div className="p-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-medium animate-pulse">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {isMyanmar
                      ? `ဂဏန်း [${numberInput}] အား ဒိုင်ကာဂဏန်းအဖြစ် သတ်မှတ်ထားသဖြင့် စာရင်းထဲသို့ ထည့်သွင်းခွင့် မပြုပါ`
                      : `Number [${numberInput}] is strictly blocked by dealer.`}
                  </span>
                </div>
              )}

              {/* Quick Amount Preset Chips (matching 3D layout) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  {isMyanmar ? 'အမြန်ငွေပမာဏ ရွေးချယ်ရန်:' : 'Quick Amount Presets:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '၂၅၀', value: 250 },
                    { label: '၅၀၀', value: 500 },
                    { label: '1,000', value: 1000 },
                    { label: '2,000', value: 2000 },
                    { label: '3,000', value: 3000 },
                    { label: '5,000', value: 5000 },
                    { label: '10,000', value: 10000 }
                  ].map(chip => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setAmountInput(String(chip.value));
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        amountInput === String(chip.value)
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Quick Stats of Current Staged Bets (matching 3D) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-500 shadow-2xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>
                {isMyanmar ? 'လတ်တလော စာရင်းသွင်းထားသော ဂဏန်းအရေအတွက်:' : 'Staged Bet Count:'}
              </span>
              <span className="font-bold text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                {items.length}
              </span>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-2">
                {latestDraftIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setLatestDraftIds([]);
                      showToast(isMyanmar ? 'ဂဏန်းအားလုံးကို ယာယီအတည်ပြုပြီးပါပြီ' : 'Draft items confirmed', 'success');
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
                    setItems([]);
                    setStagedRawSources([]);
                    setLatestDraftIds([]);
                    showToast(isMyanmar ? 'စာရင်းသွင်းထားသော ဂဏန်းအားလုံးကို ဖျက်လိုက်ပါပြီ' : 'Cleared all staged items', 'warning');
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

        {/* Right Column (Desktop Right / Mobile Top): Customer Info & Staged Voucher Invoice Review (matching 3D) */}
        <div className="order-1 lg:order-1 lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col h-full justify-between space-y-5">
            {/* Voucher Header & Customer Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    {isMyanmar ? 'ဘောင်ချာ / ပြေစာ အချက်အလက်' : 'Slip / Voucher Details'}
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2.5 py-1 rounded-lg font-semibold">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Customer Name & Phone (matching 3D location & layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isMyanmar ? 'ဝယ်သူအမည်' : 'Customer Name'}</span>
                  </label>
                  <input
                    type="text"
                    list="twoD-customer-suggestions"
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
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 transition-colors shadow-2xs"
                  />
                  <datalist id="twoD-customer-suggestions">
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
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              {/* Staged Items List Table (matching 3D) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1 pb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{isMyanmar ? 'ထိုးဂဏန်းများ (အရောင်းစာရင်း)' : 'Bet Numbers'}</span>
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-black rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px]">
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
                          setStagedRawSources([]);
                          setLatestDraftIds([]);
                          showToast(isMyanmar ? 'စာရင်းသွင်းထားသော ဂဏန်းအားလုံးကို ဖျက်လိုက်ပါပြီ' : 'Cleared all items', 'warning');
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
                  {items.length === 0 ? (
                    <div className="py-8 px-4 text-center text-slate-400 text-xs space-y-2.5">
                      <p>{isMyanmar ? 'ဂဏန်းများ ထည့်သွင်းထားခြင်း မရှိသေးပါ' : 'No numbers added to slip yet'}</p>
                      <button
                        type="button"
                        onClick={() => setIsPhotoWorkspaceOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-teal-700 border border-teal-200 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-teal-600" />
                        <span>{isMyanmar ? 'ဓါတ်ပုံစလစ် ရိုက်ထည့်ရန် နှိပ်ပါ' : 'Scan Voucher Photo'}</span>
                      </button>
                    </div>
                  ) : (
                    items.map((item, idx) => {
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
                              className="px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-0.5"
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
                                  ? 'text-amber-900 hover:text-teal-700 hover:bg-amber-200/70'
                                  : 'text-slate-500 hover:text-teal-700 hover:bg-slate-200/60'
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

              {/* Notes (matching 3D) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {isMyanmar ? 'မှတ်ချက်' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ဥပမာ: KPay ပေးပြီး"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Calculations & Save Button (matching 3D) */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {/* Financial Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{isMyanmar ? 'စုစုပေါင်း ထိုးကြေး' : 'Subtotal'}:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatAmount(subtotal, settings.currency)}
                  </span>
                </div>
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
                onClick={handleSaveSale}
                disabled={items.length === 0}
                className={`w-full py-3.5 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer ${
                  items.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound))
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {(!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                <span>
                  {(!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound))
                    ? (isMyanmar ? 'ပွဲစဉ်ပိတ်ထားသည် (စာရင်းမသွင်းပါ)' : 'Round Closed (Cannot Save)')
                    : (isMyanmar ? 'ဘောင်ချာ ထုတ်ယူမည် (Save & Print)' : 'Generate Voucher')}
                </span>
                <ArrowRight className="w-4 h-4" />
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
                placeholder={`ဥပမာ-\n၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀\n၃၄ ၄၆ ၃၇ ၁၀၀၀/၅၀၀\n1234 ခွေ 500\n1234 ခွေပူး 500\n1234 ခွေအာ 500\n24 1000\n24R 500\nအပူး 1000\n5 ဘရိတ် 2000`}
                className="w-full p-3 font-mono text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              ></textarea>
              <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                <span>
                  {isMyanmar
                    ? 'အထူးကွန်မန်း: ၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀ (ဒဲ့ ၈၀၀၊ အာ ၂၀၀ အလိုအလျောက်ယူသည်)'
                    : 'Format: 23 45 26 800/200 (Direct 800, Reverse 200)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchOpen(false);
                    onOpenCommandRules?.();
                  }}
                  className="font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>ထိုးကြေးယူနည်း လမ်းညွှန်ကြည့်ရန်</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {onOpenRawClipsModal && (
                <button
                  type="button"
                  onClick={onOpenRawClipsModal}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>မူရင်းစာသားမှတ်တမ်း ကြည့်မည်</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
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
    </div>
  );
};
