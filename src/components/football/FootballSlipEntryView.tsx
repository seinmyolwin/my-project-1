import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Layers,
  CheckCircle2,
  Smartphone,
  Tag,
  Shield,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FootballBetSelection, FootballSlip, FootballMatch } from '../../types';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import { safeRound } from '../../utils/moneyUtils';

interface FootballSlipEntryViewProps {
  onSlipCreated: (slip: FootballSlip) => void;
}

const isMatchExpired = (match: FootballMatch): boolean => {
  if (match.status === 'finished' || match.status === 'live' || match.status === 'postponed' || match.status === 'void') return true;
  if (!match.matchDate || !match.kickoffTime) return false;
  try {
    const [year, month, day] = match.matchDate.split('-').map(Number);
    let hours = 0;
    let minutes = 0;
    const timeClean = match.kickoffTime.trim().toLowerCase();
    const isPM = timeClean.includes('pm');
    const isAM = timeClean.includes('am');
    const timeParts = timeClean.replace(/[^\d:]/g, '').split(':').map(Number);
    if (timeParts.length >= 2) {
      hours = timeParts[0];
      minutes = timeParts[1];
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
    const kickoff = new Date(year, month - 1, day, hours, minutes);
    return new Date().getTime() >= kickoff.getTime();
  } catch {
    return false;
  }
};

export const FootballSlipEntryView: React.FC<FootballSlipEntryViewProps> = ({ onSlipCreated }) => {
  const { settings, matches, activeDate, addSlip } = useFootball();
  const isMyanmar = settings.language === 'my';

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [stakeAmount, setStakeAmount] = useState('5000');
  const [discountPercent, setDiscountPercent] = useState<number>(settings.defaultCustomerDiscount || 0);

  // Selected match legs
  const [selections, setSelections] = useState<FootballBetSelection[]>([]);

  // Toggle selection on a match
  const handleSelectBet = (
    matchId: string,
    betType: 'body_home' | 'body_away' | 'over' | 'under',
    odds: number
  ) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (isMatchExpired(match)) {
      alert(isMyanmar ? 'ပွဲချိန်စတင်ပြီး သို့မဟုတ် ပြီးဆုံးသွားသော ပွဲဖြစ်၍ ရွေးချယ်၍မရပါ' : 'Match has already kicked off or finished');
      return;
    }

    if (!odds || odds <= 0 || isNaN(odds)) {
      alert(isMyanmar ? 'ရေကြေး (Odds) မမှန်ကန်ပါ' : 'Invalid odds');
      return;
    }

    if (!settings.maxMaungCount || settings.maxMaungCount <= 0) {
      alert(isMyanmar ? 'Settings တွင် မောင်းအများဆုံး အရေအတွက် (Max Maung) သတ်မှတ်ပါ' : 'Please configure Max Maung in Settings');
      return;
    }
    const maxAllowed = settings.maxMaungCount;
    if (selections.length >= maxAllowed && !selections.some(s => s.matchId === matchId)) {
      alert(isMyanmar ? `မောင်း အများဆုံး ${maxAllowed} သင်းသာ ရွေးချယ်နိုင်ပါသည်` : `Maximum allowed parlay matches is ${maxAllowed}`);
      return;
    }

    let choiceLabel = '';
    let lineDescription = '';

    if (betType === 'body_home') {
      choiceLabel = `${match.homeTeam} (Body)`;
      lineDescription = `အကြော ${match.handicapTeam === 'home' ? match.homeTeam : (match.handicapTeam === 'away' ? match.awayTeam : 'Level')} ${match.handicapValue}`;
    } else if (betType === 'body_away') {
      choiceLabel = `${match.awayTeam} (Body)`;
      lineDescription = `အကြော ${match.handicapTeam === 'home' ? match.homeTeam : (match.handicapTeam === 'away' ? match.awayTeam : 'Level')} ${match.handicapValue}`;
    } else if (betType === 'over') {
      choiceLabel = `ဂိုးပေါင်း အပေါ် (${match.overUnderValue})`;
      lineDescription = `ဂိုးပေါင်း ${match.overUnderValue}`;
    } else {
      choiceLabel = `ဂိုးပေါင်း အောက် (${match.overUnderValue})`;
      lineDescription = `ဂိုးပေါင်း ${match.overUnderValue}`;
    }

    setSelections(prev => {
      // Remove any existing pick for this match
      const filtered = prev.filter(s => s.matchId !== matchId);

      // If clicked the same bet type that was already selected, it toggles off
      const existing = prev.find(s => s.matchId === matchId && s.betType === betType);
      if (existing) {
        return filtered;
      }

      return [
        ...filtered,
        {
          matchId,
          matchSummary: `${match.homeTeam} vs ${match.awayTeam}`,
          league: match.league,
          betType,
          choiceLabel,
          lineDescription,
          odds,
          outcome: 'pending'
        }
      ];
    });
  };

  // Calculate accumulated parlay odds multiplier (unrounded product)
  const combinedOdds = useMemo(() => {
    if (selections.length === 0) return 0;
    return selections.reduce((acc, s) => acc * s.odds, 1.0);
  }, [selections]);

  const stake = parseFloat(stakeAmount) || 0;
  const discountAmt = safeRound((stake * discountPercent) / 100);
  const netPayable = stake - discountAmt;
  const potentialPayout = safeRound(stake * combinedOdds);

  const isMaung = selections.length > 1;

  const handleCreateSlip = (e: React.FormEvent) => {
    e.preventDefault();
    if (selections.length === 0) {
      alert(isMyanmar ? 'အနည်းဆုံး ၁ ပွဲ ရွေးချယ်ပါ' : 'Select at least 1 match');
      return;
    }

    const minAllowed = settings.minMaungCount || 2;
    if (!settings.maxMaungCount || settings.maxMaungCount <= 0) {
      alert(isMyanmar ? 'Settings တွင် မောင်းအများဆုံး အရေအတွက် သတ်မှတ်ပါ' : 'Please configure Max Maung in Settings');
      return;
    }
    const maxAllowed = settings.maxMaungCount;
    if (isMaung && selections.length < minAllowed) {
      alert(isMyanmar ? `မောင်း အနည်းဆုံး ${minAllowed} သင်း ရွေးချယ်ရပါမည်` : `Minimum allowed parlay matches is ${minAllowed}`);
      return;
    }
    if (selections.length > maxAllowed) {
      alert(isMyanmar ? `မောင်း အများဆုံး ${maxAllowed} သင်းသာ ရွေးချယ်နိုင်ပါသည်` : `Maximum allowed parlay matches is ${maxAllowed}`);
      return;
    }

    if (stake <= 0) {
      alert(isMyanmar ? 'ထိုးကြေးငွေ ထည့်ပါ' : 'Enter a valid stake amount');
      return;
    }

    const hasInvalidOdds = selections.some(s => !s.odds || s.odds <= 0 || isNaN(s.odds));
    if (hasInvalidOdds) {
      alert(isMyanmar ? 'ရေကြေး (Odds) မမှန်ကန်သော ပွဲစဉ် ပါဝင်နေပါသည်' : 'Slip contains invalid odds');
      return;
    }

    if (settings.maxPayoutPerTicket > 0 && potentialPayout > settings.maxPayoutPerTicket) {
      alert(isMyanmar ? `အများဆုံး လျော်ကြေးငွေ ${formatAmount(settings.maxPayoutPerTicket, settings.currency)} ထက် ကျော်လွန်နေပါသည်` : `Potential payout exceeds maximum limit of ${formatAmount(settings.maxPayoutPerTicket, settings.currency)}`);
      return;
    }

    const slip = addSlip({
      roundDate: activeDate,
      customerName: customerName.trim() || (isMyanmar ? 'အထွေထွေ' : 'Walk-in'),
      customerPhone: customerPhone.trim() || undefined,
      slipType: isMaung ? 'maung' : 'body_single',
      teamCount: selections.length,
      selections,
      stakeAmount: stake,
      discountPercent,
      discountAmount: discountAmt,
      netPayable,
      combinedOdds,
      potentialPayout,
      status: 'active'
    });

    // Reset Form
    setSelections([]);
    setCustomerName('');
    setCustomerPhone('');
    setStakeAmount('5000');

    onSlipCreated(slip);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Match selection matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isMyanmar ? 'ပွဲစဉ်များ ရွေးချယ်ရန် (Fixtures Board)' : 'Select Match Bets'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {isMyanmar ? 'ဘော်ဒီ သို့မဟုတ် ဂိုးပေါင်း အကွက်များကို နှိပ်၍ ရွေးပါ' : 'Click Body or Over/Under buttons'}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200">
              {matches.length} {isMyanmar ? 'ပွဲ ရရှိနိုင်ပါသည်' : 'available'}
            </span>
          </div>

          {/* Fixtures Selector Cards */}
          <div className="space-y-3">
            {matches.map(match => {
              const currentPick = selections.find(s => s.matchId === match.id);
              const isExpired = isMatchExpired(match);

              return (
                <div
                  key={match.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{match.league}</span>
                    <span className="font-mono">{match.kickoffTime}</span>
                  </div>

                  {/* Match Matchup & Bet Choice Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Home Body */}
                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSelectBet(match.id, 'body_home', match.bodyOdds)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        currentPick?.betType === 'body_home'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{match.homeTeam}</div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className={currentPick?.betType === 'body_home' ? 'text-emerald-100' : 'text-slate-500'}>
                          {match.handicapTeam === 'home' ? `အကြောပေး ${match.handicapValue}` : 'Body'}
                        </span>
                        <span className="font-mono font-bold">x{match.bodyOdds}</span>
                      </div>
                    </button>

                    {/* Away Body */}
                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSelectBet(match.id, 'body_away', match.bodyOdds)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        currentPick?.betType === 'body_away'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{match.awayTeam}</div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className={currentPick?.betType === 'body_away' ? 'text-emerald-100' : 'text-slate-500'}>
                          {match.handicapTeam === 'away' ? `အကြောပေး ${match.handicapValue}` : 'Body'}
                        </span>
                        <span className="font-mono font-bold">x{match.bodyOdds}</span>
                      </div>
                    </button>
                  </div>

                  {/* Over/Under Choice Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Over */}
                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSelectBet(match.id, 'over', match.goalOdds)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        currentPick?.betType === 'over'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 text-indigo-900'
                      }`}
                    >
                      <span>ဂိုးပေါင်း အပေါ် ({match.overUnderValue})</span>
                      <span className="font-mono">x{match.goalOdds}</span>
                    </button>

                    {/* Under */}
                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => handleSelectBet(match.id, 'under', match.goalOdds)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        currentPick?.betType === 'under'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 text-indigo-900'
                      }`}
                    >
                      <span>ဂိုးပေါင်း အောက် ({match.overUnderValue})</span>
                      <span className="font-mono">x{match.goalOdds}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Ticket / Slip Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col h-full min-h-[500px]">
            {/* Ticket Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>{isMyanmar ? 'လောင်းကြေး ပြေစာ (Ticket)' : 'Betting Ticket'}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
                    {selections.length} {isMyanmar ? 'သင်း' : 'legs'}
                  </span>
                </h3>
                <span className="text-xs text-slate-500 font-bold">
                  {selections.length <= 1 ? (isMyanmar ? 'ဘော်ဒီသီးသန့် (Single)' : 'Single Bet') : `${selections.length} ${isMyanmar ? 'သင်းမောင်း (Parlay)' : 'Team Parlay'}`}
                </span>
              </div>

              {selections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelections([])}
                  className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  {isMyanmar ? 'အားလုံးဖျက်' : 'Clear'}
                </button>
              )}
            </div>

            {/* Selected Legs List */}
            <div className="flex-1 overflow-y-auto max-h-[300px] my-3 divide-y divide-slate-100">
              {selections.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Trophy className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-medium">
                    {isMyanmar ? 'ဘယ်ဘက်မှ ပွဲများကို ရွေးချယ်ပါ' : 'Select fixtures from left'}
                  </span>
                </div>
              ) : (
                selections.map((sel, idx) => (
                  <div key={sel.matchId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{sel.choiceLabel}</div>
                      <div className="text-[11px] text-slate-400">{sel.matchSummary}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700">x{sel.odds}</span>
                      <button
                        type="button"
                        onClick={() => setSelections(prev => prev.filter(s => s.matchId !== sel.matchId))}
                        className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Calculations */}
            <div className="border-t border-slate-200 pt-4 space-y-3 bg-slate-50 p-4 rounded-2xl">
              {/* Stake input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMyanmar ? 'ထိုးကြေး (ကျပ်)' : 'Stake Amount'}
                </label>
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
                  onFocus={(e) => e.target.select()}
                  className="w-full h-11 px-3 text-right font-mono text-lg font-bold rounded-xl border border-slate-300 focus:border-emerald-500 bg-white"
                />
              </div>

              {/* Quick stake buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[1000, 2000, 5000, 10000, 20000, 50000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStakeAmount(String(amt))}
                    className="px-2 py-1 bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer shrink-0"
                  >
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="text"
                  placeholder={isMyanmar ? 'ထိုးသူအမည်' : 'Customer'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 px-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder={isMyanmar ? 'ဖုန်း' : 'Phone'}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-9 px-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>

              {/* Multiplier and Payout */}
              <div className="border-t border-slate-200 pt-2 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>{isMyanmar ? 'စုစုပေါင်း အဆ (Combined Odds)' : 'Combined Odds'}:</span>
                  <span className="font-mono text-emerald-800 text-sm">x{combinedOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>{isMyanmar ? 'ကျသင့်ငွေ' : 'Net Payable'}:</span>
                  <span className="font-mono">{formatAmount(netPayable, settings.currency)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>{isMyanmar ? 'ဖြစ်နိုင်ခြေ လျော်ကြေး (Payout)' : 'Potential Payout'}:</span>
                  <span className="font-mono text-emerald-700 text-base">
                    {formatAmount(potentialPayout, settings.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleCreateSlip}
                disabled={selections.length === 0}
                className={`w-full h-12 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                  selections.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>{isMyanmar ? 'ဘောင်ချာထုတ် / စာရင်းသိမ်းမည်' : 'Save & Print Ticket'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
