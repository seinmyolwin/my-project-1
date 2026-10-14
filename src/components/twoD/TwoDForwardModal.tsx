import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Trash2,
  Plus,
  CheckCircle2,
  Percent,
  X,
  Phone,
  User,
  ShieldAlert,
  Copy,
  Printer,
  Sparkles,
  Layers,
  AlertTriangle,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDNumberAggregate, TwoDForwardSlip, TwoDQuickActionButtonsConfig } from '../../types';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import {
  TWO_D_DOUBLES,
  TWO_D_POWER,
  TWO_D_NATKHAT,
  TWO_D_BROTHERS,
  getTwoDBreakNumbers,
  getTwoDHeadNumbers,
  getTwoDTailNumbers,
  getTwoDIncludesNumbers,
  getTwoDReversal,
  getTwoDKhway,
  getTwoDKhwayPuu,
  getTwoDKhwayRumble,
  getTwoDKhwayPuuRumble
} from '../../utils/twoDLotteryUtils';
import { DEFAULT_2D_ACTION_BUTTONS } from '../../utils/storage';
import { playTapSound, playWarningSound, playAddSound, playSuccessSound, playDeleteSound } from '../../utils/audioUtils';

interface TwoDForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumber?: string;
  initialAmount?: number;
}

interface ForwardDraftItem {
  id: string;
  number: string;
  totalSold: number;
  limit: number;
  excessAmount: number;
  forwardAmount: number;
  selected: boolean;
}

export const TwoDForwardModal: React.FC<TwoDForwardModalProps> = ({
  isOpen,
  onClose,
  initialNumber,
  initialAmount
}) => {
  const { settings, activeRound, aggregates, addForwardSlip, updateSettings } = useTwoDLottery();
  const isMyanmar = settings.language === 'my';

  // Saved Master Agents List (Empty by default as requested)
  const [savedAgents, setSavedAgents] = useState<Array<{ name: string; phone?: string; commissionRate?: number }>>(() => {
    try {
      const stored = localStorage.getItem('shwe_master_agents_list');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return [];
  });

  const [masterAgentName, setMasterAgentName] = useState(settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone, setMasterAgentPhone] = useState(settings.defaultMasterAgentPhone || '09-970001111');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionRate ?? 0);
  const [notes, setNotes] = useState('');
  const [savedDefaultSuccess, setSavedDefaultSuccess] = useState(false);

  useEffect(() => {
    if (typeof settings.defaultCommissionRate === 'number') {
      setCommissionRate(settings.defaultCommissionRate);
    }
  }, [settings.defaultCommissionRate]);

  // Draft Forward Items (with selection and custom amounts)
  const [draftItems, setDraftItems] = useState<ForwardDraftItem[]>([]);

  // Manual Add Form
  const [manualNum, setManualNum] = useState('');
  const [manualAmt, setManualAmt] = useState('10000');

  // Completed Slip for display / copy / print
  const [createdSlip, setCreatedSlip] = useState<TwoDForwardSlip | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Compute all excess / over-limit numbers from active round aggregates
  const excessList: ForwardDraftItem[] = useMemo(() => {
    const list: ForwardDraftItem[] = [];
    const allAggs = Object.values(aggregates) as TwoDNumberAggregate[];

    allAggs.forEach((agg) => {
      const netSold = Math.max(0, agg.totalSold - (agg.forwardedAmount || 0));
      if (agg.limit > 0 && netSold > agg.limit) {
        const excess = netSold - agg.limit;
        list.push({
          id: `excess-${agg.number}`,
          number: agg.number,
          totalSold: agg.totalSold,
          limit: agg.limit,
          excessAmount: excess,
          forwardAmount: excess,
          selected: true
        });
      }
    });

    return list.sort((a, b) => b.excessAmount - a.excessAmount);
  }, [aggregates]);

  // Quick Action Buttons visibility & active status config
  const enabledButtons = useMemo<TwoDQuickActionButtonsConfig>(() => {
    return {
      ...DEFAULT_2D_ACTION_BUTTONS,
      ...(settings.quickActionButtons || {})
    };
  }, [settings.quickActionButtons]);

  const [digitSelectorType, setDigitSelectorType] = useState<'break' | 'includes' | 'head' | 'tail' | null>(null);
  const [quickToast, setQuickToast] = useState<string | null>(null);

  const showQuickToast = (msg: string) => {
    setQuickToast(msg);
    setTimeout(() => {
      setQuickToast(null);
    }, 3000);
  };

  const isRoundSettledOrClosed = activeRound?.status === 'settled' || activeRound?.status === 'closed';

  // Initialize draft items on open, round change, or settlement
  useEffect(() => {
    if (!isOpen) {
      setCreatedSlip(null);
      setCopySuccess(false);
      setSavedDefaultSuccess(false);
      setDraftItems([]);
      setManualNum('');
      return;
    }

    // If round is settled or closed, forward operations are shut down / blank
    if (isRoundSettledOrClosed) {
      setCreatedSlip(null);
      setDraftItems([]);
      setManualNum('');
      onClose();
      return;
    }

    if (initialNumber && initialAmount && initialAmount > 0) {
      // Direct single number trigger (only load this specific number)
      const cleanNum = initialNumber.padStart(2, '0');
      const agg = aggregates[cleanNum];
      const initItem: ForwardDraftItem = {
        id: `init-${cleanNum}`,
        number: cleanNum,
        totalSold: agg?.totalSold || initialAmount,
        limit: agg?.limit || 0,
        excessAmount: initialAmount,
        forwardAmount: initialAmount,
        selected: true
      };
      setDraftItems([initItem]);
    } else {
      // Auto-load all over-limit numbers of CURRENT round only
      setDraftItems(excessList);
    }
  }, [isOpen, activeRound?.id, activeRound?.status, isRoundSettledOrClosed]);

  // Handle setting active master agent as default
  const handleSaveAsDefaultAgent = () => {
    const name = masterAgentName.trim();
    if (!name) return;
    const phone = masterAgentPhone.trim();
    const rate = Number(commissionRate) || 0;

    // Save in settings
    updateSettings({
      defaultMasterAgentName: name,
      defaultMasterAgentPhone: phone,
      defaultCommissionRate: rate
    });

    // Save in savedAgents list
    setSavedAgents(prev => {
      const filtered = prev.filter(a => a.name !== name);
      const updated = [{ name, phone, commissionRate: rate }, ...filtered];
      try {
        localStorage.setItem('shwe_master_agents_list', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setSavedDefaultSuccess(true);
    setTimeout(() => setSavedDefaultSuccess(false), 3000);
  };

  const handleSelectSavedAgent = (agent: { name: string; phone?: string; commissionRate?: number }) => {
    setMasterAgentName(agent.name);
    if (agent.phone) setMasterAgentPhone(agent.phone);
    if (typeof agent.commissionRate === 'number') setCommissionRate(agent.commissionRate);
  };

  // Toggle selection for a single number
  const toggleSelect = (id: string) => {
    playTapSound();
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select all or Deselect all
  const handleToggleSelectAll = () => {
    playTapSound();
    const allSelected = draftItems.length > 0 && draftItems.every((i) => i.selected);
    setDraftItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  // Update forward amount for a specific item
  const handleAmountChange = (id: string, newAmtStr: string) => {
    const cleaned = convertMyanmarToEnglishDigits(newAmtStr).replace(/\D/g, '');
    const numVal = parseInt(cleaned, 10) || 0;
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, forwardAmount: numVal } : item))
    );
  };

  // Remove item from draft
  const handleRemoveItem = (id: string) => {
    playDeleteSound();
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Add Manual Number to draft (Single or Bulk)
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = convertMyanmarToEnglishDigits(manualNum).trim();
    if (!cleaned) {
      playWarningSound();
      return;
    }

    // Support single or multiple tokens separated by comma, space, semicolon, newline
    const tokens = cleaned
      .split(/[\s,;\n]+/)
      .map((t) => t.replace(/\D/g, ''))
      .filter((t) => t.length > 0);

    const amt = parseFloat(convertMyanmarToEnglishDigits(manualAmt).replace(/\D/g, '')) || 0;
    if (tokens.length === 0 || amt <= 0) {
      playWarningSound();
      return;
    }

    const newDrafts = [...draftItems];
    tokens.forEach((token) => {
      const numStr = token.slice(0, 2).padStart(2, '0');
      const existingIdx = newDrafts.findIndex((i) => i.number === numStr);
      if (existingIdx !== -1) {
        newDrafts[existingIdx] = {
          ...newDrafts[existingIdx],
          forwardAmount: newDrafts[existingIdx].forwardAmount + amt,
          selected: true
        };
      } else {
        const agg = aggregates[numStr];
        newDrafts.push({
          id: `manual-2d-${numStr}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          number: numStr,
          totalSold: agg?.totalSold || 0,
          limit: agg?.limit || 0,
          excessAmount: amt,
          forwardAmount: amt,
          selected: true
        });
      }
    });

    setDraftItems(newDrafts);
    setManualNum('');
    playAddSound();
  };

  // 0. Straight / Direct (ဒဲ့)
  const handleAddStraightClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(manualNum).trim();
    if (!cleanNum) {
      showQuickToast(isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်) အတွက် ဂဏန်း ရိုက်ထည့်ပါ' : 'Enter numbers for direct');
      return;
    }
    const cleanForNumbers = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
    const targetNumbers = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));
    if (targetNumbers.length > 0) {
      setManualNum(targetNumbers.join(', '));
      showQuickToast(isMyanmar ? `ဒဲ့ [${targetNumbers.join(', ')}] (${targetNumbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ` : `Direct: ${targetNumbers.length} numbers`);
    }
  };

  // 1. Rumble / Permutation (အာ / ပတ်လည်)
  const handleAddRumbleClick = () => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(manualNum).trim();
    if (!cleanNum) {
      playWarningSound();
      showQuickToast(isMyanmar ? 'အာ (R) အတွက် ဂဏန်း အရင်ရိုက်ထည့်ပါ (ဥပမာ- ၂၄)' : 'Enter number to reverse (e.g. 24)');
      return;
    }
    const cleanForNumbers = cleanNum.replace(/ဒဲ့|တဲ့|တည့်|အာ|ပတ်လည်|ပတ်|r|R/gi, ' ');
    const rawTokens = cleanForNumbers.replace(/[,;:=_\-/*+]/g, ' ').split(/\s+/).filter(Boolean);
    const targetNumbers = rawTokens.map(t => t.length === 1 ? `0${t}` : t).filter(n => /^\d{2}$/.test(n));

    if (targetNumbers.length === 0) {
      playWarningSound();
      showQuickToast(isMyanmar ? 'အာ (R) အတွက် ၂ လုံးဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ထည့်ပါ' : 'Enter valid 2-digit numbers');
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

    setManualNum(reversedList.join(', '));
    showQuickToast(isMyanmar ? `အာ [${reversedList.join(', ')}] (${reversedList.length} ကွက်) ထည့်သွင်းပြီးပါပြီ` : `Rumble: ${reversedList.length} numbers`);
  };

  // 2. Select digit pattern for Break / Includes / Head / Tail
  const handleSelectDigitPattern = (type: 'break' | 'includes' | 'head' | 'tail', digit: number) => {
    playTapSound();
    let numbers: string[] = [];
    let label = '';
    if (type === 'break') {
      numbers = getTwoDBreakNumbers(digit);
      label = isMyanmar ? `[${digit}] ဘရိတ် (၁၀ ကွက်)` : `Break ${digit} (10 numbers)`;
    } else if (type === 'includes') {
      numbers = getTwoDIncludesNumbers(digit);
      label = isMyanmar ? `[${digit}] အပါ (၁၉ ကွက်)` : `Includes ${digit} (19 numbers)`;
    } else if (type === 'head') {
      numbers = getTwoDHeadNumbers(digit);
      label = isMyanmar ? `[${digit}] ထိပ်စီး (၁၀ ကွက်)` : `Head ${digit} (10 numbers)`;
    } else if (type === 'tail') {
      numbers = getTwoDTailNumbers(digit);
      label = isMyanmar ? `[${digit}] နောက်ပိတ် (၁၀ ကွက်)` : `Tail ${digit} (10 numbers)`;
    }
    setManualNum(numbers.join(', '));
    setDigitSelectorType(null);
    showQuickToast(label);
  };

  const handleClickDigitButton = (type: 'break' | 'includes' | 'head' | 'tail') => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(manualNum).trim();
    const digits = cleanNum.match(/\d/g);
    if (digits && digits.length === 1) {
      handleSelectDigitPattern(type, parseInt(digits[0], 10));
    } else {
      setDigitSelectorType(prev => prev === type ? null : type);
    }
  };

  // 3. Fixed Patterns: Doubles / Power / Natkhat / Brothers
  const handleAddPattern = (numbers: string[], label: string) => {
    playTapSound();
    setManualNum(numbers.join(', '));
    setDigitSelectorType(null);
    showQuickToast(isMyanmar ? `[${label}] (${numbers.length} ကွက်) ရွေးချယ်ပြီးပါပြီ` : `Selected ${label} (${numbers.length} numbers)`);
  };

  // 4. Khway Patterns: Khway, Khway Puu, Khway Rumble, Khway Puu Rumble
  const handleAddKhway = (type: 'khway' | 'khwayPuu' | 'khwayRumble' | 'khwayPuuRumble') => {
    playTapSound();
    const cleanNum = convertMyanmarToEnglishDigits(manualNum).trim();
    const digitsOnly = cleanNum.replace(/\D/g, '');
    const uniqueDigits = Array.from(new Set(digitsOnly.split('')));

    if (uniqueDigits.length < 2) {
      playWarningSound();
      showQuickToast(isMyanmar ? 'ခွေရန် အနည်းဆုံး ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ (ဥပမာ- ၁၂၃၄ သို့ ၂၃၄၅၆)' : 'Enter at least 2 distinct digits (e.g. 1234)');
      return;
    }

    let numbers: string[] = [];
    let label = '';
    if (type === 'khway') {
      numbers = getTwoDKhway(digitsOnly);
      label = isMyanmar ? `[${uniqueDigits.join('')}] ခွေ (${numbers.length} ကွက်)` : `Khway (${numbers.length} numbers)`;
    } else if (type === 'khwayPuu') {
      numbers = getTwoDKhwayPuu(digitsOnly);
      label = isMyanmar ? `[${uniqueDigits.join('')}] ခွေပူး (${numbers.length} ကွက်)` : `Khway Puu (${numbers.length} numbers)`;
    } else if (type === 'khwayRumble') {
      numbers = getTwoDKhwayRumble(digitsOnly);
      label = isMyanmar ? `[${uniqueDigits.join('')}] ခွေr (${numbers.length} ကွက်)` : `Khway R (${numbers.length} numbers)`;
    } else if (type === 'khwayPuuRumble') {
      numbers = getTwoDKhwayPuuRumble(digitsOnly);
      label = isMyanmar ? `[${uniqueDigits.join('')}] ခွေပူးr (${numbers.length} ကွက်)` : `Khway Puu R (${numbers.length} numbers)`;
    }

    setManualNum(numbers.join(', '));
    setDigitSelectorType(null);
    showQuickToast(label);
  };

  // Selected items to be forwarded
  const activeSelectedItems = draftItems.filter((i) => i.selected && i.forwardAmount > 0);
  const totalAmount = activeSelectedItems.reduce((acc, i) => acc + i.forwardAmount, 0);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const netPaid = totalAmount - commissionAmount;

  // Submit and create Forward Slip
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRoundSettledOrClosed) {
      alert(isMyanmar ? 'ဤပွဲစဉ်သည် ပေါက်ဂဏန်း အတည်ပြုပြီး/ပိတ်သိမ်းပြီး ဖြစ်သဖြင့် အထက်ဒိုင်ဆီ လွှဲတင်၍ မရတော့ပါ' : 'Round is closed or settled. Cannot forward.');
      return;
    }
    if (activeSelectedItems.length === 0) {
      alert(isMyanmar ? 'လွှဲတင်မည့် ဂဏန်းစာရင်း (အနည်းဆုံး ၁ လုံး) ရွေးချယ်ပါ' : 'Select at least one number to forward');
      return;
    }

    const forwardPayload = {
      roundId: activeRound?.id || 'default',
      masterAgentName: masterAgentName.trim() || 'ဒိုင်ချုပ်ကြီး',
      masterAgentPhone: masterAgentPhone.trim(),
      items: activeSelectedItems.map((i) => ({ number: i.number, amount: i.forwardAmount })),
      totalAmount,
      commissionRate,
      commissionAmount,
      netPaid,
      notes: notes.trim() || undefined
    };

    const newSlip = addForwardSlip(forwardPayload);
    playSuccessSound();
    setCreatedSlip(newSlip);
    // Clear draft items so the active forward operational state is reset to a clean blank page
    setDraftItems([]);
    setManualNum('');
  };

  // Copy Telegram / SMS Text
  const handleCopySlipText = () => {
    if (!createdSlip) return;
    const lines = createdSlip.items.map((it) => `${it.number}=${it.amount}`);
    const text = `【ဒိုင်လွှဲစလစ်: ${createdSlip.slipNo}】\nရက်စွဲ: ${new Date(createdSlip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\nဒိုင်ချုပ်: ${createdSlip.masterAgentName}\n----------------\n${lines.join('\n')}\n----------------\nစုစုပေါင်း: ${formatAmount(createdSlip.totalAmount, settings.currency)}\nကော်မရှင် (${createdSlip.commissionRate}%): +${formatAmount(createdSlip.commissionAmount, settings.currency)}\nဒိုင်သို့ အမှန်ပေးငွေ: ${formatAmount(createdSlip.netPaid, settings.currency)}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Print Slip
  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-indigo-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">
                {isMyanmar ? 'ဒိုင်ကြီးဆီ ပြန်တင်စာရင်း (Batch Forward Hub)' : 'Master Agent Forwarding Hub'}
              </h3>
              <p className="text-[11px] text-indigo-200/80">
                {isMyanmar
                  ? 'သတ်မှတ်ချက်ကျော် ပိုနေသောဂဏန်းများကို စုစည်း၍ ဒိုင်ကြီးဆီ လွှဲတင်ခြင်း'
                  : 'Batch offload excess liability to master bookmaker'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {createdSlip ? (
          /* Success / Slip Confirmation Card */
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="text-center space-y-2 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                {isMyanmar ? 'ဒိုင်ကြီးဆီ လွှဲတင်စာရင်း အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ' : 'Forward Slip Created Successfully'}
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                {createdSlip.slipNo} • {createdSlip.masterAgentName}
              </p>
            </div>

            {/* Receipt Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs space-y-3">
              <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-2">
                <span>ပွဲစဉ်: {activeRound?.name}</span>
                <span>ဂဏန်း {createdSlip.items.length} တွဲ</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                {createdSlip.items.map((it, idx) => (
                  <div key={idx} className="pt-1.5 flex justify-between items-center text-slate-800">
                    <span className="font-bold text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded">
                      {it.number}
                    </span>
                    <span className="font-bold">{formatAmount(it.amount, settings.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-2 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>လွှဲတင်ငွေ စုစုပေါင်း:</span>
                  <span className="font-bold">{formatAmount(createdSlip.totalAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>ရရှိမည့် ကော်မရှင် ({createdSlip.commissionRate}%):</span>
                  <span className="font-bold">+{formatAmount(createdSlip.commissionAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                  <span>ဒိုင်ကြီးသို့ ပေးရန်:</span>
                  <span className="text-indigo-700">{formatAmount(createdSlip.netPaid, settings.currency)}</span>
                </div>
              </div>
            </div>

            {/* Quick Share / Export Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopySlipText}
                className="py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>{copySuccess ? 'Copied ✓' : 'စာသား ကူးယူမည်'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>ဘောင်ချာ ပရင့်ထုတ်မည်</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                ပိတ်မည် (Done)
              </button>
            </div>
          </div>
        ) : (
          /* Forward Configuration Form */
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {/* Master Agent Info & Customization Row */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  <span>{isMyanmar ? 'အထက်ဒိုင်ကြီး အချက်အလက်' : 'Master Bookie Profile'}</span>
                </span>
                
                {/* Save as default button */}
                <button
                  type="button"
                  onClick={handleSaveAsDefaultAgent}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    savedDefaultSuccess
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title="လက်ရှိ ဒိုင်ချုပ်အမည်နှင့် အချက်အလက်များကို ပုံသေဒိုင်အဖြစ် မှတ်သားထားမည်"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${savedDefaultSuccess ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{savedDefaultSuccess ? 'မူလဒိုင်အဖြစ် သိမ်းဆည်းပြီး ✓' : 'မူလဒိုင်အဖြစ် မှတ်မည်'}</span>
                </button>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ဒိုင်ချုပ် အမည်</label>
                  <input
                    type="text"
                    value={masterAgentName}
                    onChange={(e) => setMasterAgentName(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="ဒိုင်ကြီး အမည် ရိုက်ထည့်ပါ"
                    className="w-full h-9 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                  <input
                    type="text"
                    value={masterAgentPhone}
                    onChange={(e) => setMasterAgentPhone(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="09-xxxxxxxxx"
                    className="w-full h-9 px-3 bg-white rounded-xl border border-slate-300 font-mono text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ကော်မရှင် ရာခိုင်နှုန်း (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-9 px-3 pr-7 bg-white rounded-xl border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                    />
                    <Percent className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {isRoundSettledOrClosed && (
              <div className="bg-amber-100 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-black text-amber-900">
                    {isMyanmar
                      ? 'ဤပွဲစဉ်သည် ပေါက်ဂဏန်း အတည်ပြုပြီးဖြစ်သောကြောင့် အထက်ဒိုင်သို့ ပြန်တင်သည့် ဘောင်ချာလုပ်ဆောင်ချက်များကို ပိတ်သိမ်းထားပါသည် (Settled)'
                      : 'This round has been settled/closed. Forwarding operations are closed.'}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {isMyanmar
                      ? 'အထက်ဒိုင်ဆီ ထပ်မံလွှဲတင်၍ မရတော့ပါ။ ပွဲစဉ်အသစ် ဖွင့်လှစ်ပြီးမှသာ ဒိုင်ကြီးလွှဲစာရင်း အသစ် ထည့်သွင်းနိုင်ပါမည်။'
                      : 'New forward slips can only be created after opening a new round.'}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Add Custom 2D Numbers (Single or Bulk) */}
            <form onSubmit={handleAddManual} className="bg-teal-50/50 p-2.5 rounded-2xl border border-teal-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-950 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-teal-600" />
                  <span>{isMyanmar ? 'အခြား စိတ်ကြိုက်ဂဏန်းများ ထည့်ရန်' : 'Add Custom Bets to Forward'}</span>
                </span>
                <span className="text-[10px] text-teal-700 font-medium">
                  {isMyanmar ? 'ဂဏန်း ၁ လုံး သို့မဟုတ် အများ (12, 34, 56) ခွဲ၍ ထည့်နိုင်ပါသည်' : 'Single or multiple separated by comma/space'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={isRoundSettledOrClosed}
                  placeholder={isMyanmar ? 'ဂဏန်း (ဥပမာ: 24 သို့ 12, 34, 56)' : 'Numbers (e.g. 24 or 12, 34)'}
                  value={manualNum}
                  onChange={(e) => {
                    playTapSound();
                    setManualNum(e.target.value);
                  }}
                  onFocus={(e) => e.target.select()}
                  className={`flex-1 h-9 px-3 font-mono font-bold rounded-xl border bg-white outline-none shadow-2xs ${
                    isRoundSettledOrClosed
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 focus:border-teal-500'
                  }`}
                />
                <div className="w-32 relative">
                  <input
                    type="text"
                    disabled={isRoundSettledOrClosed}
                    placeholder="ငွေပမာဏ"
                    value={manualAmt}
                    onChange={(e) => {
                      playTapSound();
                      setManualAmt(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''));
                    }}
                    onFocus={(e) => e.target.select()}
                    className={`w-full h-9 px-2.5 text-right font-mono font-bold rounded-xl border bg-white outline-none shadow-2xs ${
                      isRoundSettledOrClosed
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 focus:border-teal-500'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRoundSettledOrClosed}
                  className={`h-9 px-4 text-white font-bold rounded-xl shadow-xs shrink-0 transition-all ${
                    isRoundSettledOrClosed
                      ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                      : 'bg-teal-600 hover:bg-teal-700 cursor-pointer active:scale-95'
                  }`}
                >
                  + ထည့်မည်
                </button>
              </div>
              {/* Toast message if any */}
              {quickToast && (
                <div className="px-2.5 py-1 bg-teal-800 text-white text-[11px] font-bold rounded-lg flex items-center justify-between shadow-xs animate-in fade-in duration-150">
                  <span>✓ {quickToast}</span>
                  <button type="button" onClick={() => setQuickToast(null)} className="text-teal-200 hover:text-white text-[10px] ml-2">✕</button>
                </div>
              )}

              {/* Quick Action Buttons according to Settings */}
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-900/90 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    <span>{isMyanmar ? 'အမြန်ထိုးခလုတ်များ (ဆက်တင်သတ်မှတ်ချက်အတိုင်း):' : 'Quick Bet Buttons (from Settings):'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {manualNum.trim() && (
                      <button
                        type="button"
                        onClick={() => setManualNum('')}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                        title="ဂဏန်းကွက် ရှင်းမည်"
                      >
                        ဂဏန်းဖျက်မည်
                      </button>
                    )}
                    {digitSelectorType && (
                      <button
                        type="button"
                        onClick={() => setDigitSelectorType(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                      >
                        ✕ ပိတ်မည်
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {enabledButtons.straight && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={handleAddStraightClick}
                      className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ဒဲ့ (တိုက်ရိုက်)' : 'Direct'}
                    >
                      {isMyanmar ? 'ဒဲ့' : 'Direct'}
                    </button>
                  )}

                  {enabledButtons.rumble && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={handleAddRumbleClick}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'အာ (ပတ်လည်)' : 'Rumble'}
                    >
                      {isMyanmar ? 'အာ' : 'R'}
                    </button>
                  )}

                  {enabledButtons.break && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleClickDigitButton('break')}
                      className={`px-2.5 py-1 border rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 ${
                        digitSelectorType === 'break'
                          ? 'bg-sky-600 text-white border-sky-600 ring-1 ring-sky-400'
                          : 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
                      }`}
                      title={isMyanmar ? 'ရိတ် (ဘရိတ် ၁၀ ကွက်)' : 'Break'}
                    >
                      {isMyanmar ? 'ရိတ်' : 'Break'}
                    </button>
                  )}

                  {enabledButtons.includes && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleClickDigitButton('includes')}
                      className={`px-2.5 py-1 border rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 ${
                        digitSelectorType === 'includes'
                          ? 'bg-amber-600 text-white border-amber-600 ring-1 ring-amber-400'
                          : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                      }`}
                      title={isMyanmar ? 'အပါ (အပါ ၁၉ ကွက်)' : 'Includes'}
                    >
                      {isMyanmar ? 'အပါ' : 'Includes'}
                    </button>
                  )}

                  {enabledButtons.head && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleClickDigitButton('head')}
                      className={`px-2.5 py-1 border rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 ${
                        digitSelectorType === 'head'
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-1 ring-indigo-400'
                          : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800'
                      }`}
                      title={isMyanmar ? 'ထိပ် (ထိပ်စီး ၁၀ ကွက်)' : 'Head'}
                    >
                      {isMyanmar ? 'ထိပ်' : 'Head'}
                    </button>
                  )}

                  {enabledButtons.tail && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleClickDigitButton('tail')}
                      className={`px-2.5 py-1 border rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 ${
                        digitSelectorType === 'tail'
                          ? 'bg-purple-600 text-white border-purple-600 ring-1 ring-purple-400'
                          : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800'
                      }`}
                      title={isMyanmar ? 'ပိတ် (နောက်ပိတ် ၁၀ ကွက်)' : 'Tail'}
                    >
                      {isMyanmar ? 'ပိတ်' : 'Tail'}
                    </button>
                  )}

                  {enabledButtons.doubles && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddPattern(TWO_D_DOUBLES, isMyanmar ? 'အပူး' : 'Doubles')}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ပူး (အပူး ၁၀ ကွက်)' : 'Doubles'}
                    >
                      {isMyanmar ? 'အပူး' : 'Doubles'}
                    </button>
                  )}

                  {enabledButtons.power && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddPattern(TWO_D_POWER, isMyanmar ? 'ပါဝါ' : 'Power')}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ပါဝါ (၁၀ ကွက်)' : 'Power'}
                    >
                      {isMyanmar ? 'ပါဝါ' : 'Power'}
                    </button>
                  )}

                  {enabledButtons.natkhat && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddPattern(TWO_D_NATKHAT, isMyanmar ? 'နက္ခတ်' : 'Natkhat')}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'နက္ခတ် (၁၀ ကွက်)' : 'Natkhat'}
                    >
                      {isMyanmar ? 'နက္ခတ်' : 'Natkhat'}
                    </button>
                  )}

                  {enabledButtons.brothers && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddPattern(TWO_D_BROTHERS, isMyanmar ? 'ညီကို' : 'Brothers')}
                      className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ညီကို (၂၀ ကွက်)' : 'Brothers'}
                    >
                      {isMyanmar ? 'ညီကို' : 'Brothers'}
                    </button>
                  )}

                  {enabledButtons.khway && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddKhway('khway')}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ခွေ (ရိုးရိုးခွေ)' : 'Khway'}
                    >
                      {isMyanmar ? 'ခွေ' : 'Khway'}
                    </button>
                  )}

                  {enabledButtons.khwayPuu && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddKhway('khwayPuu')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ခွေပူး' : 'Khway Puu'}
                    >
                      {isMyanmar ? 'ခွေပူး' : 'Khway Puu'}
                    </button>
                  )}

                  {enabledButtons.khwayRumble && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddKhway('khwayRumble')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ခွေr (ခွေအာ)' : 'Khway R'}
                    >
                      {isMyanmar ? 'ခွေr' : 'Khway R'}
                    </button>
                  )}

                  {enabledButtons.khwayPuuRumble && (
                    <button
                      type="button"
                      disabled={isRoundSettledOrClosed}
                      onClick={() => handleAddKhway('khwayPuuRumble')}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isMyanmar ? 'ခွေပူးr' : 'Khway Puu R'}
                    >
                      {isMyanmar ? 'ခွေပူးr' : 'Khway Puu R'}
                    </button>
                  )}
                </div>

                {/* Inline Digit Picker when Break / Includes / Head / Tail is active */}
                {digitSelectorType && (
                  <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 animate-in fade-in duration-150 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-1">
                      <span>
                        {digitSelectorType === 'break' && (isMyanmar ? 'ဘရိတ် ဂဏန်း ရွေးပါ (၀-၉):' : 'Select Break digit (0-9):')}
                        {digitSelectorType === 'includes' && (isMyanmar ? 'အပါ ဂဏန်း ရွေးပါ (၀-၉):' : 'Select Includes digit (0-9):')}
                        {digitSelectorType === 'head' && (isMyanmar ? 'ထိပ်စီး ဂဏန်း ရွေးပါ (၀-၉):' : 'Select Head digit (0-9):')}
                        {digitSelectorType === 'tail' && (isMyanmar ? 'နောက်ပိတ် ဂဏန်း ရွေးပါ (၀-၉):' : 'Select Tail digit (0-9):')}
                      </span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleSelectDigitPattern(digitSelectorType, digit)}
                          className="h-8 bg-white hover:bg-teal-600 hover:text-white border border-slate-200 rounded-lg font-mono font-black text-xs text-slate-800 transition-colors shadow-2xs cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          {digit}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Reassuring Notice for Dealer Retention */}
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950 shadow-2xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold">
                  {isMyanmar
                    ? 'သတိပြုရန် - အထက်ဒိုင်ဆီသို့ ဤနေရာမှ တကယ်ဘောင်ချာထုတ်ပြီး မတင်မချင်း အလိုအလျောက် မနှုတ်ပါ'
                    : 'Notice: Excess bets are NOT deducted as forwarded until confirmed with a voucher.'}
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isMyanmar
                    ? 'သတ်မှတ်ဘရိတ်ထက် ပိုလာသော်လည်း အထက်ဒိုင်သို့ မတင်ဘဲ ကိုယ်တိုင်အကုန်စားလိုပါက မရွေးချယ်ဘဲ ချန်ထားနိုင်ပါသည်။ ဤနေရာတွင် တကယ်လွှဲတင်မည့် ဂဏန်းများကိုသာ ရွေးချယ်၍ ဘောင်ချာ အတည်ပြုထုတ်ပေးပါ။'
                    : 'If you want to absorb/retain excess bets yourself without forwarding, simply deselect them. Only confirmed slips will be deducted as forwarded in the ledger.'}
                </p>
              </div>
            </div>

            {/* Over-Limit / Excess Numbers Selection Table */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  >
                    {draftItems.length > 0 && draftItems.every((i) => i.selected) ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {draftItems.length > 0 && draftItems.every((i) => i.selected)
                        ? (isMyanmar ? 'အားလုံး ဖြုတ်မည် (ကိုယ်တိုင်စားမည်)' : 'Deselect All')
                        : (isMyanmar ? 'အားလုံး ရွေးမည် (ဒိုင်ကြီးတင်မည်)' : 'Select All')}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({activeSelectedItems.length} / {draftItems.length} လုံး ရွေးချယ်ထား)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {excessList.length > 0 && draftItems.length < excessList.length && (
                    <button
                      type="button"
                      onClick={() => setDraftItems(excessList)}
                      className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                    >
                      ပိုနေသောဂဏန်းများ အကုန်ဆွဲယူမည် ({excessList.length} လုံး)
                    </button>
                  )}
                </div>
              </div>

              {draftItems.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {isMyanmar ? 'လက်ရှိတွင် သတ်မှတ်ကန့်သတ်ငွေ ကျော်လွန်နေသော ဂဏန်း မရှိပါ' : 'No over-limit numbers currently'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {isMyanmar
                      ? 'အထက်ပါ အကွက်မှတစ်ဆင့် ဒိုင်ကြီးဆီ လွှဲတင်လိုသော ဂဏန်းများကို စိတ်ကြိုက် ရိုက်ထည့်နိုင်ပါသည်'
                      : 'You can manually add numbers above to forward'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {draftItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${
                        item.selected ? 'bg-indigo-50/40' : 'bg-slate-50/60 opacity-60'
                      }`}
                    >
                      {/* Checkbox & Number */}
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.id)}
                          className="cursor-pointer text-indigo-600"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <span className="font-mono text-base font-black px-2 py-0.5 bg-white border border-slate-300 text-slate-900 rounded-lg shadow-2xs">
                          {item.number}
                        </span>
                        <div className="hidden sm:block text-[11px] text-slate-500">
                          <span>ရောင်းရ: {formatAmount(item.totalSold, settings.currency)}</span>
                          {item.limit > 0 && (
                            <span className="ml-1.5 text-slate-400">(ကန့်သတ်: {formatAmount(item.limit, settings.currency)})</span>
                          )}
                        </div>
                      </div>

                      {/* Forward Amount Input & Delete */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <label className="text-[10px] text-slate-400 block sm:hidden">လွှဲတင်ငွေ</label>
                          <input
                            type="text"
                            value={item.forwardAmount}
                            onChange={(e) => handleAmountChange(item.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            disabled={!item.selected}
                            className="w-28 sm:w-32 h-8 px-2 text-right font-mono font-bold text-xs bg-white rounded-lg border border-slate-300 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Summary Card */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl font-mono text-xs space-y-1.5 shadow-md">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans">ရွေးချယ်ထားသော ဂဏန်း စုစုပေါင်း ({activeSelectedItems.length} လုံး):</span>
                <span className="font-bold">{formatAmount(totalAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="font-sans">ရရှိမည့် ကော်မရှင် ({commissionRate}%):</span>
                <span className="font-bold">+{formatAmount(commissionAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold border-t border-slate-800 pt-1.5 text-sm">
                <span className="font-sans">ဒိုင်ကြီးသို့ အမှန်ပေးချေရမည့်ငွေ:</span>
                <span>{formatAmount(netPaid, settings.currency)}</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={activeSelectedItems.length === 0}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                  activeSelectedItems.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isMyanmar
                    ? `ရွေးချယ်ထားသော (${activeSelectedItems.length} လုံး) စာရင်း ဘောင်ချာထုတ်ပြီး ပြန်တင်မည်`
                    : 'Confirm & Forward Selected'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

