import * as XLSX from 'xlsx';
import { safeRound, formatAmount } from './moneyUtils';
import {
  FootballMatch,
  FootballSlip,
  FootballForwardSlip,
  FootballBetSelection,
  SelectionOutcome,
  FootballSummary
} from '../types';

/**
 * Parses Myanmar Asian Handicap value into goal difference spread
 * Examples:
 *  "0=0" -> 0
 *  "0.5 (ဝက်)" -> 0.5
 *  "0-50 (သရေ ၅၀ ရှုံး)" -> 0.25 (Quarter ball)
 *  "0.5-1 (တစ်လုံး ၅၀ စား)" -> 0.75
 *  "1.0 (တစ်လုံး)" -> 1.0
 *  "1-80" -> 1.0 (with 80 water)
 *  "1=1.5 (၁ ပြား ၇၀)" -> 1.25
 *  "2.5" -> 2.5
 */
export function parseHandicapGoals(val: string): number {
  if (!val) return 0;
  const clean = val.toLowerCase();
  if (clean.includes('0=0') || clean.includes('တူတူ')) return 0;
  if (clean.includes('0-50')) return 0.25;
  if (clean.includes('0.5-1') || clean.includes('50 စား')) return 0.75;
  if (clean.includes('1=1.5') || clean.includes('ပြား ၇၀')) return 1.25;
  if (clean.includes('1.5-2')) return 1.75;
  if (clean.includes('2=2.5')) return 2.25;
  if (clean.includes('2.5-3')) return 2.75;

  const m = clean.match(/(\d+(\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return 0;
}

/**
 * Evaluates outcome for a single match bet (Body or Over/Under)
 */
export function evaluateSelectionOutcome(
  selection: FootballBetSelection,
  match: FootballMatch
): SelectionOutcome {
  if (match.status !== 'finished' || match.homeScore === undefined || match.awayScore === undefined) {
    return 'pending';
  }

  const hScore = match.homeScore;
  const aScore = match.awayScore;
  const totalGoals = hScore + aScore;

  // OVER / UNDER BETS
  if (selection.betType === 'over' || selection.betType === 'under') {
    const ouLine = parseHandicapGoals(match.overUnderValue);
    const diff = totalGoals - ouLine;

    if (diff === 0) return 'draw';

    if (selection.betType === 'over') {
      if (diff >= 0.5) return 'win';
      if (diff === 0.25) return 'half_win';
      if (diff === -0.25) return 'half_loss';
      return 'loss';
    } else {
      // Under
      if (diff <= -0.5) return 'win';
      if (diff === -0.25) return 'half_win';
      if (diff === 0.25) return 'half_loss';
      return 'loss';
    }
  }

  // BODY (HANDICAP) BETS
  const line = parseHandicapGoals(match.handicapValue);
  let homeSpread = 0;
  if (match.handicapTeam === 'home') {
    homeSpread = -line; // Home gives handicap
  } else if (match.handicapTeam === 'away') {
    homeSpread = line; // Home receives handicap
  }

  // Adjusted goal diff from Home perspective
  const adjustedDiff = (hScore + homeSpread) - aScore;

  if (selection.betType === 'body_home') {
    if (adjustedDiff >= 0.5) return 'win';
    if (adjustedDiff === 0.25) return 'half_win';
    if (adjustedDiff === 0) return 'draw';
    if (adjustedDiff === -0.25) return 'half_loss';
    return 'loss';
  } else {
    // Body Away
    const awayAdjusted = -adjustedDiff;
    if (awayAdjusted >= 0.5) return 'win';
    if (awayAdjusted === 0.25) return 'half_win';
    if (awayAdjusted === 0) return 'draw';
    if (awayAdjusted === -0.25) return 'half_loss';
    return 'loss';
  }
}

/**
 * Calculates Maung (Mix Parlay) or Body Single slip payout and status
 */
export function calculateSlipSettlement(
  slip: FootballSlip,
  matchesMap: { [id: string]: FootballMatch }
): {
  outcome: 'pending' | 'won' | 'half_won' | 'draw' | 'lost';
  actualPayout: number;
  evaluatedSelections: FootballBetSelection[];
} {
  let isAnyPending = false;
  let hasLoss = false;
  let runningStake = slip.stakeAmount;

  const evaluatedSelections: FootballBetSelection[] = slip.selections.map(sel => {
    const match = matchesMap[sel.matchId];
    if (!match || match.status !== 'finished') {
      isAnyPending = true;
      return { ...sel, outcome: 'pending' as const };
    }
    const outcome = evaluateSelectionOutcome(sel, match);
    if (outcome === 'pending') isAnyPending = true;
    if (outcome === 'loss') hasLoss = true;
    return {
      ...sel,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      outcome
    };
  });

  if (hasLoss) {
    return {
      outcome: 'lost',
      actualPayout: 0,
      evaluatedSelections
    };
  }

  if (isAnyPending) {
    return {
      outcome: 'pending',
      actualPayout: 0,
      evaluatedSelections
    };
  }

  // All matches are finished and none is full loss
  // Asian Parlay accumulator calculation:
  // Win: x Odds
  // Half Win: x (1 + (Odds - 1) / 2)
  // Draw: x 1.0
  // Half Loss: x 0.5
  let multiplier = 1.0;
  let hasHalfLoss = false;
  let hasHalfWin = false;

  evaluatedSelections.forEach(sel => {
    const od = sel.odds || 1.90;
    if (sel.outcome === 'win') {
      multiplier *= od;
    } else if (sel.outcome === 'half_win') {
      multiplier *= (1 + (od - 1) / 2);
      hasHalfWin = true;
    } else if (sel.outcome === 'draw') {
      multiplier *= 1.0;
    } else if (sel.outcome === 'half_loss') {
      multiplier *= 0.5;
      hasHalfLoss = true;
    }
  });

  const actualPayout = safeRound(slip.stakeAmount * multiplier);
  const outcome = hasHalfLoss ? 'half_won' : (hasHalfWin ? 'half_won' : (multiplier > 1.0 ? 'won' : 'draw'));

  return {
    outcome,
    actualPayout,
    evaluatedSelections
  };
}

/**
 * Excel export for Football Matches and Slips
 */
export function exportFootballDataToExcel(
  roundDate: string,
  matches: FootballMatch[],
  slips: FootballSlip[],
  forwardSlips: FootballForwardSlip[],
  summary: FootballSummary,
  shopName: string = 'ပစ်တိုင်းထောင်'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Matches
  const matchesData = matches.map(m => ({
    'လိဂ် (League)': m.league,
    'အိမ်ကွင်းသင်း': m.homeTeam,
    'အဝေးကွင်းသင်း': m.awayTeam,
    'အချိန်': `${m.matchDate} ${m.kickoffTime}`,
    'အကြော (Handicap)': `${m.handicapTeam === 'home' ? m.homeTeam : m.awayTeam} ${m.handicapValue}`,
    'ဂိုးပေါင်း (Over/Under)': m.overUnderValue,
    'ဘော်ဒီရေကြေး': m.bodyOdds,
    'ဂိုးပေါင်းရေကြေး': m.goalOdds,
    'ရလဒ် (FT)': m.status === 'finished' ? `${m.homeScore} - ${m.awayScore}` : m.status
  }));
  const wsMatches = XLSX.utils.json_to_sheet(matchesData);
  XLSX.utils.book_append_sheet(wb, wsMatches, 'ပွဲစဉ်များ (Fixtures)');

  // Sheet 2: Tickets / Slips
  const slipsData = slips.map(s => ({
    'ဘောင်ချာအမှတ်': s.slipNo,
    'ထိုးသူ': s.customerName,
    'အမျိုးအစား': s.slipType === 'maung' ? `${s.teamCount} သင်းမောင်း` : 'ဘော်ဒီသီးသန့်',
    'ထိုးကြေး': s.stakeAmount,
    'ကျသင့်ငွေ': s.netPayable,
    'အဆ (Odds)': s.combinedOdds,
    'ဖြစ်နိုင်ခြေလျော်ကြေး': s.potentialPayout,
    'အမှန်တကယ်ရငွေ': s.actualPayout ?? 0,
    'အခြေအနေ': s.outcome ? s.outcome.toUpperCase() : s.status,
    'ထိုးချိန်': new Date(s.createdAt).toLocaleString('my-MM')
  }));
  const wsSlips = XLSX.utils.json_to_sheet(slipsData);
  XLSX.utils.book_append_sheet(wb, wsSlips, 'ဘောလုံးဘောင်ချာများ');

  // Sheet 3: Forward Slips
  const fwdData = forwardSlips.map(f => ({
    'လွှဲတင်ဘောင်ချာ': f.slipNo,
    'ဒိုင်ချုပ်အမည်': f.masterAgentName,
    'အမျိုးအစား': f.slipType === 'maung' ? 'မောင်း' : 'ဘော်ဒီ',
    'အကြောင်းအရာ': f.description,
    'လွှဲတင်ငွေ': f.stakeAmount,
    'ကော်မရှင်': f.commissionAmount,
    'အမှန်ပေးချေငွေ': f.netPaid,
    'ရက်စွဲ': f.roundDate
  }));
  const wsFwd = XLSX.utils.json_to_sheet(fwdData);
  XLSX.utils.book_append_sheet(wb, wsFwd, 'ဒိုင်ကြီးလွှဲစာရင်း');

  // Sheet 4: Summary
  const summaryData = [
    { 'အကြောင်းအရာ': 'ရက်စွဲ', 'ပမာဏ': roundDate },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း ဘောင်ချာအရေအတွက်', 'ပမာဏ': summary.totalTickets },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း ထိုးကြေးငွေ', 'ပမာဏ': summary.totalStake },
    { 'အကြောင်းအရာ': 'ဘော်ဒီ ထိုးကြေး', 'ပမာဏ': summary.totalBodyStake },
    { 'အကြောင်းအရာ': 'မောင်း ထိုးကြေး', 'ပမာဏ': summary.totalMaungStake },
    { 'အကြောင်းအရာ': 'ဒိုင်ကြီးဆီ လွှဲတင်ငွေ', 'ပမာဏ': summary.totalForwarded },
    { 'အကြောင်းအရာ': 'လွှဲတင်ကော်မရှင် ရငွေ', 'ပမာဏ': summary.forwardedCommission },
    { 'အကြောင်းအရာ': 'စုစုပေါင်း လျော်ကြေးငွေ', 'ပမာဏ': summary.totalPayout },
    { 'အကြောင်းအရာ': 'ဒိုင် အသားတင် အမြတ်/အရှုံး', 'ပမာဏ': summary.netProfit }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'စာရင်းချုပ်');

  const fileName = `Football_${roundDate}_${shopName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
