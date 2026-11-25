/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone dedicated modal for viewing and managing copied raw bet texts (မူရင်းစာသားများ)
 * Isolated purely for reference, inspection, and verification.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Trash2,
  Copy,
  Check,
  Search,
  Calendar,
  Layers,
  Clock,
  User,
  Plus,
  AlertCircle,
  Filter,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  ZoomIn,
  Star,
  Eye
} from 'lucide-react';
import {
  RawBetClip,
  getRawClips,
  saveRawClip,
  deleteRawClip,
  deleteRawClipsByRound,
  clearRawClipsByCategory
} from '../utils/rawClipsUtils';
import { formatAmount, parseQuickBetText, getToddWinningNumbers } from '../utils/lotteryUtils';
import { parseTwoDBatchInput } from '../utils/twoDLotteryUtils';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';

interface ClipColorTheme {
  sectionBox: string;
  sectionHeaderBorder: string;
  iconBox: string;
  countBadge: string;
  cardBox: string;
  badge: string;
  dot: string;
}

const COLOR_THEMES: ClipColorTheme[] = [
  {
    sectionBox: 'bg-indigo-50/60 border-indigo-200 border-l-4 border-l-indigo-500',
    sectionHeaderBorder: 'border-indigo-200/70',
    iconBox: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    countBadge: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    cardBox: 'bg-indigo-50/90 border-indigo-200/90 border-l-4 border-l-indigo-500 hover:border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    dot: 'bg-indigo-500',
  },
  {
    sectionBox: 'bg-emerald-50/60 border-emerald-200 border-l-4 border-l-emerald-500',
    sectionHeaderBorder: 'border-emerald-200/70',
    iconBox: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    countBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    cardBox: 'bg-emerald-50/90 border-emerald-200/90 border-l-4 border-l-emerald-500 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-500',
  },
  {
    sectionBox: 'bg-amber-50/65 border-amber-200 border-l-4 border-l-amber-500',
    sectionHeaderBorder: 'border-amber-200/70',
    iconBox: 'bg-amber-100 text-amber-800 border-amber-300',
    countBadge: 'bg-amber-100 text-amber-900 border border-amber-200',
    cardBox: 'bg-amber-50/90 border-amber-200/90 border-l-4 border-l-amber-500 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
  },
  {
    sectionBox: 'bg-rose-50/60 border-rose-200 border-l-4 border-l-rose-500',
    sectionHeaderBorder: 'border-rose-200/70',
    iconBox: 'bg-rose-100 text-rose-700 border-rose-300',
    countBadge: 'bg-rose-100 text-rose-800 border border-rose-200',
    cardBox: 'bg-rose-50/90 border-rose-200/90 border-l-4 border-l-rose-500 hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-500',
  },
  {
    sectionBox: 'bg-sky-50/60 border-sky-200 border-l-4 border-l-sky-500',
    sectionHeaderBorder: 'border-sky-200/70',
    iconBox: 'bg-sky-100 text-sky-700 border-sky-300',
    countBadge: 'bg-sky-100 text-sky-800 border border-sky-200',
    cardBox: 'bg-sky-50/90 border-sky-200/90 border-l-4 border-l-sky-500 hover:border-sky-400',
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    dot: 'bg-sky-500',
  },
  {
    sectionBox: 'bg-purple-50/60 border-purple-200 border-l-4 border-l-purple-500',
    sectionHeaderBorder: 'border-purple-200/70',
    iconBox: 'bg-purple-100 text-purple-700 border-purple-300',
    countBadge: 'bg-purple-100 text-purple-800 border border-purple-200',
    cardBox: 'bg-purple-50/90 border-purple-200/90 border-l-4 border-l-purple-500 hover:border-purple-400',
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    dot: 'bg-purple-500',
  },
  {
    sectionBox: 'bg-teal-50/60 border-teal-200 border-l-4 border-l-teal-500',
    sectionHeaderBorder: 'border-teal-200/70',
    iconBox: 'bg-teal-100 text-teal-700 border-teal-300',
    countBadge: 'bg-teal-100 text-teal-800 border border-teal-200',
    cardBox: 'bg-teal-50/90 border-teal-200/90 border-l-4 border-l-teal-500 hover:border-teal-400',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    dot: 'bg-teal-500',
  },
  {
    sectionBox: 'bg-orange-50/60 border-orange-200 border-l-4 border-l-orange-500',
    sectionHeaderBorder: 'border-orange-200/70',
    iconBox: 'bg-orange-100 text-orange-700 border-orange-300',
    countBadge: 'bg-orange-100 text-orange-800 border border-orange-200',
    cardBox: 'bg-orange-50/90 border-orange-200/90 border-l-4 border-l-orange-500 hover:border-orange-400',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
  },
  {
    sectionBox: 'bg-cyan-50/60 border-cyan-200 border-l-4 border-l-cyan-500',
    sectionHeaderBorder: 'border-cyan-200/70',
    iconBox: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    countBadge: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
    cardBox: 'bg-cyan-50/90 border-cyan-200/90 border-l-4 border-l-cyan-500 hover:border-cyan-400',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    dot: 'bg-cyan-500',
  },
  {
    sectionBox: 'bg-fuchsia-50/60 border-fuchsia-200 border-l-4 border-l-fuchsia-500',
    sectionHeaderBorder: 'border-fuchsia-200/70',
    iconBox: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
    countBadge: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200',
    cardBox: 'bg-fuchsia-50/90 border-fuchsia-200/90 border-l-4 border-l-fuchsia-500 hover:border-fuchsia-400',
    badge: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    dot: 'bg-fuchsia-500',
  },
  {
    sectionBox: 'bg-lime-50/60 border-lime-200 border-l-4 border-l-lime-500',
    sectionHeaderBorder: 'border-lime-200/70',
    iconBox: 'bg-lime-100 text-lime-800 border-lime-300',
    countBadge: 'bg-lime-100 text-lime-900 border border-lime-200',
    cardBox: 'bg-lime-50/90 border-lime-200/90 border-l-4 border-l-lime-500 hover:border-lime-400',
    badge: 'bg-lime-100 text-lime-900 border-lime-300',
    dot: 'bg-lime-500',
  },
  {
    sectionBox: 'bg-blue-50/60 border-blue-200 border-l-4 border-l-blue-500',
    sectionHeaderBorder: 'border-blue-200/70',
    iconBox: 'bg-blue-100 text-blue-700 border-blue-300',
    countBadge: 'bg-blue-100 text-blue-800 border border-blue-200',
    cardBox: 'bg-blue-50/90 border-blue-200/90 border-l-4 border-l-blue-500 hover:border-blue-400',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    dot: 'bg-blue-500',
  },
];

const DATE_BADGE_THEMES: string[] = [
  'bg-slate-100 text-slate-700 border-slate-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-sky-100 text-sky-800 border-sky-300',
  'bg-rose-100 text-rose-800 border-rose-300',
];

const hashText = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
};

interface RawTextClipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoundName3D?: string;
  activeRoundName2D?: string;
  currentDealerMode?: '3d' | '2d' | 'football';
}

const BUSINESS_META: Record<'3d' | '2d' | 'football', { title: string; short: string; headerBadge: string }> = {
  '3d': {
    title: 'အိုးစည်လေး (3D)',
    short: '3D',
    headerBadge: 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200',
  },
  '2d': {
    title: 'ဇီးကွက် (2D)',
    short: '2D',
    headerBadge: 'bg-teal-500/25 border-teal-400/50 text-teal-200',
  },
  'football': {
    title: 'ပစ်တိုင်းထောင် (Football)',
    short: 'FB',
    headerBadge: 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200',
  },
};

export const RawTextClipsModal: React.FC<RawTextClipsModalProps> = ({
  isOpen,
  onClose,
  activeRoundName3D,
  activeRoundName2D,
  currentDealerMode = '3d'
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();

  const activeCategory: '3d' | '2d' | 'football' = currentDealerMode;
  const businessMeta = BUSINESS_META[activeCategory];

  const [clips, setClips] = useState<RawBetClip[]>(() => getRawClips());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'customer' | 'round'>('customer');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [inspectingItem, setInspectingItem] = useState<{ clip: RawBetClip; serialNo: number } | null>(null);

  // Manual Add New Raw Text Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [manualVoucherNo, setManualVoucherNo] = useState('');
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualText, setManualText] = useState('');

  // Sync clips on update events
  useEffect(() => {
    const handleUpdate = () => {
      setClips(getRawClips());
    };
    window.addEventListener('shwe_raw_clips_updated', handleUpdate);
    return () => window.removeEventListener('shwe_raw_clips_updated', handleUpdate);
  }, []);

  // Refresh when opened & reset filters when switching business mode
  useEffect(() => {
    if (isOpen) {
      setClips(getRawClips());
      setInspectingItem(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setDateFilter('all');
    setRoundFilter('all');
    setCustomerFilter('all');
    setSearchQuery('');
    setInspectingItem(null);
    setIsAddingNew(false);
  }, [activeCategory]);

  // Strictly isolate clips to the current active business only
  const businessClips = useMemo(
    () => clips.filter(c => c.category === activeCategory),
    [clips, activeCategory]
  );

  // Extract unique dates, rounds, and customers for filtering within this business
  const availableDates = useMemo(
    () => Array.from(new Set(businessClips.map(c => c.date))).sort().reverse(),
    [businessClips]
  );
  const availableRounds = useMemo(
    () => Array.from(new Set(businessClips.map(c => c.roundName))).filter(Boolean),
    [businessClips]
  );
  const availableCustomers = useMemo(
    () => Array.from(new Set(businessClips.map(c => c.customerName))).filter(Boolean).sort(),
    [businessClips]
  );

  // Assign distinct color themes to customers, rounds, and dates so each is immediately distinguishable
  const customerColorMap = useMemo(() => {
    const map = new Map<string, number>();
    availableCustomers.forEach((cust, idx) => {
      map.set(cust.trim(), idx % COLOR_THEMES.length);
    });
    return map;
  }, [availableCustomers]);

  const roundColorMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRounds.forEach((rnd, idx) => {
      // Offset and stride so round colors differ from customer colors by default
      map.set(rnd, (idx * 5 + 3) % COLOR_THEMES.length);
    });
    return map;
  }, [availableRounds]);

  const dateBadgeMap = useMemo(() => {
    const map = new Map<string, string>();
    availableDates.forEach((d, idx) => {
      map.set(d, DATE_BADGE_THEMES[idx % DATE_BADGE_THEMES.length]);
    });
    return map;
  }, [availableDates]);

  const getCustomerTheme = (name?: string): ClipColorTheme => {
    const key = (name && name.trim()) ? name.trim() : 'အထွေထွေဝယ်သူ';
    const idx = customerColorMap.get(key) ?? (hashText(key) % COLOR_THEMES.length);
    return COLOR_THEMES[idx];
  };

  const getRoundTheme = (roundName?: string, roundId?: string): ClipColorTheme => {
    const key = roundName || roundId || 'အခြားပွဲစဉ်';
    const idx = roundColorMap.get(key) ?? ((hashText(key) + 3) % COLOR_THEMES.length);
    return COLOR_THEMES[idx];
  };

  // Filtered clips (within current business only)
  const filteredClips = businessClips.filter(c => {
    if (dateFilter !== 'all' && c.date !== dateFilter) return false;
    if (roundFilter !== 'all' && c.roundName !== roundFilter) return false;
    if (customerFilter !== 'all' && c.customerName !== customerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchText = (c.rawText || '').toLowerCase().includes(q);
      const matchVoucher = (c.voucherNumber || '').toLowerCase().includes(q);
      const matchCustomer = (c.customerName || '').toLowerCase().includes(q);
      const matchRound = (c.roundName || '').toLowerCase().includes(q);
      if (!matchText && !matchVoucher && !matchCustomer && !matchRound) return false;
    }
    return true;
  });

  const getClipStakeAmount = (clip: RawBetClip): number => {
    if (typeof clip.totalAmountPreview === 'number' && clip.totalAmountPreview > 0) {
      return clip.totalAmountPreview;
    }
    if (clip.rawText && clip.rawText.trim()) {
      if (clip.category === '3d') {
        const parsed = parseQuickBetText(clip.rawText);
        const sum = parsed.items.reduce((s, it) => s + (it.amount || 0), 0);
        if (sum > 0) return sum;
      } else if (clip.category === '2d') {
        const parsed = parseTwoDBatchInput(clip.rawText);
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        const sum = items.reduce((s, it) => s + (it.amount || 0), 0);
        if (sum > 0) return sum;
      }
    }
    return 0;
  };

  const totalFilteredAmount = filteredClips.reduce((sum, c) => sum + getClipStakeAmount(c), 0);

  // Group clips by Customer or Round, with newest vouchers always first (b.timestamp - a.timestamp)
  const groupedSections = useMemo(() => {
    const groups: Record<string, { label: string; subLabel?: string; clips: RawBetClip[] }> = {};
    // Sort all filtered clips: newest bet vouchers on top
    const sorted = [...filteredClips].sort((a, b) => b.timestamp - a.timestamp);

    sorted.forEach(clip => {
      let key = '';
      let label = '';
      let subLabel = '';

      if (groupBy === 'round') {
        key = clip.roundName || clip.roundId || 'အခြားပွဲစဉ်';
        label = key;
        subLabel = clip.date;
      } else {
        key = (clip.customerName && clip.customerName.trim() !== '') ? clip.customerName.trim() : 'အထွေထွေဝယ်သူ';
        label = key;
      }

      if (!groups[key]) {
        groups[key] = { label, subLabel, clips: [] };
      }
      groups[key].clips.push(clip);
    });

    // Sort groups so the group with the most recent voucher appears at the top
    return Object.entries(groups).sort(([, aData], [, bData]) => {
      const timeA = aData.clips[0]?.timestamp || 0;
      const timeB = bData.clips[0]?.timestamp || 0;
      return timeB - timeA;
    });
  }, [filteredClips, groupBy]);

  const clipWinMap = useMemo(() => {
    const map = new Map<string, { isWinner: boolean; winningNumber: string }>();
    const toddMult3D = lottery3D.settings.defaultToddMultiplier ?? 0;

    clips.forEach((clip) => {
      if (clip.category !== '3d' && clip.category !== '2d') return;

      if (clip.category === '3d') {
        const round =
          lottery3D.rounds.find((r) => r.id === clip.roundId) ||
          lottery3D.rounds.find((r) => r.name === clip.roundName) ||
          (clip.roundId === 'manual-3d'
            ? lottery3D.rounds.find((r) => r.drawDate === clip.date && r.status === 'settled')
            : undefined);

        if (!round || round.status !== 'settled' || !round.winningNumber) return;
        const winNum = round.winningNumber.trim().padStart(3, '0');
        if (!/^\d{3}$/.test(winNum)) return;
        const toddSet = toddMult3D > 0 ? new Set(getToddWinningNumbers(winNum)) : null;

        let isWinner = false;
        const linkedVoucher = clip.voucherNumber
          ? lottery3D.vouchers.find(
              (v) =>
                !(v as any).deletedAt &&
                v.status !== 'cancelled' &&
                v.roundId === round.id &&
                v.voucherNo === clip.voucherNumber
            )
          : undefined;

        if (linkedVoucher) {
          isWinner = linkedVoucher.items.some((it) => {
            const num = String(it.number || '').trim().padStart(3, '0');
            return num === winNum || (toddSet?.has(num) ?? false);
          });
        } else if (clip.rawText && clip.rawText.trim()) {
          const parsed = parseQuickBetText(clip.rawText);
          isWinner = parsed.items.some((it) => {
            const num = String(it.number || '').trim().padStart(3, '0');
            return num === winNum || (toddSet?.has(num) ?? false);
          });
        }

        if (isWinner) {
          map.set(clip.id, { isWinner: true, winningNumber: winNum });
        }
      } else if (clip.category === '2d') {
        const round =
          lottery2D.rounds.find((r) => r.id === clip.roundId) ||
          lottery2D.rounds.find((r) => r.name === clip.roundName) ||
          (clip.roundId === 'manual-2d'
            ? lottery2D.rounds.find((r) => r.drawDate === clip.date && r.status === 'settled')
            : undefined);

        if (!round || round.status !== 'settled' || !round.winningNumber) return;
        const winNum = round.winningNumber.trim().padStart(2, '0');
        if (!/^\d{2}$/.test(winNum)) return;

        let isWinner = false;
        const linkedVoucher = clip.voucherNumber
          ? lottery2D.vouchers.find(
              (v) =>
                !(v as any).deletedAt &&
                v.status !== 'cancelled' &&
                v.roundId === round.id &&
                v.voucherNo === clip.voucherNumber
            )
          : undefined;

        if (linkedVoucher) {
          isWinner = linkedVoucher.items.some(
            (it) => String(it.number || '').trim().padStart(2, '0') === winNum
          );
        } else if (clip.rawText && clip.rawText.trim()) {
          const parsed = parseTwoDBatchInput(clip.rawText);
          const parsedItems = Array.isArray(parsed) ? parsed : parsed.items;
          isWinner = parsedItems.some(
            (it) => String(it.number || '').trim().padStart(2, '0') === winNum
          );
        }

        if (isWinner) {
          map.set(clip.id, { isWinner: true, winningNumber: winNum });
        }
      }
    });

    return map;
  }, [
    clips,
    lottery3D.rounds,
    lottery3D.vouchers,
    lottery3D.settings.defaultToddMultiplier,
    lottery2D.rounds,
    lottery2D.vouchers
  ]);

  if (!isOpen) return null;

  const handleCopy = (clip: RawBetClip) => {
    navigator.clipboard.writeText(clip.rawText);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('ဤမူရင်းစာသားမှတ်တမ်းကို ဖျက်ပစ်ရန် သေချာပါသလား?')) {
      deleteRawClip(id);
      setClips(getRawClips());
      if (inspectingItem?.clip.id === id) {
        setInspectingItem(null);
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm(`${businessMeta.title} အတွက် သိမ်းဆည်းထားသော မူရင်းစာသားမှတ်တမ်း အားလုံးကို အပြီးတိုင် ဖျက်ပစ်ရန် သေချာပါသလား?\n(အခြားလုပ်ငန်းများနှင့် ဒိုင်စာရင်း/ဘောင်ချာများအပေါ် သက်ရောက်မှု မရှိပါ)`)) {
      clearRawClipsByCategory(activeCategory);
      setClips(getRawClips());
      setInspectingItem(null);
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;

    const lines = manualText.split('\n').filter(l => l.trim().length > 0);
    const roundName = activeCategory === '3d'
      ? (activeRoundName3D || '3D ပွဲစဉ်')
      : activeCategory === '2d'
      ? (activeRoundName2D || '2D ပွဲစဉ်')
      : 'ပစ်တိုင်းထောင်';

    let computedTotal = 0;
    if (activeCategory === '3d') {
      const parsed = parseQuickBetText(manualText.trim());
      computedTotal = parsed.items.reduce((s, it) => s + (it.amount || 0), 0);
    } else if (activeCategory === '2d') {
      const parsed = parseTwoDBatchInput(manualText.trim());
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      computedTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
    }

    saveRawClip({
      category: activeCategory,
      roundId: `manual-${activeCategory}`,
      roundName: roundName,
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      voucherNumber: manualVoucherNo.trim() || `ဘောင်ချာ (${businessClips.length + 1})`,
      customerName: manualCustomer.trim() || 'အထွေထွေ',
      rawText: manualText.trim(),
      itemCount: lines.length,
      totalAmountPreview: computedTotal > 0 ? computedTotal : undefined,
      source: 'direct_paste'
    });

    setManualText('');
    setManualCustomer('');
    setManualVoucherNo('');
    setIsAddingNew(false);
    setClips(getRawClips());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white px-4 py-3 flex items-center justify-between border-b border-amber-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${businessMeta.headerBadge}`}>
                  {businessMeta.title}
                </span>
                <h3 className="text-sm font-black tracking-tight text-amber-100">
                  မူရင်းစာသား သိမ်းဆည်းရာနေရာ (Raw Texts Archive)
                </h3>
                <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                  {businessClips.length} စောင်
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                {businessMeta.title} သီးသန့် မူရင်းစာသားမှတ်တမ်းများ (အရင်ထိုး ၁ မှ နောက်ဆုံးထိုး အပေါ်ဆုံးစီထားသည်)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNew ? 'ပိတ်မည်' : 'စာသားထည့်မည်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters Bar: Group By, Search, Date, Round, Customer (Isolated to Active Business) */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Group By Toggle: Customer vs Round */}
            <div className="flex items-center bg-white p-0.5 rounded-xl border border-amber-300/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setGroupBy('customer')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  groupBy === 'customer'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-amber-50'
                }`}
                title="ထိုးသားအမည်အလိုက် စုစည်းကြည့်ရှုမည်"
              >
                <User className="w-3 h-3" />
                <span>ထိုးသားအလိုက်</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('round')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  groupBy === 'round'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-amber-50'
                }`}
                title="ပွဲစဉ်အလိုက် စုစည်းကြည့်ရှုမည်"
              >
                <Layers className="w-3 h-3" />
                <span>ပွဲစဉ်အလိုက်</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ရှာဖွေမည်..."
                className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-xl pl-7 pr-2 py-1 w-28 sm:w-36 focus:w-44 transition-all shadow-2xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Date Filter */}
            {availableDates.length > 0 && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl px-2 py-1 shadow-2xs"
              >
                <option value="all">ရက်စွဲအားလုံး ({availableDates.length})</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Round Filter */}
            {availableRounds.length > 0 && (
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl px-2 py-1 shadow-2xs"
              >
                <option value="all">ပွဲစဉ်အားလုံး ({availableRounds.length})</option>
                {availableRounds.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            {availableCustomers.length > 0 && (
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl px-2 py-1 shadow-2xs"
              >
                <option value="all">ထိုးသားအားလုံး ({availableCustomers.length})</option>
                {availableCustomers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-slate-600 text-[11px] font-bold font-mono">
              စုစုပေါင်း: <span className="text-emerald-700 font-black">{formatAmount(totalFilteredAmount, 'Ks')}</span> ({filteredClips.length} စောင်)
            </div>
            {businessClips.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Trash2 className="w-3 h-3" />
                <span>အားလုံးဖျက်မည်</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Add New Form Drawer */}
        {isAddingNew && (
          <form onSubmit={handleSaveManual} className="bg-amber-50/70 border-b border-amber-200 p-3 space-y-2 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">လုပ်ငန်းအမျိုးအစား</label>
                <div className="w-full bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-black text-slate-800">
                  {businessMeta.title}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">ဘောင်ချာအမှတ်</label>
                <input
                  type="text"
                  value={manualVoucherNo}
                  onChange={(e) => setManualVoucherNo(e.target.value)}
                  placeholder="ဥပမာ - V-001"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">ထိုးသားအမည်</label>
                <input
                  type="text"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  placeholder="ဥပမာ - ကိုကျော်ဇေယျ"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-end gap-1">
                <button
                  type="submit"
                  className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  သိမ်းမည်
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ပိတ်
                </button>
              </div>
            </div>

            <div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="မူရင်းစာသားများကို ဤနေရာတွင် ကူးထည့်ပါ..."
                rows={2}
                required
                className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-mono text-slate-900"
              />
            </div>
          </form>
        )}

        {/* Compact Content Body: Grouped by Customer or Round & Sorted Chronologically (Newest first) */}
        <div className="p-2 sm:p-3 overflow-y-auto flex-1 bg-slate-100/60 space-y-3">
          {filteredClips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2 max-w-sm mx-auto shadow-2xs">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <h4 className="text-xs font-bold text-slate-700">မူရင်းစာသားမှတ်တမ်းများ မရှိသေးပါ</h4>
              <p className="text-[11px] text-slate-500">
                ဘောင်ချာများ အတည်ပြုပြီးပါက ဤနေရာတွင် အလိုအလျောက် သပ်သပ်ရပ်ရပ် စုစည်းသိမ်းဆည်းပေးမည် ဖြစ်ပါသည်။
              </p>
            </div>
          ) : (
            groupedSections.map(([groupKey, section]) => {
              const sectionTheme =
                groupBy === 'round'
                  ? getRoundTheme(groupKey, section.clips[0]?.roundId)
                  : getCustomerTheme(groupKey);
              const headerDateBadge = section.subLabel
                ? (dateBadgeMap.get(section.subLabel) || 'bg-white/80 text-slate-700 border-slate-300')
                : '';

              return (
              <div
                key={groupKey}
                className={`border rounded-xl p-2.5 shadow-2xs space-y-2 transition-colors ${sectionTheme.sectionBox}`}
              >
                {/* Section Header */}
                <div className={`flex items-center justify-between border-b pb-1.5 px-0.5 ${sectionTheme.sectionHeaderBorder}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border ${sectionTheme.iconBox}`}>
                      {groupBy === 'round' ? (
                        <Layers className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full inline-block ${sectionTheme.dot}`} />
                          <span>{section.label}</span>
                        </span>
                        {section.subLabel && groupBy === 'round' && (
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${headerDateBadge}`}>
                            {section.subLabel}
                          </span>
                        )}
                      </h4>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${sectionTheme.countBadge}`}>
                      {section.clips.length} စောင်
                    </span>
                    {(() => {
                      const winCount = section.clips.filter((c) => clipWinMap.get(c.id)?.isWinner).length;
                      if (winCount === 0) return null;
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                          <span>{winCount} ပေါက်</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-[10px] text-emerald-800 bg-white/75 border border-emerald-200/80 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <span>နောက်ဆုံးထိုးထားသော ဘောင်ချာများ အပေါ်ဆုံးတွင်ရှိပါသည်</span>
                  </div>
                </div>

                {/* Vouchers Vertical Stack: Clean Dark Boxes Only (Earliest = 1 at bottom, Latest = Top number) */}
                <div className="flex flex-col gap-2">
                  {section.clips.map((clip, idx) => {
                    const serialNo = section.clips.length - idx;
                    const photos = clip.imageUrls && clip.imageUrls.length > 0
                      ? clip.imageUrls
                      : (clip.imageDataUrl ? [clip.imageDataUrl] : []);
                    const hasPhotos = photos.length > 0;
                    const hasText = Boolean(clip.rawText && clip.rawText.trim());
                    const winInfo = clipWinMap.get(clip.id);
                    const stakeAmount = getClipStakeAmount(clip);

                    return (
                      <div
                        key={clip.id}
                        className="flex items-start sm:items-center gap-2"
                      >
                        {/* Serial Number (1 = earliest at bottom, highest = latest at top) */}
                        <span
                          className={`min-w-[2rem] h-8 px-2 rounded-lg border font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                            winInfo?.isWinner
                              ? 'bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-white text-slate-800 border-slate-300'
                          }`}
                          title={`အစဉ် ${serialNo}`}
                        >
                          {serialNo}
                        </span>

                        {/* Dark Raw Text Box Only (Hidden: date, voucherNo, round, time, copy button, business tag) */}
                        <div className="flex-1 min-w-0">
                          {hasText ? (
                            <pre
                              className={`bg-slate-900 text-emerald-300 font-mono text-[11px] sm:text-xs px-3 py-2 rounded-lg whitespace-pre-wrap leading-snug select-all border break-words max-h-44 overflow-y-auto ${
                                winInfo?.isWinner
                                  ? 'border-amber-400 ring-1 ring-amber-400/70'
                                  : 'border-slate-800'
                              }`}
                            >
                              {clip.rawText}
                            </pre>
                          ) : hasPhotos ? (
                            <div
                              onClick={() => setInspectingItem({ clip, serialNo })}
                              className={`bg-slate-900 text-amber-300 font-mono text-xs px-3 py-2 rounded-lg border flex items-center gap-2 cursor-pointer hover:border-amber-400 transition-colors ${
                                winInfo?.isWinner
                                  ? 'border-amber-400 ring-1 ring-amber-400/70'
                                  : 'border-slate-800'
                              }`}
                            >
                              <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="truncate">
                                [ဓာတ်ပုံမှတ်တမ်း {photos.length} ပုံ]
                              </span>
                            </div>
                          ) : (
                            <div className="bg-slate-900 text-slate-400 font-mono text-xs px-3 py-2 rounded-lg border border-slate-800">
                              -
                            </div>
                          )}
                        </div>

                        {/* Right Side: Stake Amount & Eye Detail Button */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-emerald-800 font-mono font-black text-[11px] sm:text-xs whitespace-nowrap shadow-2xs"
                            title="ထိုးကြေး"
                          >
                            {stakeAmount > 0 ? formatAmount(stakeAmount, 'K') : '0 K'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setInspectingItem({ clip, serialNo })}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-300 hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs active:scale-95"
                            title="အသေးစိတ် ဖွင့်ကြည့်မည်"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Full Detail Inspection Modal (Opened via Eye Icon - Preserves all full voucher card details) */}
        {inspectingItem && (() => {
          const { clip, serialNo } = inspectingItem;
          const cardTheme =
            groupBy === 'customer'
              ? getRoundTheme(clip.roundName, clip.roundId)
              : getCustomerTheme(clip.customerName);
          const dateBadgeCls =
            dateBadgeMap.get(clip.date) || 'bg-white/80 text-slate-700 border-slate-300';
          const photos = clip.imageUrls && clip.imageUrls.length > 0
            ? clip.imageUrls
            : (clip.imageDataUrl ? [clip.imageDataUrl] : []);
          const hasPhotos = photos.length > 0;
          const hasText = Boolean(clip.rawText && clip.rawText.trim());
          const sourceBadge = hasPhotos && !hasText
            ? { label: 'ဓာတ်ပုံ', cls: 'bg-purple-100 text-purple-800 border-purple-300' }
            : clip.source === 'telegram'
            ? { label: 'Telegram', cls: 'bg-sky-100 text-sky-800 border-sky-300' }
            : clip.source === 'batch_paste' || clip.source === 'direct_paste'
            ? { label: 'ကူးယူစာသား', cls: 'bg-amber-100 text-amber-900 border-amber-300' }
            : clip.source === 'manual'
            ? { label: 'လက်ရိုက်', cls: 'bg-white/90 text-slate-700 border-slate-300' }
            : hasPhotos
            ? { label: 'ဓာတ်ပုံ', cls: 'bg-purple-100 text-purple-800 border-purple-300' }
            : null;
          const winInfo = clipWinMap.get(clip.id);
          const stakeAmount = getClipStakeAmount(clip);

          return (
            <div
              onClick={() => setInspectingItem(null)}
              className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-lg rounded-2xl border p-4 space-y-3 shadow-2xl bg-white ${
                  winInfo?.isWinner
                    ? 'ring-2 ring-amber-400 border-amber-400'
                    : cardTheme.cardBox
                }`}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono font-black">
                      #{serialNo}
                    </span>
                    <span className="px-2 py-0.5 bg-white text-amber-900 border border-amber-300 rounded-md text-xs font-black font-mono shadow-2xs">
                      {clip.voucherNumber || `ဘောင်ချာ #${serialNo}`}
                    </span>
                    {winInfo?.isWinner && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        <span>{winInfo.winningNumber}</span>
                      </span>
                    )}
                    {sourceBadge && (
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${sourceBadge.cls}`}>
                        {sourceBadge.label}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingItem(null)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title="ပိတ်မည်"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Row: Customer, Round, Date, Time, Category */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {clip.customerName && (
                    <span className={`px-2 py-0.5 rounded-md border font-black flex items-center gap-1 ${cardTheme.badge}`}>
                      <User className="w-3 h-3 shrink-0" />
                      <span>{clip.customerName}</span>
                    </span>
                  )}
                  {clip.roundName && (
                    <span className={`px-2 py-0.5 rounded-md border font-bold font-mono flex items-center gap-1 ${cardTheme.badge}`}>
                      <Layers className="w-3 h-3 shrink-0" />
                      <span>{clip.roundName}</span>
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded border font-mono font-bold flex items-center gap-1 ${dateBadgeCls}`}>
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{clip.date}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-mono font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{clip.time || new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    clip.category === '3d' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                    clip.category === '2d' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {clip.category.toUpperCase()}
                  </span>
                </div>

                {/* Photos if present */}
                {hasPhotos && (
                  <div className={`grid gap-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {photos.map((photoSrc, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setPreviewImage(photoSrc)}
                        className="group relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900 hover:border-amber-500 transition-all cursor-pointer text-left"
                        title="ဓာတ်ပုံ အကြီးချဲ့ကြည့်ရန် နှိပ်ပါ"
                      >
                        <img
                          src={photoSrc}
                          alt={`${clip.voucherNumber || 'Slip'} ဓာတ်ပုံ ${pIdx + 1}`}
                          className="w-full max-h-56 object-contain mx-auto bg-slate-950"
                        />
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold flex items-center gap-1 opacity-90 group-hover:opacity-100 shadow-xs">
                          <ZoomIn className="w-3 h-3 text-amber-300" />
                          <span>အကြီးကြည့်မည်</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Full Raw Text Box */}
                {hasText && (
                  <pre className="bg-slate-900 text-emerald-300 font-mono text-xs px-3 py-2.5 rounded-xl whitespace-pre-wrap leading-relaxed select-all border border-slate-800 break-words max-h-60 overflow-y-auto">
                    {clip.rawText}
                  </pre>
                )}

                {/* Footer Actions: Copy, View Photo, Stake Amount, Delete */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <div className="flex items-center gap-2">
                    {hasText && (
                      <button
                        type="button"
                        onClick={() => handleCopy(clip)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          copiedId === clip.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs'
                        }`}
                      >
                        {copiedId === clip.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span>ကူးယူပြီး</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>စာသားကူးမည်</span>
                          </>
                        )}
                      </button>
                    )}
                    {hasPhotos && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(photos[0])}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>ဓာတ်ပုံကြည့်မည်</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg">
                      {formatAmount(stakeAmount, 'Ks')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(clip.id)}
                      className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      title="ဖျက်မည်"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ဖျက်မည်</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Lightbox Preview for Archived Photo Slips */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="self-end p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 shadow-lg cursor-pointer"
                title="ပိတ်မည်"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage}
                alt="မူရင်း ဓာတ်ပုံမှတ်တမ်း"
                className="max-w-full max-h-[82vh] object-contain rounded-xl border border-slate-700 shadow-2xl bg-black"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
