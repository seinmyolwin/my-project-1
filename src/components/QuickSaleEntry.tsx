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
  Edit3
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
}

export const QuickSaleEntry: React.FC<QuickSaleEntryProps> = ({ onVoucherCreated, onOpenForwardModal }) => {
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

  // Single Item Input
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('1000');
  const [isRumble, setIsRumble] = useState(false);

  // Staged Bet Items in current voucher
  const [stagedItems, setStagedItems] = useState<BetItem[]>([]);
  // Tracking unconfirmed/active draft items (Yellow) vs confirmed staged items (Green)
  const [latestDraftIds, setLatestDraftIds] = useState<string[]>([]);

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

  // Floating Toast / Feedback notification
  const [toastNotification, setToastNotification] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
  } | null>(null);

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

  // Current number limit check
  const isInputBlocked = useMemo(() => {
    return numberInput.length === 3 && isNumberBlocked(numberInput);
  }, [numberInput, isNumberBlocked]);

  const currentNumberWarning = useMemo(() => {
    if (!numberInput || numberInput.length !== 3) return null;
    const num = numberInput;
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
  }, [numberInput, amountInput, aggregates, isNumberBlocked, getNumberLimit, settings]);

  // Permutation count preview
  const permPreview = useMemo(() => {
    if (!isRumble || numberInput.length !== 3) return [];
    return getPermutations(numberInput);
  }, [isRumble, numberInput]);

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

    const rawInput = convertMyanmarToEnglishDigits(numberInput).trim();
    if (!rawInput) {
      playWarningSound();
      numberInputRef.current?.focus();
      return;
    }

    const hasStraightKeyword = /တဲ့|တည့်/i.test(rawInput);
    const hasRInInput = /r|R|အာ|ပတ်လည်|ပတ်/i.test(rawInput);
    const effectiveRumble = hasStraightKeyword ? false : (isRumble || hasRInInput);

    const cleanForNumbers = rawInput.replace(/တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
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
      amountInputRef.current?.focus();
      return;
    }

    const targetNumbers = rawTokens.map(t => t.padStart(3, '0')).filter(n => /^\d{3}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      setToastNotification({
        type: 'error',
        message: 'ဂဏန်း (၃ လုံး) မှန်ကန်စွာ ထည့်သွင်းပါ'
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
            originalInput: cleanNum
          });
        }
      } else {
        const perms = getPermutations(cleanNum);
        perms.forEach(p => {
          if (isNumberBlocked(p)) {
            blockedFound.push(p);
          } else {
            newItems.push({
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              number: p,
              amount: amount,
              isRumble: true,
              originalInput: `${cleanNum} R`
            });
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
      setNumberInput('');
      setAmountInput('');
      setIsRumble(false);
      numberInputRef.current?.focus();
    }
  };

  // တဲ့ (Straight / Direct Handler)
  const handleAddStraightClick = () => {
    playTapSound();
    setIsRumble(false);
    const cleanNum = convertMyanmarToEnglishDigits(numberInput).trim();
    const cleanAmt = convertMyanmarToEnglishDigits(amountInput).trim();
    if (cleanNum) {
      let amt = parseInt(cleanAmt, 10);
      if (isNaN(amt) || amt <= 0) {
        const rawTokens = cleanNum.replace(/တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ').replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
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

  // Edit Draft Item (fills input form and recalculates totals and limits upon update)
  const handleEditItem = (item: BetItem) => {
    playTapSound();
    setNumberInput(item.number);
    setAmountInput(String(item.amount));
    setIsRumble(item.isRumble || false);
    // Remove from draft list so user can edit and add back
    setStagedItems(prev => prev.filter(i => i.id !== item.id));
    setLatestDraftIds(prev => prev.filter(id => id !== item.id));
    numberInputRef.current?.focus();
    setToastNotification({
      type: 'warning',
      message: `ဂဏန်း [${item.number}] အား ပြင်ဆင်ရန် အောက်ပါအကွက်တွင် ဖြည့်သွင်းထားပါသည်`
    });
  };

  // Restart / Rollback from a specific Checkpoint item (Rule #9, #10)
  // Keeps all items before this index, populates input controls with this item's data,
  // and removes this item and any subsequent items from draft state.
  const handleRestartFromCheckpoint = (index: number, item: BetItem) => {
    playTapSound();
    const preservedItems = stagedItems.slice(0, index);
    setStagedItems(preservedItems);
    setLatestDraftIds([]);
    setNumberInput(item.number);
    setAmountInput(String(item.amount));
    setIsRumble(item.isRumble || false);
    numberInputRef.current?.focus();
    setToastNotification({
      type: 'warning',
      message: `ဂဏန်း [${item.number}] မှ ပြန်လည်စတင်ရန် Input Box ထဲ ပြန်ထည့်ပေးထားပြီး ယခင် Checkpoint အထိ အပြည့်အဝ ထိန်းသိမ်းထားပါသည်`
    });
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    playDeleteSound();
    setStagedItems(prev => prev.filter(item => item.id !== id));
    setLatestDraftIds(prev => prev.filter(item => item !== id));
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
    const voucherItems: VoucherItem[] = itemsToSave.map(item => ({
      number: item.number,
      amount: item.amount,
      betType: item.isRumble ? 'rumble' : 'straight'
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

    // 2. Over-Limit Check across cart items
    const cartTotals: { [num: string]: number } = {};
    stagedItems.forEach(item => {
      cartTotals[item.number] = (cartTotals[item.number] || 0) + item.amount;
    });

    const pendingItems: OverLimitItemInfo[] = [];
    Object.entries(cartTotals).forEach(([num, totalInCart]) => {
      const limit = getNumberLimit(num);
      const existingSold = aggregates[num]?.totalSold || 0;
      if (limit > 0 && (existingSold + totalInCart > limit)) {
        const remainingQuota = Math.max(0, limit - existingSold);
        const excessAmount = (existingSold + totalInCart) - limit;
        pendingItems.push({
          id: num,
          number: num,
          originalAmount: totalInCart,
          existingSold,
          limit,
          remainingQuota,
          excessAmount,
          action: 'forward_excess'
        });
      }
    });

    if (pendingItems.length > 0) {
      playWarningSound();
      setPendingOverLimitItems(pendingItems);
      setIsOverLimitModalOpen(true);
      setIsSavingVoucher(false);
      return;
    }

    // Save voucher directly only if all bets are within limits
    finalizeAndSaveVoucher(stagedItems);
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

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
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
      {activeRound?.status === 'settled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-amber-900 text-sm shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              လက်ရှိပွဲစဉ် ({activeRound.name}) သည် ပေါက်ဂဏန်း <b>{activeRound.winningNumber}</b> ဖြင့် ပြီးဆုံးပြီး ဖြစ်ပါသည်။ (အရောင်းစာရင်းများ စမ်းသပ်ထည့်သွင်းနိုင်ပါသည်)
            </span>
          </div>
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
                    {isMyanmar ? 'Viber / SMS မှ စာသားကူးထည့်ရန် (Shallow Parser)' : 'Paste Text from Viber/SMS'}
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
            <form onSubmit={handleAddBet} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* 3-Digit Input */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {isMyanmar ? 'ဂဏန်း (၃ လုံး)' : '3-Digit Number'}
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
                      placeholder="356 သို့ 123, 456, 789"
                      className="w-full bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2.5 text-xl sm:text-2xl font-black text-indigo-950 font-mono tracking-wider text-center outline-none transition-colors shadow-2xs"
                      autoFocus
                    />
                    {numberInput.length === 3 && (
                      <span className="absolute right-3 top-3.5 text-emerald-600">
                        <Check className="w-5 h-5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {isMyanmar ? 'ထိုးကြေးငွေ' : 'Amount'} ({settings.currency})
                  </label>
                  <input
                    ref={amountInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amountInput}
                    onChange={(e) => {
                      const val = convertMyanmarToEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                      setAmountInput(val);
                      if (latestDraftIds.length > 0 && val.length > 0) {
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
                    placeholder="1000"
                    className="w-full bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2.5 text-xl font-bold text-emerald-700 font-mono text-center outline-none transition-colors shadow-2xs"
                  />
                </div>

                {/* Add Button */}
                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={isInputBlocked}
                    className={`w-full h-[52px] font-black text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                      isInputBlocked
                        ? 'bg-rose-100 text-rose-700 cursor-not-allowed border-2 border-rose-300 select-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isInputBlocked ? (
                      <>
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>{isMyanmar ? 'ဒိုင်ကာ (ပိတ်)' : 'Protected'}</span>
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

              {/* Direct (တဲ့) vs Permutation / Rumble (R) Buttons */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddStraightClick}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      !isRumble
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    title="တဲ့ / တိုက်ရိုက်ထိုးကြေး (Straight / Direct)"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isMyanmar ? 'တဲ့ (တိုက်ရိုက်)' : 'Direct'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setIsRumble(prev => !prev);
                    }}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isRumble
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-1 ring-indigo-500 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    title="ပတ်လည် / အာ (R)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isMyanmar ? 'အာ (ပတ်လည်)' : 'Rumble (R)'}</span>
                  </button>
                </div>

                {isRumble && permPreview.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-indigo-800 font-mono font-bold bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                    <span>{permPreview.length} ခွေ:</span>
                    <span>{permPreview.join(', ')}</span>
                  </div>
                )}
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

            {/* Quick Pattern Shortcut Buttons (အပူး၊ ပါဝါ၊ နက္ခတ်၊ ညီကို) */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isMyanmar ? 'အထူးဂဏန်းအတွဲများ (Quick Patterns):' : 'Special Number Sets:'}</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleAddPattern('အပူး (Triples)', LOTTERY_PATTERNS.triples)}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block">
                    အပူး (000-999)
                  </span>
                  <span className="text-[10px] text-slate-500 block">၁၀ လုံးတွဲ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPattern('ညီကို (Consecutive)', LOTTERY_PATTERNS.consecutives)}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block">
                    ညီကို (012, 123...)
                  </span>
                  <span className="text-[10px] text-slate-500 block">၂၀ လုံးတွဲ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPattern('ပါဝါ (Power Pairs)', LOTTERY_PATTERNS.getPowerPairs().slice(0, 15))}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block">
                    ပါဝါအတွဲများ
                  </span>
                  <span className="text-[10px] text-slate-500 block">၀-၅, ၁-၆...</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddPattern('နက္ခတ် (Natkhat)', LOTTERY_PATTERNS.getNatkhatPairs().slice(0, 15))}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block">
                    နက္ခတ်အတွဲများ
                  </span>
                  <span className="text-[10px] text-slate-500 block">၀-၇, ၁-၈...</span>
                </button>
              </div>
            </div>

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
              <button
                type="button"
                onClick={() => {
                  playDeleteSound();
                  setStagedItems([]);
                }}
                className="text-rose-600 hover:text-rose-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'အကုန်ရှင်းမည်' : 'Clear All'}</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Column (Desktop Right / Mobile Top): Customer Info & Staged Voucher Invoice Review */}
        <div className="order-1 lg:order-2 lg:col-span-5 space-y-5">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col h-full justify-between space-y-5">
            
            {/* Voucher Header & Customer Info */}
            <div className="space-y-4">
              {/* Batch Master Agent Forwarding Trigger */}
              {onOpenForwardModal && (
                <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-200 rounded-xl p-1.5 sm:p-2.5 flex items-center justify-between gap-1.5 sm:gap-2 shadow-2xs">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className="w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <span className="text-xs font-bold text-indigo-950 block truncate">
                        {isMyanmar ? 'အပိုတင်မည်' : 'Forward to Master'}
                      </span>
                      <span className="text-[10px] text-indigo-700 font-medium truncate hidden md:block">
                        {(Object.values(aggregates) as any[]).filter((a: any) => a.limit > 0 && a.totalSold > a.limit).length > 0
                          ? `သတ်မှတ်ချက်ကျော် ပိုနေ: ${(Object.values(aggregates) as any[]).filter((a: any) => a.limit > 0 && a.totalSold > a.limit).length} လုံး`
                          : 'ပိုနေသော 3D ဂဏန်းများကို စုစည်းလွှဲတင်ရန်'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenForwardModal()}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                  >
                    {isMyanmar ? 'အပိုတင်မည်' : 'Forward'}
                  </button>
                </div>
              )}

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
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <div className="flex items-center gap-2">
                    <span>{isMyanmar ? 'ထိုးဂဏန်းများ' : 'Bet Numbers'}</span>
                    <span className="text-[11px] font-normal text-slate-400">({stagedItems.length})</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px]">
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400 border border-amber-600" />
                      {isMyanmar ? 'စစ်ဆေးဆဲ' : 'Draft'}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-700" />
                      {isMyanmar ? 'ယာယီအတည်' : 'Confirmed'}
                    </span>
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
                              <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                                <span>{isMyanmar ? 'စစ်ဆေးဆဲ' : 'Draft'}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{isMyanmar ? 'ယာယီအတည်' : 'OK'}</span>
                              </span>
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
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>{isMyanmar ? 'ဘောင်ချာ ထုတ်ယူမည် (Save & Print)' : 'Generate Voucher'}</span>
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
