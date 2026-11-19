import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radio, RefreshCw, Pause, Play, SlidersHorizontal, Eye } from 'lucide-react';

export interface LiveTwoDSlot {
  openTime: string;
  label: string;
  set: string;
  value: string;
  twod: string;
  setDigit: string;
  valDigit: string;
  stockDate?: string;
  stockDatetime?: string;
  isLocked: boolean;
}

export interface LiveTwoDPayload {
  success: boolean;
  fetchedAt: number;
  serverTime: string;
  marketStatus: 'live' | 'break' | 'closed' | 'holiday';
  marketStatusLabel: string;
  holiday: {
    isHoliday: boolean;
    date: string;
    name: string;
  };
  live: {
    set: string;
    value: string;
    twod: string;
    setDigit: string;
    valDigit: string;
    time: string;
    date: string;
  };
  slots: {
    morning1100: LiveTwoDSlot | null;
    morning1201: LiveTwoDSlot | null;
    afternoon1500: LiveTwoDSlot | null;
    evening1630: LiveTwoDSlot | null;
  };
  error?: string;
}

type SlotViewMode = 'primary' | 'all';
type InspectedKey = 'live' | '11:00' | '12:01' | '15:00' | '16:30';

const SLOT_VIEW_STORAGE_KEY = 'shwe_2d_live_slot_view';
const DIRECT_UPSTREAM_URL = 'https://api.thaistock2d.com/live';

function extractSetAndValDigits(setStr?: string, valStr?: string): { setDigit: string; valDigit: string; twod: string } {
  const cleanSet = (setStr || '').trim();
  const cleanVal = (valStr || '').trim();

  if (!cleanSet || cleanSet === '--' || !cleanVal || cleanVal === '--') {
    return { setDigit: '-', valDigit: '-', twod: '--' };
  }

  const setDigitsOnly = cleanSet.replace(/[^0-9]/g, '');
  const setDigit = setDigitsOnly.length > 0 ? setDigitsOnly[setDigitsOnly.length - 1] : '-';

  const valIntPart = cleanVal.split('.')[0] || '';
  const valIntDigits = valIntPart.replace(/[^0-9]/g, '');
  const valDigit = valIntDigits.length > 0 ? valIntDigits[valIntDigits.length - 1] : '-';

  const twod = setDigit !== '-' && valDigit !== '-' ? `${setDigit}${valDigit}` : '--';
  return { setDigit, valDigit, twod };
}

function getMyanmarMarketClock(serverTimeStr?: string): { dayOfWeek: number; minutesOfDay: number } {
  if (serverTimeStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(serverTimeStr.trim());
    if (m) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      return {
        dayOfWeek: d.getUTCDay(),
        minutesOfDay: Number(m[4]) * 60 + Number(m[5])
      };
    }
  }
  const mmtDate = new Date(Date.now() + 6.5 * 60 * 60 * 1000);
  return {
    dayOfWeek: mmtDate.getUTCDay(),
    minutesOfDay: mmtDate.getUTCHours() * 60 + mmtDate.getUTCMinutes()
  };
}

function computeMarketStatus(
  serverTime: string,
  isHoliday: boolean
): { status: 'live' | 'break' | 'closed' | 'holiday'; label: string } {
  if (isHoliday) {
    return { status: 'holiday', label: 'ဈေးပိတ်ရက် (Holiday)' };
  }
  const { dayOfWeek, minutesOfDay } = getMyanmarMarketClock(serverTime);
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { status: 'closed', label: 'စနေ/တနင်္ဂနွေ ဈေးပိတ်' };
  }
  if (minutesOfDay >= 570 && minutesOfDay <= 725) {
    return { status: 'live', label: 'LIVE • မနက်ပိုင်း ဈေးဖွင့်' };
  }
  if (minutesOfDay > 725 && minutesOfDay < 840) {
    return { status: 'break', label: 'နေ့လယ် ဈေးနားချိန်' };
  }
  if (minutesOfDay >= 840 && minutesOfDay <= 995) {
    return { status: 'live', label: 'LIVE • ညနေပိုင်း ဈေးဖွင့်' };
  }
  return { status: 'closed', label: 'ဈေးပိတ်ချိန်' };
}

function normalizeUpstreamSlot(raw: any, label: string): LiveTwoDSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const set = String(raw.set ?? '--').trim() || '--';
  const value = String(raw.value ?? '--').trim() || '--';
  const extracted = extractSetAndValDigits(set, value);
  const apiTwod = String(raw.twod ?? '').trim();
  const twod = apiTwod && apiTwod !== '--' ? apiTwod : extracted.twod;
  const isLocked = twod !== '--' && set !== '--' && value !== '--';

  return {
    openTime: String(raw.open_time || ''),
    label,
    set,
    value,
    twod,
    setDigit: extracted.setDigit,
    valDigit: extracted.valDigit,
    stockDate: raw.stock_date,
    stockDatetime: raw.stock_datetime,
    isLocked
  };
}

function normalizeUpstreamPayload(data: any): LiveTwoDPayload {
  const serverTime = String(data?.server_time || '');
  const holidayStatus = String(data?.holiday?.status || '2');
  const isHoliday = holidayStatus === '1';
  const holidayName =
    data?.holiday?.name && data.holiday.name !== 'NULL' ? String(data.holiday.name) : '';

  const rawLive = data?.live || {};
  const liveSet = String(rawLive.set ?? '--').trim() || '--';
  const liveVal = String(rawLive.value ?? '--').trim() || '--';
  const extracted = extractSetAndValDigits(liveSet, liveVal);
  const apiLiveTwod = String(rawLive.twod ?? '').trim();
  const liveTwod = apiLiveTwod && apiLiveTwod !== '--' ? apiLiveTwod : extracted.twod;

  const resultsArr: any[] = Array.isArray(data?.result) ? data.result : [];
  const findByTime = (t: string) => resultsArr.find((r) => String(r?.open_time || '').startsWith(t));
  const market = computeMarketStatus(serverTime, isHoliday);

  return {
    success: true,
    fetchedAt: Date.now(),
    serverTime,
    marketStatus: market.status,
    marketStatusLabel: market.label,
    holiday: {
      isHoliday,
      date: String(data?.holiday?.date || ''),
      name: holidayName
    },
    live: {
      set: liveSet,
      value: liveVal,
      twod: liveTwod,
      setDigit: extracted.setDigit,
      valDigit: extracted.valDigit,
      time: String(rawLive.time || serverTime || ''),
      date: String(rawLive.date || '')
    },
    slots: {
      morning1100: normalizeUpstreamSlot(findByTime('11:00'), '11:00'),
      morning1201: normalizeUpstreamSlot(findByTime('12:01'), '12:01'),
      afternoon1500: normalizeUpstreamSlot(findByTime('15:00'), '15:00'),
      evening1630: normalizeUpstreamSlot(findByTime('16:30'), '16:30')
    }
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Non-JSON response');
    }
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Splits SET string (e.g. "1,474.31") so the last digit ("1") can be highlighted.
 */
function renderHighlightedSet(setStr: string, digit: string) {
  const clean = (setStr || '--').trim();
  if (clean === '--' || digit === '-') {
    return <span className="text-slate-400">{clean}</span>;
  }
  const match = /^(.*?)(\d)(\D*)$/.exec(clean);
  if (!match) {
    return <span className="text-slate-100">{clean}</span>;
  }
  return (
    <>
      <span className="text-slate-200">{match[1]}</span>
      <span className="inline-flex items-center justify-center px-1 mx-0.5 rounded bg-amber-400/25 text-amber-300 border border-amber-400/60 font-black shadow-[0_0_8px_rgba(251,191,36,0.35)]">
        {match[2]}
      </span>
      {match[3] && <span className="text-slate-300">{match[3]}</span>}
    </>
  );
}

/**
 * Splits VAL string (e.g. "70,180.56") so the last integer digit before "." ("0") is highlighted.
 */
function renderHighlightedVal(valStr: string, digit: string) {
  const clean = (valStr || '--').trim();
  if (clean === '--' || digit === '-') {
    return <span className="text-slate-400">{clean}</span>;
  }
  const dotIdx = clean.indexOf('.');
  const intPart = dotIdx >= 0 ? clean.slice(0, dotIdx) : clean;
  const decPart = dotIdx >= 0 ? clean.slice(dotIdx) : '';
  const match = /^(.*?)(\d)(\D*)$/.exec(intPart);
  if (!match) {
    return <span className="text-slate-100">{clean}</span>;
  }
  return (
    <>
      <span className="text-slate-200">{match[1]}</span>
      <span className="inline-flex items-center justify-center px-1 mx-0.5 rounded bg-emerald-400/25 text-emerald-300 border border-emerald-400/60 font-black shadow-[0_0_8px_rgba(52,211,153,0.35)]">
        {match[2]}
      </span>
      {match[3] && <span className="text-slate-300">{match[3]}</span>}
      {decPart && <span className="text-slate-400">{decPart}</span>}
    </>
  );
}

export interface LiveTwoDTickerProps {
  confirmedDate?: string;
  confirmedMorningNumber?: string;
  confirmedEveningNumber?: string;
}

export const LiveTwoDTicker: React.FC<LiveTwoDTickerProps> = ({
  confirmedDate,
  confirmedMorningNumber,
  confirmedEveningNumber
}) => {
  const [data, setData] = useState<LiveTwoDPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [setFlashing, setSetFlashing] = useState<boolean>(false);
  const [valFlashing, setValFlashing] = useState<boolean>(false);
  const [setTickKey, setSetTickKey] = useState<number>(0);
  const [valTickKey, setValTickKey] = useState<number>(0);
  const [heartbeatTickKey, setHeartbeatTickKey] = useState<number>(0);
  const [inspectedKey, setInspectedKey] = useState<InspectedKey>('live');

  const [slotViewMode, setSlotViewMode] = useState<SlotViewMode>(() => {
    try {
      const saved = localStorage.getItem(SLOT_VIEW_STORAGE_KEY);
      return saved === 'all' ? 'all' : 'primary';
    } catch {
      return 'primary';
    }
  });

  const prevLiveRef = useRef<{ set: string; value: string; twod: string; time: string } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const setFlashTimerRef = useRef<number | null>(null);
  const valFlashTimerRef = useRef<number | null>(null);
  const marketStatusRef = useRef<LiveTwoDPayload['marketStatus'] | undefined>(undefined);

  const toggleSlotViewMode = () => {
    setSlotViewMode((prev) => {
      const next: SlotViewMode = prev === 'primary' ? 'all' : 'primary';
      try {
        localStorage.setItem(SLOT_VIEW_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      if (next === 'primary' && (inspectedKey === '11:00' || inspectedKey === '15:00')) {
        setInspectedKey('live');
      }
      return next;
    });
  };

  const applyPayload = useCallback((payload: LiveTwoDPayload, fromManualRefresh: boolean = false) => {
    const prev = prevLiveRef.current;
    const setChanged = (!!prev && prev.set !== payload.live.set) || fromManualRefresh;
    const valChanged = (!!prev && prev.value !== payload.live.value) || fromManualRefresh;
    const twodChanged = (!!prev && prev.twod !== payload.live.twod) || fromManualRefresh;
    const timeChanged = !prev || prev.time !== payload.live.time || fromManualRefresh;

    if (twodChanged) {
      setIsFlashing(true);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setIsFlashing(false), 650);
    }

    if (setChanged) {
      setSetFlashing(true);
      setSetTickKey((k) => k + 1);
      if (setFlashTimerRef.current) window.clearTimeout(setFlashTimerRef.current);
      setFlashTimerRef.current = window.setTimeout(() => setSetFlashing(false), 550);
    }

    if (valChanged) {
      setValFlashing(true);
      setValTickKey((k) => k + 1);
      if (valFlashTimerRef.current) window.clearTimeout(valFlashTimerRef.current);
      valFlashTimerRef.current = window.setTimeout(() => setValFlashing(false), 550);
    }

    if (timeChanged || payload.marketStatus === 'live') {
      setHeartbeatTickKey((k) => k + 1);
    }

    prevLiveRef.current = {
      set: payload.live.set,
      value: payload.live.value,
      twod: payload.live.twod,
      time: payload.live.time
    };
    marketStatusRef.current = payload.marketStatus;
    setData(payload);
    setIsLoading(false);
  }, []);

  const fetchOnce = useCallback(async (fromManualRefresh: boolean = false) => {
    // 1. Try local/backend API proxy first
    try {
      const json: LiveTwoDPayload = await fetchJsonWithTimeout('/api/2d/live', 3500);
      if (json && json.success && json.live) {
        applyPayload(json, fromManualRefresh);
        return;
      }
    } catch {
      // Fall through to direct CORS upstream fetch
    }

    // 2. Fallback: fetch directly from CORS-enabled upstream API
    try {
      const raw = await fetchJsonWithTimeout(DIRECT_UPSTREAM_URL, 4500);
      if (raw && (raw.live || Array.isArray(raw.result))) {
        applyPayload(normalizeUpstreamPayload(raw), fromManualRefresh);
        return;
      }
    } catch {
      // Ignore network failure, stop spinner
    }

    setIsLoading(false);
  }, [applyPayload]);

  // Real-time SSE stream with immediate initial fetch + automatic polling fallback
  useEffect(() => {
    if (isPaused) return;

    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let sseWatchdog: number | null = null;
    let sseReceiving = false;
    let disposed = false;

    const startPolling = (intervalMs: number) => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => {
        if (disposed) return;
        const closed =
          marketStatusRef.current === 'closed' || marketStatusRef.current === 'holiday';
        if (closed && intervalMs < 30000) {
          startPolling(60000);
          return;
        }
        void fetchOnce();
      }, intervalMs);
    };

    // Always fetch immediately so data appears right away without waiting on SSE handshake
    void fetchOnce();

    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource('/api/2d/live/stream');
        es.onmessage = (ev) => {
          if (disposed) return;
          try {
            const parsed: LiveTwoDPayload = JSON.parse(ev.data);
            if (parsed && parsed.success && parsed.live) {
              sseReceiving = true;
              applyPayload(parsed);
              if (parsed.marketStatus === 'closed' || parsed.marketStatus === 'holiday') {
                if (es) {
                  es.close();
                  es = null;
                }
                startPolling(60000);
              }
            }
          } catch {
            // ignore malformed frame
          }
        };
        es.onerror = () => {
          if (disposed) return;
          if (es) {
            es.close();
            es = null;
          }
          const closed =
            marketStatusRef.current === 'closed' || marketStatusRef.current === 'holiday';
          startPolling(closed ? 60000 : 1100);
        };

        // If SSE doesn't deliver within 3s (e.g. proxy buffering), start real-time 1.1s polling seamlessly
        sseWatchdog = window.setTimeout(() => {
          if (disposed || sseReceiving) return;
          if (es) {
            es.close();
            es = null;
          }
          const closed =
            marketStatusRef.current === 'closed' || marketStatusRef.current === 'holiday';
          startPolling(closed ? 60000 : 1100);
        }, 3000);
      } catch {
        startPolling(1100);
      }
    } else {
      startPolling(1100);
    }

    return () => {
      disposed = true;
      if (es) es.close();
      if (pollTimer) window.clearInterval(pollTimer);
      if (sseWatchdog) window.clearTimeout(sseWatchdog);
    };
  }, [isPaused, applyPayload, fetchOnce]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (setFlashTimerRef.current) window.clearTimeout(setFlashTimerRef.current);
      if (valFlashTimerRef.current) window.clearTimeout(valFlashTimerRef.current);
    };
  }, []);

  const displayedSlots = useMemo(() => {
    const applyConfirmedOverride = (
      rawSlot: LiveTwoDSlot | null | undefined,
      time: '12:01' | '16:30',
      confirmedNum?: string
    ): { slot: LiveTwoDSlot | null; isOwnerConfirmed: boolean; differsFromUpstream: boolean } => {
      const normalizedConfirmed = (confirmedNum || '').trim();
      if (!normalizedConfirmed) {
        return { slot: rawSlot ?? null, isOwnerConfirmed: false, differsFromUpstream: false };
      }

      const upstreamDate = rawSlot?.stockDate || data?.live?.date || '';
      if (upstreamDate && confirmedDate && upstreamDate !== confirmedDate) {
        return { slot: rawSlot ?? null, isOwnerConfirmed: false, differsFromUpstream: false };
      }

      const differsFromUpstream = !!rawSlot && rawSlot.twod !== '--' && rawSlot.twod !== normalizedConfirmed;
      const overriddenSlot: LiveTwoDSlot = rawSlot
        ? {
            ...rawSlot,
            twod: normalizedConfirmed,
            setDigit: differsFromUpstream ? '-' : rawSlot.setDigit,
            valDigit: differsFromUpstream ? '-' : rawSlot.valDigit,
            isLocked: true
          }
        : {
            openTime: `${time}:00`,
            label: time,
            set: '--',
            value: '--',
            twod: normalizedConfirmed,
            setDigit: '-',
            valDigit: '-',
            stockDate: confirmedDate,
            isLocked: true
          };

      return { slot: overriddenSlot, isOwnerConfirmed: true, differsFromUpstream };
    };

    const s1100 = data?.slots.morning1100 ?? null;
    const s1201Override = applyConfirmedOverride(data?.slots.morning1201, '12:01', confirmedMorningNumber);
    const s1500 = data?.slots.afternoon1500 ?? null;
    const s1630Override = applyConfirmedOverride(data?.slots.evening1630, '16:30', confirmedEveningNumber);

    const primaryList = [
      {
        key: '12:01' as const,
        time: '12:01',
        subLabel: 'မနက်',
        slot: s1201Override.slot,
        isOwnerConfirmed: s1201Override.isOwnerConfirmed
      },
      {
        key: '16:30' as const,
        time: '16:30',
        subLabel: 'ညနေ',
        slot: s1630Override.slot,
        isOwnerConfirmed: s1630Override.isOwnerConfirmed
      }
    ];

    if (slotViewMode === 'primary') {
      return primaryList;
    }

    return [
      { key: '11:00' as const, time: '11:00', subLabel: 'မနက်', slot: s1100, isOwnerConfirmed: false },
      primaryList[0],
      { key: '15:00' as const, time: '15:00', subLabel: 'နေ့လယ်', slot: s1500, isOwnerConfirmed: false },
      primaryList[1]
    ];
  }, [data, slotViewMode, confirmedDate, confirmedMorningNumber, confirmedEveningNumber]);

  // Determine what SET / VAL / 2D is currently in the main studio focus
  const activeStage = useMemo(() => {
    if (inspectedKey !== 'live') {
      const found = displayedSlots.find((item) => item.key === inspectedKey);
      if (found?.slot) {
        return {
          tag: found.isOwnerConfirmed ? `${found.time} (${found.subLabel} • အတည်ပြု)` : `${found.time} (${found.subLabel})`,
          set: found.slot.set,
          value: found.slot.value,
          twod: found.slot.twod,
          setDigit: found.slot.setDigit,
          valDigit: found.slot.valDigit,
          isLocked: found.slot.isLocked,
          isLiveView: false
        };
      }
    }
    if (!data) {
      return {
        tag: 'LIVE',
        set: '--',
        value: '--',
        twod: '--',
        setDigit: '-',
        valDigit: '-',
        isLocked: false,
        isLiveView: true
      };
    }
    return {
      tag: 'LIVE',
      set: data.live.set,
      value: data.live.value,
      twod: data.live.twod,
      setDigit: data.live.setDigit,
      valDigit: data.live.valDigit,
      isLocked: false,
      isLiveView: true
    };
  }, [data, inspectedKey, displayedSlots]);

  const isMarketLive = data?.marketStatus === 'live';
  const liveClockText = useMemo(() => {
    const raw = data?.live.time || data?.serverTime || '';
    const m = /(\d{2}:\d{2}:\d{2})/.exec(raw);
    return m ? m[1] : raw;
  }, [data]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 bg-gradient-to-br from-slate-950 via-[#07161b] to-slate-950 px-3 py-2 shadow-inner ${
        isMarketLive
          ? 'border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.12)]'
          : 'border-slate-700/70'
      }`}
    >
      {/* Subtle studio broadcast ambient glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-14 bg-teal-400/10 blur-2xl rounded-full" />

      {/* Top Studio Header Row */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          {/* Live / Status Badge */}
          {isMarketLive && !isPaused ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[10px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(225,29,72,0.5)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              LIVE
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                data?.marketStatus === 'break'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Radio className="w-2.5 h-2.5" />
              <span>{isPaused ? 'PAUSED' : data?.marketStatus === 'break' ? 'BREAK' : 'SET'}</span>
            </span>
          )}

          <span className="text-[11px] font-bold text-teal-200 truncate max-w-[165px] sm:max-w-none">
            {data?.holiday.isHoliday && data.holiday.name
              ? `ပိတ်ရက် (${data.holiday.name})`
              : data?.marketStatusLabel || 'Thai SET Live 2D'}
          </span>

          {liveClockText && (
            <span
              key={`clk-${heartbeatTickKey}`}
              className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-slate-300 tabular-nums animate-live-tick"
            >
              {isMarketLive && !isPaused && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
              <span>{liveClockText}</span>
            </span>
          )}
        </div>

        {/* Studio Controls: View-only hint, Slot filter, Pause, Refresh */}
        <div className="flex items-center gap-1.5">
          <span
            className="hidden md:inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900/90 border border-slate-800 rounded px-1.5 py-0.5"
            title="ကြည့်ရှုရန်သက်သက်သာ (ပေါက်ဂဏန်းကို ပိုင်ရှင်မှသာ ကိုယ်တိုင်အတည်ပြုထည့်သွင်းပါမည်)"
          >
            <Eye className="w-2.5 h-2.5 text-teal-400" />
            <span>ကြည့်ရန်သာ</span>
          </span>

          <button
            type="button"
            onClick={toggleSlotViewMode}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
              slotViewMode === 'primary'
                ? 'bg-teal-950/90 text-teal-300 border-teal-700/70 hover:bg-teal-900/80'
                : 'bg-indigo-950/90 text-indigo-200 border-indigo-700/70 hover:bg-indigo-900/80'
            }`}
            title="ပြသမည့် အချိန်ပိုင်း ရွေးချယ်ရန်"
          >
            <SlidersHorizontal className="w-2.5 h-2.5" />
            <span>{slotViewMode === 'primary' ? '12:01 • 16:30' : 'အားလုံး (4 ကြိမ်)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title={isPaused ? 'Live ပြန်ဖွင့်ရန်' : 'ခေတ္တရပ်ထားရန်'}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void fetchOnce(true);
            }}
            className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="ယခုချက်ချင်း ပြန်စစ်ရန်"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Broadcast Stage: Live 2D Number + SET / VAL + Time Slots */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left/Center: Big 2D Readout + SET & VAL with extracted digit highlights */}
        <div className="flex items-center gap-2.5">
          {/* Glowing 2D Number Box */}
          <div
            key={activeStage.isLiveView ? `twod-${setTickKey}-${valTickKey}` : activeStage.tag}
            className={`flex flex-col items-center justify-center min-w-[62px] px-2.5 py-1 rounded-xl border transition-all duration-300 ${
              isFlashing && activeStage.isLiveView
                ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50 animate-live-quiver'
                : activeStage.isLiveView
                  ? 'bg-slate-900/95 border-teal-600/60 shadow-[inset_0_0_12px_rgba(20,184,166,0.18)]'
                  : 'bg-indigo-950/80 border-indigo-500/60'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-teal-300">
                {activeStage.tag}
              </span>
            </div>
            <span className="font-mono font-black text-2xl leading-tight tracking-wider text-amber-300 tabular-nums drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
              {activeStage.twod}
            </span>
          </div>

          {/* SET & VALUE stack with real-live quiver & tick feedback */}
          <div className="flex flex-col justify-center gap-1 font-mono text-xs tabular-nums">
            <div
              key={activeStage.isLiveView ? `set-${setTickKey}-${isMarketLive && !isPaused ? heartbeatTickKey : 0}` : `slot-set-${activeStage.tag}`}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border transition-colors ${
                activeStage.isLiveView && setFlashing
                  ? 'bg-amber-500/20 border-amber-400/70 animate-live-quiver'
                  : activeStage.isLiveView && isMarketLive && !isPaused
                    ? 'bg-slate-900/60 border-slate-800/80 animate-live-tick'
                    : 'border-transparent'
              }`}
            >
              <span className="text-[10px] font-sans font-bold uppercase tracking-wide text-amber-300/90 w-7 flex items-center gap-1">
                SET
              </span>
              <span className="font-bold text-xs sm:text-sm tracking-tight inline-block">
                {renderHighlightedSet(activeStage.set, activeStage.setDigit)}
              </span>
            </div>

            <div
              key={activeStage.isLiveView ? `val-${valTickKey}-${isMarketLive && !isPaused ? heartbeatTickKey : 0}` : `slot-val-${activeStage.tag}`}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border transition-colors ${
                activeStage.isLiveView && valFlashing
                  ? 'bg-emerald-500/20 border-emerald-400/70 animate-live-quiver'
                  : activeStage.isLiveView && isMarketLive && !isPaused
                    ? 'bg-slate-900/60 border-slate-800/80 animate-live-tick'
                    : 'border-transparent'
              }`}
            >
              <span className="text-[10px] font-sans font-bold uppercase tracking-wide text-emerald-300/90 w-7 flex items-center gap-1">
                VAL
              </span>
              <span className="font-bold text-xs sm:text-sm tracking-tight inline-block">
                {renderHighlightedVal(activeStage.value, activeStage.valDigit)}
              </span>
            </div>
          </div>

          {!activeStage.isLiveView && (
            <button
              type="button"
              onClick={() => setInspectedKey('live')}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 cursor-pointer transition-colors"
              title="Live တိုက်ရိုက်သို့ ပြန်ကြည့်ရန်"
            >
              Live ပြန်ကြည့်
            </button>
          )}
        </div>

        {/* Right: Selectable Time Slots (12:01 & 16:30 primary, or all 4) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {displayedSlots.map(({ key, time, subLabel, slot, isOwnerConfirmed }) => {
            const isSelected = inspectedKey === key;
            const locked = !!slot?.isLocked;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setInspectedKey((cur) => (cur === key ? 'live' : key))}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-800/70 border-teal-400 text-white shadow-[0_0_10px_rgba(45,212,191,0.25)]'
                    : locked
                      ? 'bg-slate-900/90 border-slate-700/80 hover:border-teal-600/60 text-slate-200'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 text-slate-400'
                }`}
                title={
                  isOwnerConfirmed
                    ? `${time} (${subLabel}) ပိုင်ရှင်အတည်ပြုဂဏန်း: ${slot?.twod}`
                    : `${time} (${subLabel}) SET/VAL အသေးစိတ် ကြည့်ရန်`
                }
              >
                <div className="leading-tight">
                  <div className="text-[10px] font-mono font-bold text-teal-300">{time}</div>
                  <div className="text-[9px] text-slate-400">{subLabel}</div>
                </div>
                <span
                  className={`font-mono font-black text-sm tabular-nums pl-1 border-l border-slate-700/80 ${
                    locked ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  {slot?.twod || '--'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
