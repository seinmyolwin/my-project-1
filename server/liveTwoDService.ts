import express from 'express';
import type { Request, Response } from 'express';

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

export function extractSetAndValDigits(setStr?: string, valStr?: string): { setDigit: string; valDigit: string; twod: string } {
  const cleanSet = (setStr || '').trim();
  const cleanVal = (valStr || '').trim();

  if (!cleanSet || cleanSet === '--' || !cleanVal || cleanVal === '--') {
    return { setDigit: '-', valDigit: '-', twod: '--' };
  }

  // Last digit of SET (last numeric character after decimal, or last numeric char overall)
  const setDigitsOnly = cleanSet.replace(/[^0-9]/g, '');
  const setDigit = setDigitsOnly.length > 0 ? setDigitsOnly[setDigitsOnly.length - 1] : '-';

  // Last integer digit BEFORE decimal point of Value (e.g. "70,180.56" -> "0")
  const valIntPart = cleanVal.split('.')[0] || '';
  const valIntDigits = valIntPart.replace(/[^0-9]/g, '');
  const valDigit = valIntDigits.length > 0 ? valIntDigits[valIntDigits.length - 1] : '-';

  const twod = setDigit !== '-' && valDigit !== '-' ? `${setDigit}${valDigit}` : '--';
  return { setDigit, valDigit, twod };
}

function getMyanmarMarketClock(serverTimeStr?: string): { dayOfWeek: number; minutesOfDay: number } {
  // Prefer parsing server_time ("YYYY-MM-DD HH:MM:SS") which is already in MMT (UTC+6:30)
  if (serverTimeStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(serverTimeStr.trim());
    if (m) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      const dow = d.getUTCDay();
      const mins = Number(m[4]) * 60 + Number(m[5]);
      return { dayOfWeek: dow, minutesOfDay: mins };
    }
  }
  // Fallback: compute Asia/Yangon time from current UTC
  const now = new Date();
  const mmtMs = now.getTime() + (6.5 * 60 * 60 * 1000);
  const mmtDate = new Date(mmtMs);
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

  // Morning SET session (MMT): 09:30 (570) - 12:05 (725)
  // Lunch break (MMT): 12:05 (725) - 14:00 (840)
  // Afternoon SET session (MMT): 14:00 (840) - 16:35 (995)
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

function normalizeSlot(raw: any, label: string): LiveTwoDSlot | null {
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

let cachedPayload: LiveTwoDPayload | null = null;
let cachedAt = 0;
let inFlightFetch: Promise<LiveTwoDPayload> | null = null;
const CACHE_TTL_MS = 1800;

export async function fetchLiveTwoDData(forceRefresh: boolean = false): Promise<LiveTwoDPayload> {
  const now = Date.now();
  if (!forceRefresh && cachedPayload && now - cachedAt < CACHE_TTL_MS) {
    return cachedPayload;
  }
  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const response = await fetch('https://api.thaistock2d.com/live', {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!response.ok) {
        throw new Error(`Upstream HTTP ${response.status}`);
      }

      const data: any = await response.json();
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

      const payload: LiveTwoDPayload = {
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
          morning1100: normalizeSlot(findByTime('11:00'), '11:00'),
          morning1201: normalizeSlot(findByTime('12:01'), '12:01'),
          afternoon1500: normalizeSlot(findByTime('15:00'), '15:00'),
          evening1630: normalizeSlot(findByTime('16:30'), '16:30')
        }
      };

      cachedPayload = payload;
      cachedAt = Date.now();
      return payload;
    } catch (err: any) {
      if (cachedPayload) {
        return {
          ...cachedPayload,
          error: err?.message || 'Live feed temporarily delayed'
        };
      }
      return {
        success: false,
        fetchedAt: Date.now(),
        serverTime: '',
        marketStatus: 'closed',
        marketStatusLabel: 'ချိတ်ဆက်နေသည်...',
        holiday: { isHoliday: false, date: '', name: '' },
        live: {
          set: '--',
          value: '--',
          twod: '--',
          setDigit: '-',
          valDigit: '-',
          time: '',
          date: ''
        },
        slots: {
          morning1100: null,
          morning1201: null,
          afternoon1500: null,
          evening1630: null
        },
        error: err?.message || 'Failed to fetch live 2D market data'
      };
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export function createLiveTwoDRouter() {
  const router = express.Router();
  const sseClients = new Set<Response>();
  let streamTimer: ReturnType<typeof setInterval> | null = null;
  let lastBroadcastFingerprint = '';
  let lastHeartbeatAt = 0;

  const makeFingerprint = (p: LiveTwoDPayload) =>
    `${p.live.set}|${p.live.value}|${p.live.twod}|${p.live.time}|${p.slots.morning1100?.twod}|${p.slots.morning1201?.twod}|${p.slots.afternoon1500?.twod}|${p.slots.evening1630?.twod}|${p.marketStatus}`;

  const stopStreamLoopIfIdle = () => {
    if (sseClients.size === 0 && streamTimer) {
      clearInterval(streamTimer);
      streamTimer = null;
    }
  };

  const ensureStreamLoop = () => {
    if (streamTimer) return;
    streamTimer = setInterval(async () => {
      if (sseClients.size === 0) {
        stopStreamLoopIfIdle();
        return;
      }
      const payload = await fetchLiveTwoDData(true);
      const fp = makeFingerprint(payload);
      const now = Date.now();
      if (fp !== lastBroadcastFingerprint || now - lastHeartbeatAt >= 12000) {
        lastBroadcastFingerprint = fp;
        lastHeartbeatAt = now;
        const msg = `data: ${JSON.stringify(payload)}\n\n`;
        for (const client of sseClients) {
          try {
            client.write(msg);
          } catch {
            sseClients.delete(client);
          }
        }
        stopStreamLoopIfIdle();
      }
    }, 2000);
  };

  router.get('/2d/live', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const payload = await fetchLiveTwoDData(false);
    return res.json(payload);
  });

  router.get('/2d/live/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    sseClients.add(res);

    const initial = await fetchLiveTwoDData(false);
    lastBroadcastFingerprint = makeFingerprint(initial);
    lastHeartbeatAt = Date.now();
    res.write(`data: ${JSON.stringify(initial)}\n\n`);

    ensureStreamLoop();

    req.on('close', () => {
      sseClients.delete(res);
      stopStreamLoopIfIdle();
    });
  });

  return router;
}
