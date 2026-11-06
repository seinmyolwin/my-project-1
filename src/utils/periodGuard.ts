/**
 * Closed-period protection. A closed period (PeriodClosing) freezes every record that
 * belongs to its date range. Mutations call assertDateOpen() first; verifyClosedPeriods()
 * recomputes each closing's content hash to detect tampering.
 */
import { STORAGE_KEYS } from './storage';
import { computeSha256Digest } from './tombstoneUtils';
import { GameType } from '../types';

const readList = (key: string): any[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};

const roundsOf = (game: GameType): any[] =>
  readList(game === '2D' ? '2d_ledger_rounds_v1' : game === '3D' ? STORAGE_KEYS.ROUNDS : 'football_ledger_matches_v1');

/** Date (YYYY-MM-DD) of a round, or of a football slip / match. */
export function dateOfRound(game: GameType, roundId: string): string | undefined {
  const r = roundsOf(game).find((x: any) => x.id === roundId);
  return r ? (r.drawDate || r.roundDate || r.matchDate) : undefined;
}

export function closingsList(): any[] { return readList(STORAGE_KEYS.PERIOD_CLOSINGS); }

export function isDateClosed(game: GameType, date: string): boolean {
  if (!date) return false;
  return closingsList().some((c: any) => c.game === game && date >= c.periodStart && date <= c.periodEnd);
}

/** Throws a Myanmar error when the date falls inside a closed period. */
export function assertDateOpen(game: GameType, date: string | undefined, action: string): void {
  if (date && isDateClosed(game, date)) {
    throw new Error(`ဤကာလ (${date}) ပိတ်ပြီးပါပြီ — "${action}" မလုပ်နိုင်ပါ`);
  }
}

const canonical = (v: any): string => JSON.stringify(v, Object.keys(v || {}).sort());
const sortById = (a: any[]) => [...a].sort((x, y) => String(x.id).localeCompare(String(y.id)));

/** SHA-256 over every record of `game` whose date is inside [start, end]. */
export async function periodRecordsHash(game: GameType, start: string, end: string): Promise<string> {
  const inRange = (d?: string) => !!d && d >= start && d <= end;
  const rounds = roundsOf(game).filter((r: any) => inRange(r.drawDate || r.roundDate || r.matchDate));
  const roundIds = new Set(rounds.map((r: any) => r.id));
  const vKey = game === '2D' ? '2d_ledger_vouchers_v1' : game === '3D' ? STORAGE_KEYS.VOUCHERS : 'football_ledger_slips_v1';
  const fKey = game === '2D' ? '2d_ledger_forward_slips_v1' : game === '3D' ? STORAGE_KEYS.FORWARD_SLIPS : 'football_ledger_forward_slips_v1';
  const vouchers = readList(vKey).filter((v: any) =>
    game === 'FB' ? inRange(v.roundDate) : roundIds.has(v.roundId));
  const forwards = readList(fKey).filter((f: any) =>
    game === 'FB' ? inRange(f.roundDate) : roundIds.has(f.roundId));
  const payload = JSON.stringify({
    game, start, end,
    rounds: sortById(rounds).map(canonical),
    vouchers: sortById(vouchers).map(canonical),
    forwards: sortById(forwards).map(canonical),
  });
  return computeSha256Digest(payload);
}

/** Returns ids of closings whose stored contentHash no longer matches the records. */
export async function verifyClosedPeriods(): Promise<string[]> {
  const bad: string[] = [];
  for (const c of closingsList()) {
    const h = await periodRecordsHash(c.game, c.periodStart, c.periodEnd);
    if (c.contentHash && c.contentHash !== h) bad.push(c.id);
  }
  return bad;
}
