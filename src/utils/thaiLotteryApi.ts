/**
 * Lottery Round Generators (Manual Entry Only)
 */

import { TwoDDrawRound, DrawRound } from '../types';
import { getLocalDateString } from './moneyUtils';

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
  defaultMultiplier?: number,
  defaultCommissionRate?: number
): TwoDDrawRound[] {
  const today = new Date();
  const rounds: TwoDDrawRound[] = [];
  const START_DATE = '2026-10-05';
  const todayLocalStr = getLocalDateString(today);

  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);

  while (true) {
    const dateStr = toDateStr(current);
    if (dateStr < START_DATE) {
      break;
    }

    const dayOfWeek = current.getDay();
    const dateLabel = formatDrawDateName(current);
    const isToday = dateStr === todayLocalStr;

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Evening Round (04:30 PM)
      rounds.push({
        id: `round-2d-${dateStr}-eve`,
        name: `${dateLabel} (ညနေ 04:30 PM)`,
        drawDate: dateStr,
        session: 'evening',
        closingTime: '16:25',
        status: isToday ? 'open' : 'closed',
        winningNumber: undefined,
        multiplier: defaultMultiplier ?? 80,
        commissionRate: defaultCommissionRate ?? 12,
        settledAt: undefined
      });

      // Morning Round (12:01 PM)
      rounds.push({
        id: `round-2d-${dateStr}-morn`,
        name: `${dateLabel} (မနက် 12:01 PM)`,
        drawDate: dateStr,
        session: 'morning',
        closingTime: '12:00',
        status: isToday ? 'open' : 'closed',
        winningNumber: undefined,
        multiplier: defaultMultiplier ?? 80,
        commissionRate: defaultCommissionRate ?? 12,
        settledAt: undefined
      });
    }

    current.setDate(current.getDate() - 1);
  }

  return rounds;
}

/**
 * Generates an up-to-date list of 3D draw rounds matching TODAY's date and official 1st/16th draw dates
 */
export function generateUpToDate3DRounds(): DrawRound[] {
  const today = new Date();
  const rounds: DrawRound[] = [];

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  for (let mOffset = 0; mOffset < 8; mOffset++) {
    const targetMonthDate = new Date(currentYear, currentMonth - mOffset, 1);
    const y = targetMonthDate.getFullYear();
    const m = targetMonthDate.getMonth();

    // 16th Draw of month
    const d16 = new Date(y, m, 16);
    const dateStr16 = toDateStr(d16);
    const label16 = formatDrawDateName(d16);

    rounds.push({
      id: `round-3d-${dateStr16}`,
      name: `${label16} (3D ပွဲစဉ်)`,
      drawDate: dateStr16,
      closingTime: '15:00',
      status: 'open',
      winningNumber: undefined,
      multiplier: 600,
      toddMultiplier: 100,
      commissionRate: 10,
      settledAt: undefined
    });

    // 1st Draw of month
    const d1 = new Date(y, m, 1);
    const dateStr1 = toDateStr(d1);
    const label1 = formatDrawDateName(d1);

    rounds.push({
      id: `round-3d-${dateStr1}`,
      name: `${label1} (3D ပွဲစဉ်)`,
      drawDate: dateStr1,
      closingTime: '15:00',
      status: 'open',
      winningNumber: undefined,
      multiplier: 600,
      toddMultiplier: 100,
      commissionRate: 10,
      settledAt: undefined
    });
  }

  return rounds.sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());
}
