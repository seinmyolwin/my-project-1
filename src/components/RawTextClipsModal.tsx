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
  Eye,
  ExternalLink,
  ArchiveRestore
} from 'lucide-react';
import {
  RawBetClip,
  getRawClips,
  saveRawClip,
  deleteRawClip,
  deleteRawClipsByRound,
  deleteRawClipsByDateRange,
  clearRawClipsByCategory,
  findRawClipForVoucher
} from '../utils/rawClipsUtils';
import {
  findMissingVouchersFromRawClips,
  rebuildVouchersFromRawClips
} from '../utils/rawClipRecovery';
import { formatAmount, parseQuickBetText, getToddWinningNumbers } from '../utils/lotteryUtils';
import { parseTwoDBatchInput } from '../utils/twoDLotteryUtils';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { Voucher, TwoDVoucher, FootballSlip } from '../types';

interface ClipColorTheme {
  sectionBox: string;
  sectionHeaderBorder: string;
  iconBox: string;
  countBadge: string;
  cardBox: string;
  badge: string;
  dot: string;
  darkSectionBox: string;
  darkCanvasBox: string;
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
    darkSectionBox: 'bg-indigo-950/80 border-indigo-500/40 border-l-4 border-l-indigo-400',
    darkCanvasBox: 'bg-indigo-950/60 border-indigo-500/25',
  },
  {
    sectionBox: 'bg-emerald-50/60 border-emerald-200 border-l-4 border-l-emerald-500',
    sectionHeaderBorder: 'border-emerald-200/70',
    iconBox: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    countBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    cardBox: 'bg-emerald-50/90 border-emerald-200/90 border-l-4 border-l-emerald-500 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-500',
    darkSectionBox: 'bg-emerald-950/80 border-emerald-500/40 border-l-4 border-l-emerald-400',
    darkCanvasBox: 'bg-emerald-950/60 border-emerald-500/25',
  },
  {
    sectionBox: 'bg-amber-50/65 border-amber-200 border-l-4 border-l-amber-500',
    sectionHeaderBorder: 'border-amber-200/70',
    iconBox: 'bg-amber-100 text-amber-800 border-amber-300',
    countBadge: 'bg-amber-100 text-amber-900 border border-amber-200',
    cardBox: 'bg-amber-50/90 border-amber-200/90 border-l-4 border-l-amber-500 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
    darkSectionBox: 'bg-amber-950/75 border-amber-500/40 border-l-4 border-l-amber-400',
    darkCanvasBox: 'bg-amber-950/55 border-amber-500/25',
  },
  {
    sectionBox: 'bg-rose-50/60 border-rose-200 border-l-4 border-l-rose-500',
    sectionHeaderBorder: 'border-rose-200/70',
    iconBox: 'bg-rose-100 text-rose-700 border-rose-300',
    countBadge: 'bg-rose-100 text-rose-800 border border-rose-200',
    cardBox: 'bg-rose-50/90 border-rose-200/90 border-l-4 border-l-rose-500 hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-500',
    darkSectionBox: 'bg-rose-950/80 border-rose-500/40 border-l-4 border-l-rose-400',
    darkCanvasBox: 'bg-rose-950/60 border-rose-500/25',
  },
  {
    sectionBox: 'bg-sky-50/60 border-sky-200 border-l-4 border-l-sky-500',
    sectionHeaderBorder: 'border-sky-200/70',
    iconBox: 'bg-sky-100 text-sky-700 border-sky-300',
    countBadge: 'bg-sky-100 text-sky-800 border border-sky-200',
    cardBox: 'bg-sky-50/90 border-sky-200/90 border-l-4 border-l-sky-500 hover:border-sky-400',
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    dot: 'bg-sky-500',
    darkSectionBox: 'bg-sky-950/80 border-sky-500/40 border-l-4 border-l-sky-400',
    darkCanvasBox: 'bg-sky-950/60 border-sky-500/25',
  },
  {
    sectionBox: 'bg-purple-50/60 border-purple-200 border-l-4 border-l-purple-500',
    sectionHeaderBorder: 'border-purple-200/70',
    iconBox: 'bg-purple-100 text-purple-700 border-purple-300',
    countBadge: 'bg-purple-100 text-purple-800 border border-purple-200',
    cardBox: 'bg-purple-50/90 border-purple-200/90 border-l-4 border-l-purple-500 hover:border-purple-400',
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    dot: 'bg-purple-500',
    darkSectionBox: 'bg-purple-950/80 border-purple-500/40 border-l-4 border-l-purple-400',
    darkCanvasBox: 'bg-purple-950/60 border-purple-500/25',
  },
  {
    sectionBox: 'bg-teal-50/60 border-teal-200 border-l-4 border-l-teal-500',
    sectionHeaderBorder: 'border-teal-200/70',
    iconBox: 'bg-teal-100 text-teal-700 border-teal-300',
    countBadge: 'bg-teal-100 text-teal-800 border border-teal-200',
    cardBox: 'bg-teal-50/90 border-teal-200/90 border-l-4 border-l-teal-500 hover:border-teal-400',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    dot: 'bg-teal-500',
    darkSectionBox: 'bg-teal-950/80 border-teal-500/40 border-l-4 border-l-teal-400',
    darkCanvasBox: 'bg-teal-950/60 border-teal-500/25',
  },
  {
    sectionBox: 'bg-orange-50/60 border-orange-200 border-l-4 border-l-orange-500',
    sectionHeaderBorder: 'border-orange-200/70',
    iconBox: 'bg-orange-100 text-orange-700 border-orange-300',
    countBadge: 'bg-orange-100 text-orange-800 border border-orange-200',
    cardBox: 'bg-orange-50/90 border-orange-200/90 border-l-4 border-l-orange-500 hover:border-orange-400',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
    darkSectionBox: 'bg-orange-950/75 border-orange-500/40 border-l-4 border-l-orange-400',
    darkCanvasBox: 'bg-orange-950/55 border-orange-500/25',
  },
  {
    sectionBox: 'bg-cyan-50/60 border-cyan-200 border-l-4 border-l-cyan-500',
    sectionHeaderBorder: 'border-cyan-200/70',
    iconBox: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    countBadge: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
    cardBox: 'bg-cyan-50/90 border-cyan-200/90 border-l-4 border-l-cyan-500 hover:border-cyan-400',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    dot: 'bg-cyan-500',
    darkSectionBox: 'bg-cyan-950/80 border-cyan-500/40 border-l-4 border-l-cyan-400',
    darkCanvasBox: 'bg-cyan-950/60 border-cyan-500/25',
  },
  {
    sectionBox: 'bg-fuchsia-50/60 border-fuchsia-200 border-l-4 border-l-fuchsia-500',
    sectionHeaderBorder: 'border-fuchsia-200/70',
    iconBox: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
    countBadge: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200',
    cardBox: 'bg-fuchsia-50/90 border-fuchsia-200/90 border-l-4 border-l-fuchsia-500 hover:border-fuchsia-400',
    badge: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    dot: 'bg-fuchsia-500',
    darkSectionBox: 'bg-fuchsia-950/80 border-fuchsia-500/40 border-l-4 border-l-fuchsia-400',
    darkCanvasBox: 'bg-fuchsia-950/60 border-fuchsia-500/25',
  },
  {
    sectionBox: 'bg-lime-50/60 border-lime-200 border-l-4 border-l-lime-500',
    sectionHeaderBorder: 'border-lime-200/70',
    iconBox: 'bg-lime-100 text-lime-800 border-lime-300',
    countBadge: 'bg-lime-100 text-lime-900 border border-lime-200',
    cardBox: 'bg-lime-50/90 border-lime-200/90 border-l-4 border-l-lime-500 hover:border-lime-400',
    badge: 'bg-lime-100 text-lime-900 border-lime-300',
    dot: 'bg-lime-500',
    darkSectionBox: 'bg-lime-950/75 border-lime-500/40 border-l-4 border-l-lime-400',
    darkCanvasBox: 'bg-lime-950/55 border-lime-500/25',
  },
  {
    sectionBox: 'bg-blue-50/60 border-blue-200 border-l-4 border-l-blue-500',
    sectionHeaderBorder: 'border-blue-200/70',
    iconBox: 'bg-blue-100 text-blue-700 border-blue-300',
    countBadge: 'bg-blue-100 text-blue-800 border border-blue-200',
    cardBox: 'bg-blue-50/90 border-blue-200/90 border-l-4 border-l-blue-500 hover:border-blue-400',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    dot: 'bg-blue-500',
    darkSectionBox: 'bg-blue-950/80 border-blue-500/40 border-l-4 border-l-blue-400',
    darkCanvasBox: 'bg-blue-950/60 border-blue-500/25',
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

export interface LinkedVoucherNavigationTarget {
  category: '3d' | '2d' | 'football';
  voucherNumber: string;
  roundId?: string;
  date?: string;
  voucher3D?: Voucher;
  voucher2D?: TwoDVoucher;
  slipFB?: FootballSlip;
}

const getColumnChunks = <T,>(items: T[], cols: number): T[][] => {
  const safeCols = Math.max(1, cols);
  const total = items.length;
  const baseSize = Math.floor(total / safeCols);
  const remainder = total % safeCols;
  const result: T[][] = [];
  let cursor = 0;
  for (let colIdx = 0; colIdx < safeCols; colIdx++) {
    const size = baseSize + (colIdx < remainder ? 1 : 0);
    if (size > 0) {
      result.push(items.slice(cursor, cursor + size));
      cursor += size;
    }
  }
  return result;
};

export interface FocusedRawClipTarget {
  category: '3d' | '2d' | 'football';
  voucherNumber: string;
  roundId?: string;
  date?: string;
  customerName?: string;
  slipId?: string;
  key: number;
}

interface RawTextClipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoundName3D?: string;
  activeRoundName2D?: string;
  currentDealerMode?: '3d' | '2d' | 'football';
  onNavigateToVoucher?: (target: LinkedVoucherNavigationTarget) => void;
  focusedClipRequest?: FocusedRawClipTarget | null;
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
  currentDealerMode = '3d',
  onNavigateToVoucher,
  focusedClipRequest
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [colCount, setColCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 768) return 2;
    return 1;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateCols = () => {
      if (window.innerWidth >= 1024) setColCount(3);
      else if (window.innerWidth >= 768) setColCount(2);
      else setColCount(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

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
  const [highlightedClipId, setHighlightedClipId] = useState<string | null>(null);

  // Date-based Delete Modal State
  const [isDateDeleteOpen, setIsDateDeleteOpen] = useState(false);
  const [deleteStartDate, setDeleteStartDate] = useState('');
  const [deleteEndDate, setDeleteEndDate] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Manual Add New Raw Text Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [manualVoucherNo, setManualVoucherNo] = useState('');
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualText, setManualText] = useState('');

  // Missing Ledger Voucher Reconstruction State
  const [confirmRebuildMissing, setConfirmRebuildMissing] = useState(false);
  const [isRebuildingMissing, setIsRebuildingMissing] = useState(false);
  const [rebuildFeedback, setRebuildFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync clips on update events
  useEffect(() => {
    const handleUpdate = () => {
      setClips(getRawClips());
    };
    window.addEventListener('shwe_raw_clips_updated', handleUpdate);
    return () => window.removeEventListener('shwe_raw_clips_updated', handleUpdate);
  }, []);

  // Refresh when opened; if opened via a voucher link, focus & open that exact clip
  useEffect(() => {
    if (!isOpen) return;
    const latest = getRawClips();
    setClips(latest);

    if (focusedClipRequest && focusedClipRequest.category === activeCategory) {
      const matched = findRawClipForVoucher(
        focusedClipRequest.category,
        focusedClipRequest.voucherNumber,
        {
          roundId: focusedClipRequest.roundId,
          date: focusedClipRequest.date,
          customerName: focusedClipRequest.customerName,
          slipId: focusedClipRequest.slipId,
          clips: latest
        }
      );
      if (matched) {
        setDateFilter('all');
        setRoundFilter('all');
        setCustomerFilter('all');
        setSearchQuery('');
        setGroupBy('customer');
        setHighlightedClipId(matched.id);

        const custKey = (matched.customerName && matched.customerName.trim() !== '')
          ? matched.customerName.trim()
          : 'အထွေထွေဝယ်သူ';
        const customerSectionClips = latest
          .filter((c) => {
            if (c.category !== activeCategory) return false;
            const k = (c.customerName && c.customerName.trim() !== '') ? c.customerName.trim() : 'အထွေထွေဝယ်သူ';
            return k === custKey;
          })
          .sort((a, b) => a.timestamp - b.timestamp);
        const idx = customerSectionClips.findIndex((c) => c.id === matched.id);
        const serialNo = idx >= 0 ? idx + 1 : 1;
        setInspectingItem({ clip: matched, serialNo });
        return;
      }
    }

    setInspectingItem(null);
    setHighlightedClipId(null);
  }, [isOpen, focusedClipRequest?.key, activeCategory]);

  useEffect(() => {
    setDateFilter('all');
    setRoundFilter('all');
    setCustomerFilter('all');
    setSearchQuery('');
    setIsAddingNew(false);
    setIsDateDeleteOpen(false);
    setDeleteFeedback(null);
    setConfirmRebuildMissing(false);
    setRebuildFeedback(null);
  }, [activeCategory]);

  // Strictly isolate clips to the current active business only
  const businessClips = useMemo(
    () => clips.filter(c => c.category === activeCategory),
    [clips, activeCategory]
  );

  // Detect raw clips in active business whose customer vouchers are missing from ledger
  const missingRawScan = useMemo(() => {
    if (!isOpen || (activeCategory !== '2d' && activeCategory !== '3d')) return null;
    return findMissingVouchersFromRawClips(activeCategory);
  }, [isOpen, activeCategory, clips, lottery2D.vouchers, lottery3D.vouchers]);

  // Extract unique dates, rounds, and customers for filtering within this business
  const availableDates = useMemo(
    () => Array.from(new Set(businessClips.map(c => c.date).filter(Boolean))).sort().reverse(),
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

  // Group clips by Customer or Round, ordered sequentially 1..N (a.timestamp - b.timestamp)
  const groupedSections = useMemo(() => {
    const groups: Record<string, { label: string; subLabel?: string; clips: RawBetClip[] }> = {};
    // Sort all filtered clips sequentially from #1 (oldest) to #N (newest)
    const sorted = [...filteredClips].sort((a, b) => a.timestamp - b.timestamp);

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
      const timeA = aData.clips[aData.clips.length - 1]?.timestamp || 0;
      const timeB = bData.clips[bData.clips.length - 1]?.timestamp || 0;
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

  const matchingDateDeleteCount = useMemo(() => {
    if (!deleteStartDate || !deleteEndDate) return 0;
    const safeStart = deleteStartDate <= deleteEndDate ? deleteStartDate : deleteEndDate;
    const safeEnd = deleteStartDate <= deleteEndDate ? deleteEndDate : deleteStartDate;
    return businessClips.filter(
      (c) => typeof c.date === 'string' && c.date >= safeStart && c.date <= safeEnd
    ).length;
  }, [businessClips, deleteStartDate, deleteEndDate]);

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
      setDeleteFeedback(`${businessMeta.title} မူရင်းစာသား အားလုံးကို ဖျက်သိမ်းပြီးပါပြီ ✓`);
      setTimeout(() => setDeleteFeedback(null), 3500);
    }
  };

  const handleOpenDateDelete = () => {
    const defaultDate =
      dateFilter !== 'all'
        ? dateFilter
        : availableDates[0] || new Date().toLocaleDateString('en-CA');
    setDeleteStartDate(defaultDate);
    setDeleteEndDate(defaultDate);
    setIsDateDeleteOpen(true);
  };

  const handleConfirmDateDelete = () => {
    if (!deleteStartDate || !deleteEndDate || matchingDateDeleteCount === 0) return;
    const safeStart = deleteStartDate <= deleteEndDate ? deleteStartDate : deleteEndDate;
    const safeEnd = deleteStartDate <= deleteEndDate ? deleteEndDate : deleteStartDate;
    const deletedCount = deleteRawClipsByDateRange(activeCategory, safeStart, safeEnd);
    setClips(getRawClips());
    setInspectingItem(null);
    setIsDateDeleteOpen(false);
    if (dateFilter !== 'all' && dateFilter >= safeStart && dateFilter <= safeEnd) {
      setDateFilter('all');
    }
    const rangeLabel = safeStart === safeEnd ? safeStart : `${safeStart} ~ ${safeEnd}`;
    setDeleteFeedback(`${rangeLabel} အတွင်း မူရင်းစာသား ${deletedCount} စောင် ဖျက်သိမ်းပြီးပါပြီ ✓`);
    setTimeout(() => setDeleteFeedback(null), 3500);
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

  const handleRebuildMissingVouchers = async () => {
    if (activeCategory !== '2d' && activeCategory !== '3d') return;
    setIsRebuildingMissing(true);
    setRebuildFeedback(null);
    try {
      const res = await rebuildVouchersFromRawClips({ category: activeCategory });
      if (res.success) {
        setRebuildFeedback({
          type: 'success',
          text: `${res.message}။ စာမျက်နှာ ပြန်လည်ဖွင့်နေပါသည်...`
        });
        setConfirmRebuildMissing(false);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setRebuildFeedback({ type: 'error', text: res.message });
        setIsRebuildingMissing(false);
      }
    } catch (err: any) {
      setRebuildFeedback({
        type: 'error',
        text: err?.message || 'ဘောင်ချာပြန်သွင်းရာတွင် အမှားရှိပါသည်'
      });
      setIsRebuildingMissing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        
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

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-slate-600 text-[11px] font-bold font-mono">
              စုစုပေါင်း: <span className="text-emerald-700 font-black">{formatAmount(totalFilteredAmount, 'Ks')}</span> ({filteredClips.length} စောင်)
            </div>
            {businessClips.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleOpenDateDelete}
                  className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="ရက်စွဲရွေးချယ်ပြီး မူရင်းစာသားများ ဖျက်ပစ်ရန်"
                >
                  <Calendar className="w-3 h-3" />
                  <span>ရက်ရွေးဖျက်မည်</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>အားလုံးဖျက်မည်</span>
                </button>
              </>
            )}
          </div>
        </div>

        {deleteFeedback && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{deleteFeedback}</span>
            </span>
            <button
              type="button"
              onClick={() => setDeleteFeedback(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {rebuildFeedback && (
          <div
            className={`border-b px-3 py-1.5 text-xs font-bold flex items-center justify-between shrink-0 ${
              rebuildFeedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {rebuildFeedback.type === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span>{rebuildFeedback.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setRebuildFeedback(null)}
              className="hover:opacity-75 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {missingRawScan && missingRawScan.totalParseableClips > 0 && (
          <div className="bg-amber-50 border-b border-amber-300 px-3 py-2 text-xs text-amber-950 shrink-0 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <ArchiveRestore className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Ledger ထဲတွင် ပျောက်နေသော မူရင်းစာသား ထိုးသားဘောင်ချာ{' '}
                  <span className="font-black text-amber-900">
                    {missingRawScan.totalParseableClips} စောင် ({formatAmount(missingRawScan.totalAmount, 'Ks')})
                  </span>{' '}
                  တွေ့ရှိထားပါသည်
                </span>
              </div>
              {!confirmRebuildMissing && (
                <button
                  type="button"
                  onClick={() => setConfirmRebuildMissing(true)}
                  disabled={isRebuildingMissing}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] cursor-pointer shrink-0 shadow-2xs"
                >
                  မူရင်းစာသားမှ ပျောက်နေသော ထိုးသားဘောင်ချာ {missingRawScan.totalParseableClips} စောင် စာရင်းထဲ ပြန်သွင်းမည်
                </button>
              )}
            </div>
            {confirmRebuildMissing && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-amber-200">
                <span className="text-[11px] font-bold text-amber-900">
                  ဤမူရင်းစာသားများမှ {businessMeta.title} ထိုးသားဘောင်ချာ {missingRawScan.totalParseableClips} စောင်ကို Ledger ထဲသို့ ပြန်သွင်းရန် သေချာပါသလား? (မှတ်ချက် — အထက်တင်ကြေး စလစ်များ မပါဝင်ပါ)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmRebuildMissing(false)}
                    disabled={isRebuildingMissing}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={handleRebuildMissingVouchers}
                    disabled={isRebuildingMissing}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                  >
                    {isRebuildingMissing ? 'ပြန်သွင်းနေသည်...' : 'အတည်ပြု ပြန်သွင်းမည်'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* Chat-Stream Content Body on Dark Background */}
        <div className="p-2.5 sm:p-3 overflow-y-auto flex-1 bg-slate-950 space-y-3">
          {filteredClips.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2 max-w-sm mx-auto">
              <FileText className="w-10 h-10 mx-auto text-slate-500" />
              <h4 className="text-xs font-bold text-slate-200">မူရင်းစာသားမှတ်တမ်းများ မရှိသေးပါ</h4>
              <p className="text-[11px] text-slate-400">
                ဘောင်ချာများ အတည်ပြုပြီးပါက ဤနေရာတွင် အလိုအလျောက် သပ်သပ်ရပ်ရပ် စုစည်းသိမ်းဆည်းပေးမည် ဖြစ်ပါသည်။
              </p>
            </div>
          ) : (
            groupedSections.map(([groupKey, section]) => {
              const sectionTheme =
                groupBy === 'round'
                  ? getRoundTheme(groupKey, section.clips[0]?.roundId)
                  : getCustomerTheme(groupKey);

              return (
              <div
                key={groupKey}
                className={`border rounded-xl p-2.5 space-y-2.5 ${sectionTheme.darkSectionBox}`}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 px-0.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border bg-slate-800 border-slate-700 text-amber-300">
                      {groupBy === 'round' ? (
                        <Layers className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-100 flex items-center gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full inline-block ${sectionTheme.dot}`} />
                          <span>{section.label}</span>
                        </span>
                        {section.subLabel && groupBy === 'round' && (
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border bg-slate-800 text-slate-300 border-slate-700">
                            {section.subLabel}
                          </span>
                        )}
                      </h4>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-200 border border-slate-700">
                      {section.clips.length} စောင်
                    </span>
                    {(() => {
                      const winCount = section.clips.filter((c) => clipWinMap.get(c.id)?.isWinner).length;
                      if (winCount === 0) return null;
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 text-[10px] font-black">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                          <span>{winCount} ပေါက်</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                    အစဉ်လိုက် ၁ မှ စ၍ ကော်လံအလိုက် စီထားပါသည်
                  </div>
                </div>

                {/* Incoming Chat-Message Style Stream arranged top-to-bottom per column (1..5 left, 6..10 right) */}
                <div className={`rounded-xl p-2.5 border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2.5 items-start ${sectionTheme.darkCanvasBox}`}>
                  {getColumnChunks(
                    section.clips.map((clip, idx) => ({ clip, serialNo: idx + 1 })),
                    colCount
                  ).map((columnItems, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-2.5 min-w-0">
                      {columnItems.map(({ clip, serialNo }) => {
                        const photos = clip.imageUrls && clip.imageUrls.length > 0
                          ? clip.imageUrls
                          : (clip.imageDataUrl ? [clip.imageDataUrl] : []);
                        const hasPhotos = photos.length > 0;
                        const hasText = Boolean(clip.rawText && clip.rawText.trim());
                        const winInfo = clipWinMap.get(clip.id);
                        const stakeAmount = getClipStakeAmount(clip);
                        const isHighlighted = highlightedClipId === clip.id;

                        return (
                          <div
                            key={clip.id}
                            className={`flex items-start justify-between gap-2 min-w-0 w-full rounded-xl p-1 -m-1 transition-all ${
                              isHighlighted ? 'ring-2 ring-amber-400 bg-amber-500/15' : ''
                            }`}
                          >
                            {/* Left-aligned: Serial Number + Raw Text Bubble */}
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              <span
                                className={`w-6 h-6 rounded-full border font-mono font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                                  winInfo?.isWinner
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                                    : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                                }`}
                                title={`အစဉ် ${serialNo}`}
                              >
                                {serialNo}
                              </span>

                              {hasText ? (
                                <div
                                  className={`rounded-2xl rounded-tl-xs px-3 py-1.5 border w-fit max-w-full min-w-0 ${
                                    winInfo?.isWinner
                                      ? 'bg-amber-950/40 border-amber-400/70'
                                      : 'bg-zinc-900 border-zinc-800'
                                  }`}
                                >
                                  {winInfo?.isWinner && (
                                    <div className="text-[10px] font-mono font-black text-amber-300 mb-0.5">
                                      #{serialNo} ★ ပေါက်
                                    </div>
                                  )}
                                  <pre className="text-emerald-300 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words select-all">
                                    {clip.rawText}
                                  </pre>
                                </div>
                              ) : hasPhotos ? (
                                <button
                                  type="button"
                                  onClick={() => setInspectingItem({ clip, serialNo })}
                                  className={`rounded-2xl rounded-tl-xs px-3 py-1.5 border flex items-center gap-1.5 cursor-pointer transition-colors text-left w-fit max-w-full min-w-0 ${
                                    winInfo?.isWinner
                                      ? 'bg-amber-950/40 border-amber-400/70 text-amber-200'
                                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-amber-300'
                                  }`}
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="font-mono text-[11px] font-bold truncate">
                                    [ဓာတ်ပုံ {photos.length} ပုံ]
                                  </span>
                                </button>
                              ) : (
                                <div className="rounded-2xl rounded-tl-xs px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[11px]">
                                  -
                                </div>
                              )}
                            </div>

                            {/* Right-aligned: Stake Amount & Eye Detail Button */}
                            <div className="flex items-center gap-1 shrink-0 pt-0.5 ml-auto">
                              <span
                                className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono font-bold text-[10px] whitespace-nowrap"
                                title="ထိုးကြေး"
                              >
                                {stakeAmount > 0 ? formatAmount(stakeAmount, 'K') : '0 K'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectingItem({ clip, serialNo })}
                                className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-amber-300 border border-zinc-700 hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                                title="အသေးစိတ် ဖွင့်ကြည့်မည်"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
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

          // Resolve matching real voucher / slip in the ledger so user can jump directly to it
          const vNo = (clip.voucherNumber || '').trim();
          const vNoLower = vNo.toLowerCase();
          let linkedVoucher: LinkedVoucherNavigationTarget | null = null;
          if (vNoLower) {
            if (clip.category === '3d') {
              const candidates = lottery3D.vouchers.filter((v) => v.voucherNo.trim().toLowerCase() === vNoLower);
              const matched =
                candidates.find((v) => clip.roundId && v.roundId === clip.roundId) ||
                candidates.find((v) => v.customerName === clip.customerName) ||
                candidates[0];
              if (matched) {
                linkedVoucher = {
                  category: '3d',
                  voucherNumber: matched.voucherNo,
                  roundId: matched.roundId,
                  voucher3D: matched
                };
              }
            } else if (clip.category === '2d') {
              const candidates = lottery2D.vouchers.filter((v) => v.voucherNo.trim().toLowerCase() === vNoLower);
              const matched =
                candidates.find((v) => clip.roundId && v.roundId === clip.roundId) ||
                candidates.find((v) => v.customerName === clip.customerName) ||
                candidates[0];
              if (matched) {
                linkedVoucher = {
                  category: '2d',
                  voucherNumber: matched.voucherNo,
                  roundId: matched.roundId,
                  voucher2D: matched
                };
              }
            } else if (clip.category === 'football') {
              const candidates = football.slips.filter(
                (s) => s.slipNo.trim().toLowerCase() === vNoLower || `fb-${s.id}`.toLowerCase() === vNoLower
              );
              const matched =
                candidates.find((s) => clip.date && s.roundDate === clip.date) ||
                candidates.find((s) => s.customerName === clip.customerName) ||
                candidates[0];
              if (matched) {
                linkedVoucher = {
                  category: 'football',
                  voucherNumber: matched.slipNo,
                  date: matched.roundDate,
                  slipFB: matched
                };
              }
            }
          }

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
                    {linkedVoucher && onNavigateToVoucher ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingItem(null);
                          onNavigateToVoucher(linkedVoucher!);
                        }}
                        className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 rounded-md text-xs font-black font-mono shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        title="ထိုးကြေးမှတ်တမ်းရှိ တကယ့်ဘောင်ချာသို့ တိုက်ရိုက်သွားကြည့်မည်"
                      >
                        <span className="underline decoration-indigo-200 underline-offset-2">
                          {linkedVoucher.voucherNumber}
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 bg-white text-amber-900 border border-amber-300 rounded-md text-xs font-black font-mono shadow-2xs">
                        {clip.voucherNumber || `ဘောင်ချာ #${serialNo}`}
                      </span>
                    )}
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

        {/* Date Range Delete Confirmation Modal */}
        {isDateDeleteOpen && (
          <div
            onClick={() => setIsDateDeleteOpen(false)}
            className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="bg-rose-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm">
                  <Calendar className="w-4 h-4 text-rose-300" />
                  <span>{businessMeta.title} — ရက်ရွေး၍ ဖျက်မည်</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDateDeleteOpen(false)}
                  className="text-rose-200 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Quick Select Available Dates */}
                {availableDates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">
                      သိမ်းထားသော ရက်စွဲတစ်ခုကို တိုက်ရိုက်ရွေးရန်:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {availableDates.map((d) => {
                        const cnt = businessClips.filter((c) => c.date === d).length;
                        const isSelected = deleteStartDate === d && deleteEndDate === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setDeleteStartDate(d);
                              setDeleteEndDate(d);
                            }}
                            className={`px-2 py-1 rounded-lg border font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-slate-50 hover:bg-rose-50 text-slate-800 border-slate-200'
                            }`}
                          >
                            {d} ({cnt})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Date Range Inputs */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">စတင်ရက် (မှ)</label>
                    <input
                      type="date"
                      value={deleteStartDate}
                      onChange={(e) => setDeleteStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ပြီးဆုံးရက် (အထိ)</label>
                    <input
                      type="date"
                      value={deleteEndDate}
                      onChange={(e) => setDeleteEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>

                {/* Matching Count & Safety Notice */}
                <div
                  className={`rounded-xl p-2.5 border font-bold flex items-center gap-2 ${
                    matchingDateDeleteCount > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    {matchingDateDeleteCount > 0
                      ? `ရွေးချယ်ထားသောရက်အတွင်း မူရင်းစာသား (${matchingDateDeleteCount}) စောင် ဖျက်ပစ်ပါမည်။`
                      : 'ရွေးချယ်ထားသောရက်စွဲအတွင်း ဖျက်ရန် မူရင်းစာသား မရှိပါ။'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-bold">
                  * {businessMeta.title} Raw Text Archive မှ မူရင်းစာသားများသာ ပျက်မည်ဖြစ်ပြီး ဘောင်ချာများနှင့် ဒိုင်စာရင်းများအပေါ် သက်ရောက်မှု မရှိပါ။
                </p>
              </div>

              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDateDeleteOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  disabled={matchingDateDeleteCount === 0}
                  onClick={handleConfirmDateDelete}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>အတည်ပြု ဖျက်မည် ({matchingDateDeleteCount})</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
