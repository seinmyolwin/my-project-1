/**
 * Live Official Thai 2D & 3D Result Fetcher & Daily Synchronizer
 * Connects to official Thai Stock Exchange (SET) & GLO Lottery feeds.
 */

import { TwoDDrawRound, DrawRound } from '../types';
import { getLocalDateString } from './moneyUtils';

export interface Live2DResult {
  session: 'morning' | 'evening';
  set: string;
  value: string;
  twod: string;
  time: string;
  date: string;
}

export interface Live3DResult {
  drawDate: string;
  firstPrize: string;
  threed: string; // Last 3 digits of 1st prize
  rawResult?: any;
}

export interface LiveLotteryPayload {
  success: boolean;
  source: string;
  timestamp: string;
  live2D?: any;
  history2D?: any[];
  live3D?: any;
}

/**
 * Fetch live data from server proxy with client fallback
 */
export async function fetchLiveOfficialFeed(): Promise<LiveLotteryPayload | null> {
  try {
    const res = await fetch('/api/lottery/live-results', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Client-side fallback to direct fetch
  }

  try {
    const response = await fetch('https://api.thaistock2d.com/live', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });
    if (response.ok) {
      const live2d = await response.json();
      return {
        success: true,
        source: 'Thai Stock Exchange (SET)',
        timestamp: new Date().toISOString(),
        live2D: live2d
      };
    }
  } catch {
    // Fallback
  }

  return null;
}

/**
 * Deterministic calculation helper for Thai SET 2D number from date and session
 */
export function calculateSET2D(dateStr: string, session: 'morning' | 'evening'): {
  twod: string;
  set: string;
  value: string;
} {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0] || '2026', 10);
  const m = parseInt(parts[1] || '10', 10);
  const d = parseInt(parts[2] || '05', 10);

  const dateSeed = y * 10000 + m * 100 + d;
  const sessionSeed = session === 'morning' ? 1201 : 1630;
  const hash = Math.abs(Math.sin(dateSeed * 9301 + sessionSeed * 49297) * 233280);
  const num = Math.floor(hash) % 100;
  const twod = String(num).padStart(2, '0');

  const setLastDigit = twod[0];
  const valLastDigit = twod[1];

  const setInt = 1350 + (dateSeed % 120);
  const setDec1 = Math.abs((dateSeed * 7) % 10);
  const setDec2 = setLastDigit;
  const set = `${setInt}.${setDec1}${setDec2}`;

  const valInt = 45000 + (dateSeed % 25000);
  const valDec1 = Math.abs((dateSeed * 13) % 10);
  const valDec2 = valLastDigit;
  const value = `${valInt.toLocaleString('en-US')}.${valDec1}${valDec2}`;

  return { twod, set, value };
}

/**
 * Deterministic calculation helper for Thai GLO 3D number from draw date
 */
export function calculateGLO3D(dateStr: string): {
  threed: string;
  firstPrize: string;
} {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0] || '2026', 10);
  const m = parseInt(parts[1] || '10', 10);
  const d = parseInt(parts[2] || '01', 10);

  const dateSeed = y * 10000 + m * 100 + d;
  const hash = Math.abs(Math.sin(dateSeed * 7919 + 6121) * 982451);
  const num = Math.floor(hash) % 1000;
  const threed = String(num).padStart(3, '0');
  const front3 = String((dateSeed * 37) % 900 + 100).padStart(3, '0');

  return {
    threed,
    firstPrize: `${front3}${threed}`
  };
}

/**
 * Format a Date object to YYYY-MM-DD
 */
function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display: e.g. "05-Oct-2026"
 */
function formatDrawDateName(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()] || 'Oct';
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

/**
 * Generates an up-to-date list of 2D draw rounds strictly matching TODAY's date and recent days
 */
export function generateUpToDate2DRounds(
  liveData?: LiveLotteryPayload | null,
  defaultMultiplier?: number,
  defaultCommissionRate?: number
): TwoDDrawRound[] {
  const today = new Date();
  const currentHour = today.getHours();
  const currentMinutes = today.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMinutes;

  const rounds: TwoDDrawRound[] = [];
  const START_DATE = '2026-10-05';
  const todayLocalStr = getLocalDateString(today);

  // Start with today (local time) and go backwards
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);

  while (true) {
    const dateStr = toDateStr(current);
    if (dateStr < START_DATE) {
      break;
    }

    const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
    const dateLabel = formatDrawDateName(current);
    const isToday = dateStr === todayLocalStr;

    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Monday - Friday Thai SET
      // Evening Round (04:30 PM)
      let eveWinning: string | undefined = undefined;
      let eveStatus: 'open' | 'closed' | 'settled' = 'open';

      if (!isToday) {
        // Past days: lookup in official history only
        const historyEve = liveData?.history2D?.find((h: any) => h.date === dateStr)?.result?.[1]?.twod;
        if (historyEve) {
          eveWinning = String(historyEve).padStart(2, '0');
          eveStatus = 'settled';
        }
      }

      rounds.push({
        id: `round-2d-${dateStr}-eve`,
        name: `${dateLabel} (ညနေ 04:30 PM)`,
        drawDate: dateStr,
        session: 'evening',
        closingTime: '16:25',
        status: eveStatus,
        winningNumber: eveWinning,
        multiplier: defaultMultiplier ?? 0,
        commissionRate: defaultCommissionRate ?? 0,
        settledAt: eveStatus === 'settled' ? `${dateStr}T16:35:00Z` : undefined
      });

      // Morning Round (12:01 PM)
      let mornWinning: string | undefined = undefined;
      let mornStatus: 'open' | 'closed' | 'settled' = 'open';

      if (!isToday) {
        // Past days: lookup in official history only
        const historyMorn = liveData?.history2D?.find((h: any) => h.date === dateStr)?.result?.[0]?.twod;
        if (historyMorn) {
          mornWinning = String(historyMorn).padStart(2, '0');
          mornStatus = 'settled';
        }
      }

      rounds.push({
        id: `round-2d-${dateStr}-morn`,
        name: `${dateLabel} (မနက် 12:01 PM)`,
        drawDate: dateStr,
        session: 'morning',
        closingTime: '12:00',
        status: mornStatus,
        winningNumber: mornWinning,
        multiplier: defaultMultiplier ?? 0,
        commissionRate: defaultCommissionRate ?? 0,
        settledAt: mornStatus === 'settled' ? `${dateStr}T12:05:00Z` : undefined
      });
    }

    // Go to previous day
    current.setDate(current.getDate() - 1);
  }

  return rounds;
}

/**
 * Generates an up-to-date list of 3D draw rounds matching TODAY's date and official 1st/16th draw dates
 */
export function generateUpToDate3DRounds(liveData?: LiveLotteryPayload | null): DrawRound[] {
  const today = new Date();
  const rounds: DrawRound[] = [];

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentDay = today.getDate();

  // Create draws for current year and previous periods
  for (let mOffset = 0; mOffset < 8; mOffset++) {
    const targetMonthDate = new Date(currentYear, currentMonth - mOffset, 1);
    const y = targetMonthDate.getFullYear();
    const m = targetMonthDate.getMonth();

    // 16th Draw of month
    const d16 = new Date(y, m, 16);
    const dateStr16 = toDateStr(d16);
    const label16 = formatDrawDateName(d16);

    let status16: 'open' | 'closed' | 'settled' = 'open';
    let win16: string | undefined = undefined;

    if (liveData?.live3D?.drawDate === dateStr16 && liveData.live3D.firstPrize) {
      win16 = String(liveData.live3D.firstPrize).slice(-3);
      status16 = 'settled';
    }

    rounds.push({
      id: `round-3d-${dateStr16}`,
      name: `${label16} (ထိုင်း 3D ${status16 === 'settled' ? 'ပြီးဆုံး' : 'ပွဲစဉ်'})`,
      drawDate: dateStr16,
      closingTime: '15:00',
      status: status16,
      winningNumber: win16,
      multiplier: 600,
      toddMultiplier: 100,
      commissionRate: 10,
      settledAt: status16 === 'settled' ? `${dateStr16}T16:00:00Z` : undefined
    });

    // 1st Draw of month
    const d1 = new Date(y, m, 1);
    const dateStr1 = toDateStr(d1);
    const label1 = formatDrawDateName(d1);

    let status1: 'open' | 'closed' | 'settled' = 'open';
    let win1: string | undefined = undefined;

    if (liveData?.live3D?.drawDate === dateStr1 && liveData.live3D.firstPrize) {
      win1 = String(liveData.live3D.firstPrize).slice(-3);
      status1 = 'settled';
    }

    rounds.push({
      id: `round-3d-${dateStr1}`,
      name: `${label1} (ထိုင်း 3D ${status1 === 'settled' ? 'ပြီးဆုံး' : 'ပွဲစဉ်'})`,
      drawDate: dateStr1,
      closingTime: '15:00',
      status: status1,
      winningNumber: win1,
      multiplier: 600,
      toddMultiplier: 100,
      commissionRate: 10,
      settledAt: status1 === 'settled' ? `${dateStr1}T16:00:00Z` : undefined
    });
  }

  // Sort by drawDate descending
  return rounds.sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());
}

/**
 * Fetch Live Official Thai 2D Result
 * Strictly extracts final confirmed result for morning (12:01) or evening (04:30).
 * If official result is not available, returns success: false and leaves result undefined.
 */
export async function fetchLiveThai2D(session: 'morning' | 'evening' = 'evening'): Promise<{
  success: boolean;
  result?: Live2DResult;
  message: string;
}> {
  const livePayload = await fetchLiveOfficialFeed();
  const today = new Date();
  const dateStr = toDateStr(today);

  if (livePayload?.live2D) {
    if (session === 'morning') {
      const morningTarget = livePayload.live2D.result?.[0];
      if (morningTarget && morningTarget.twod !== undefined && morningTarget.twod !== null && String(morningTarget.twod).trim() !== '') {
        const twod = String(morningTarget.twod).padStart(2, '0');
        return {
          success: true,
          result: {
            session: 'morning',
            set: morningTarget.set || '-',
            value: morningTarget.value || '-',
            twod,
            time: '12:01 PM',
            date: dateStr
          },
          message: `ထိုင်း SET တရားဝင် မနက်ပိုင်း ဖိုင်နယ် အတည်ပြုဂဏန်း [${twod}] ကို ရယူပြီးပါပြီ`
        };
      }
    } else {
      const eveningTarget = livePayload.live2D.result?.[1];
      if (eveningTarget && eveningTarget.twod !== undefined && eveningTarget.twod !== null && String(eveningTarget.twod).trim() !== '') {
        const twod = String(eveningTarget.twod).padStart(2, '0');
        return {
          success: true,
          result: {
            session: 'evening',
            set: eveningTarget.set || '-',
            value: eveningTarget.value || '-',
            twod,
            time: '04:30 PM',
            date: dateStr
          },
          message: `ထိုင်း SET တရားဝင် ညနေပိုင်း ဖိုင်နယ် အတည်ပြုဂဏန်း [${twod}] ကို ရယူပြီးပါပြီ`
        };
      }
    }
  }

  // Official result unavailable or stream not live yet -> Return unavailable state
  return {
    success: false,
    message: `တရားဝင် ထိုင်း 2D (${session === 'morning' ? 'မနက်ပိုင်း 12:01' : 'ညနေပိုင်း 04:30'}) ပေါက်ဂဏန်း မထွက်ရှိသေးပါ သို့မဟုတ် လိုင်းချိတ်ဆက်၍ မရနိုင်သေးပါ`
  };
}

/**
 * Fetch Live Official Thai 3D Result
 */
export async function fetchLiveThai3D(): Promise<{
  success: boolean;
  result?: Live3DResult;
  message: string;
}> {
  const livePayload = await fetchLiveOfficialFeed();
  const today = new Date();
  const dateStr = toDateStr(today);

  if (livePayload?.live3D?.firstPrize) {
    const firstPrizeStr = String(livePayload.live3D.firstPrize).trim();
    if (firstPrizeStr.length >= 3) {
      const threed = firstPrizeStr.slice(-3);
      return {
        success: true,
        result: {
          drawDate: livePayload.live3D.drawDate || dateStr,
          firstPrize: firstPrizeStr,
          threed
        },
        message: `ထိုင်းအစိုးရ ထီပထမဆု [${firstPrizeStr}] မှ 3D ပေါက်ဂဏန်း [${threed}] ကို တိုက်ရိုက် ရယူပြီးပါပြီ`
      };
    }
  }

  return {
    success: false,
    message: 'တရားဝင် ထိုင်း 3D ပေါက်ဂဏန်း မထွက်ရှိသေးပါ သို့မဟုတ် လိုင်းချိတ်ဆက်၍ မရနိုင်သေးပါ'
  };
}
