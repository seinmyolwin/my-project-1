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

  // Add items from single form
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanNum = numberInput.trim();
    if (!cleanNum || cleanNum.length !== 2 || isNaN(Number(cleanNum))) {
      showToast(isMyanmar ? 'ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit number (00-99)', 'error');
      numberInputRef.current?.focus();
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast(isMyanmar ? 'ထိုးကြေးငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid bet amount', 'error');
      return;
    }

    // Blocked check
    if (isNumberBlocked(cleanNum)) {
      showToast(isMyanmar ? `ဂဏန်း [${cleanNum}] သည် ဒိုင်ကာဂဏန်းအဖြစ် သတ်မှတ်ထားသဖြင့် လုံးဝလက်မခံပါ` : `Number [${cleanNum}] is blocked by dealer!`, 'error');
      return;
    }

    const newItems: TwoDBetItem[] = [];

    if (isRumble) {
      const revs = getTwoDReversal(cleanNum);
      const blockedRevs = revs.filter(r => isNumberBlocked(r));
      const allowedRevs = revs.filter(r => !isNumberBlocked(r));

      if (blockedRevs.length > 0) {
        showToast(isMyanmar ? `[${blockedRevs.join(', ')}] သည် ဒိုင်ကာဂဏန်းဖြစ်သဖြင့် အလိုအလျောက် ပယ်ဖျက်ထားပါသည်` : `Blocked numbers removed`, 'warning');
      }

      allowedRevs.forEach(r => {
        newItems.push({
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          number: r,
          amount: amt,
          isRumble: true,
          originalInput: `${cleanNum} R`
        });
      });
    } else {
      newItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        number: cleanNum,
        amount: amt,
        isRumble: false,
        originalInput: cleanNum
      });
    }

    setItems(prev => [...prev, ...newItems]);
    setNumberInput('');
    setIsRumble(false);
    numberInputRef.current?.focus();
  };

  // Add preset pattern
  const handleAddPattern = (numbers: string[], label: string) => {
    const amt = parseFloat(amountInput) || 1000;
    const allowed = numbers.filter(n => !isNumberBlocked(n));
    const blocked = numbers.filter(n => isNumberBlocked(n));

    if (blocked.length > 0) {
      showToast(isMyanmar ? `${label} ထဲမှ ဒိုင်ကာဂဏန်း [${blocked.join(', ')}] ကို ပယ်ဖျက်ခဲ့သည်` : `Removed blocked numbers from pattern`, 'warning');
    }

    const newItems: TwoDBetItem[] = allowed.map(n => ({
      id: `pat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: n,
      amount: amt,
      originalInput: label
    }));

    setItems(prev => [...prev, ...newItems]);
    setIsPatternOpen(false);
    showToast(isMyanmar ? `${label} (${newItems.length} ကွက်) ထည့်ပြီးပါပြီ` : `Added ${label} (${newItems.length} items)`, 'success');
  };

  // Process Batch Text
  const handleProcessBatch = () => {
    const defAmt = parseFloat(batchDefaultAmount) || 1000;
    const parsed = parseTwoDBatchInput(batchText, defAmt);

    if (parsed.length === 0) {
      showToast(isMyanmar ? 'ဖတ်ရှု၍ရသော ဂဏန်းမရှိပါ' : 'No valid 2D bets found', 'error');
      return;
    }

    const blocked = parsed.filter(p => isNumberBlocked(p.number));
    const allowed = parsed.filter(p => !isNumberBlocked(p.number));

    if (blocked.length > 0) {
      const list = Array.from(new Set(blocked.map(b => b.number))).join(', ');
      showToast(isMyanmar ? `ဒိုင်ကာဂဏန်း [${list}] များကို အလိုအလျောက် ပယ်ဖျက်ထားပါသည်` : `Removed blocked numbers`, 'warning');
    }

    setItems(prev => [...prev, ...allowed]);
    setBatchText('');
    setIsBatchOpen(false);
    showToast(isMyanmar ? `အကွက်ပေါင်း (${allowed.length}) ကွက် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ` : `Added ${allowed.length} items`, 'success');
  };

  // Handle Checkout & Over-Limit Check
  const handleSaveSale = () => {
    if (items.length === 0) {
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

      showToast(isMyanmar ? `ဘောင်ချာနှင့် ဒိုင်ကြီးလွှဲစာရင်း (${formatAmount(fwdTotal, settings.currency)}) အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ` : 'Voucher & Forward Slip created', 'success');
    } else {
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

      {/* Prominent Viber / Photo OCR Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 font-bold shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black">
              {isMyanmar ? '📷 Viber ဓါတ်ပုံ / စလစ်တင်၍ AI ဖြင့် အလိုအလျောက် စကင်ဖတ်ရန်' : 'Scan Viber Slip Photo'}
            </h3>
            <p className="text-xs text-teal-200">
              {isMyanmar ? 'လက်ရေးစလစ် သို့မဟုတ် Viber စကရင်ရှော့ခ်များကို တင်လိုက်ရုံဖြင့် ဂဏန်းနှင့် ထိုးကြေးများ အလိုအလျောက် ဝင်မည်' : 'Upload photos or screenshots to instantly extract bets'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsScannerModalOpen(true)}
          className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-teal-950 font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 transition-transform active:scale-95 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isMyanmar ? 'ဓါတ်ပုံစကင်ဖတ်မည် (Scan Now)' : 'Scan Photo Now'}</span>
        </button>
      </div>

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
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="24"
                    value={numberInput}
                    onChange={(e) => {
                      const val = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
                      setNumberInput(val);
                    }}
                    onFocus={(e) => e.target.select()}
                    className={`w-full h-13 px-4 text-center font-mono text-2xl font-black rounded-xl border transition-all ${
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
                    placeholder="1000"
                    value={amountInput}
                    onChange={(e) => setAmountInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
                    onFocus={(e) => e.target.select()}
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

              {/* R Toggle & Quick Amount Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* R (Permutation) toggle */}
                <button
                  type="button"
                  onClick={() => setIsRumble(!isRumble)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRumble
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isMyanmar ? 'အာ / ပတ်လည် (R)' : 'Rumble (R)'}</span>
                </button>

                {/* Quick amount chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[500, 1000, 2000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(String(amt))}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
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

            {/* Popular Myanmar 2D Pattern Shortcuts */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 mb-2.5 flex items-center justify-between">
                <span>{isMyanmar ? 'ဇီးကွက် ထိုးကွက် အမြန်ခလုတ်များ' : 'Quick Pattern Pads'}</span>
                <span className="text-[11px] text-slate-400">{isMyanmar ? '(သတ်မှတ်ငွေဖြင့် ထည့်မည်)' : ''}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleAddPattern(TWO_D_DOUBLES, isMyanmar ? 'အပူး (၁၀ ကွက်)' : 'Doubles')}
                  className="px-3 py-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all text-center cursor-pointer"
                >
                  {isMyanmar ? 'အပူး (00-99)' : 'Doubles'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPattern(TWO_D_POWER, isMyanmar ? 'ပါဝါ (၁၀ ကွက်)' : 'Power')}
                  className="px-3 py-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all text-center cursor-pointer"
                >
                  {isMyanmar ? 'ပါဝါ (Power)' : 'Power'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPattern(TWO_D_NATKHAT, isMyanmar ? 'နက္ခတ် (၁၀ ကွက်)' : 'Natkhat')}
                  className="px-3 py-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all text-center cursor-pointer"
                >
                  {isMyanmar ? 'နက္ခတ် (Natkhat)' : 'Natkhat'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPattern(TWO_D_BROTHERS, isMyanmar ? 'ညီကို (၂၀ ကွက်)' : 'Brothers')}
                  className="px-3 py-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all text-center cursor-pointer"
                >
                  {isMyanmar ? 'ညီကို (Brothers)' : 'Brothers'}
                </button>
              </div>

              {/* Breaks (ဘရိတ် 0-9) Quick Bar */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-xs font-bold text-slate-600 shrink-0 mr-1">
                  {isMyanmar ? 'ဘရိတ်:' : 'Break:'}
                </span>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleAddPattern(getTwoDBreakNumbers(b), `${b} ဘရိတ်`)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-teal-100 hover:text-teal-800 text-slate-700 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {b}B
                  </button>
                ))}
              </div>
            </div>
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
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  placeholder={isMyanmar ? 'ဖုန်းနံပါတ် (မဖြစ်မနေ မဟုတ်ပါ)' : 'Phone number'}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="sm:col-span-3">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    placeholder="0"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
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
                  onClick={() => setItems([])}
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
                        onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
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
                  value={batchDefaultAmount}
                  onChange={(e) => setBatchDefaultAmount(e.target.value.replace(/\D/g, ''))}
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
      />
    </div>
  );
};
