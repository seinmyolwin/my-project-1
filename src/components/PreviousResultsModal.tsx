import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Search,
  FileSpreadsheet,
  Sun,
  Moon,
  Shield,
  Award,
  Hash,
  Activity,
  Layers,
  Flame
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount, getPermutations } from '../utils/lotteryUtils';
import { parseHandicapGoals } from '../utils/footballUtils';
import { BookieMode } from '../types';

interface PreviousResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: BookieMode;
  onSelectRound3D?: (roundId: string) => void;
  onSelectRound2D?: (roundId: string) => void;
  onGoToWinningPayouts3D?: () => void;
  onGoToWinningPayouts2D?: () => void;
  onGoToFootballSlips?: () => void;
}

export const PreviousResultsModal: React.FC<PreviousResultsModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSelectRound3D,
  onSelectRound2D,
  onGoToWinningPayouts3D,
  onGoToWinningPayouts2D,
  onGoToFootballSlips
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter2D, setSessionFilter2D] = useState<'all' | 'morning' | 'evening'>('all');
  const [leagueFilterFB, setLeagueFilterFB] = useState<string>('all');

  // ==========================================
  // 3D SETTLED ROUNDS & PREVIOUS RESULTS
  // ==========================================
  const settled3DRounds = lottery3D.rounds
    .filter((r) => r.status === 'settled' || !!r.winningNumber)
    .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());

  const filtered3DRounds = settled3DRounds.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.name.toLowerCase().includes(q) ||
      r.drawDate.includes(q) ||
      (r.winningNumber && r.winningNumber.includes(q))
    );
  });

  // 3D Top Digits Frequency
  const digitFrequency3D = useMemo(() => {
    const counts: { [digit: string]: number } = {};
    for (let i = 0; i <= 9; i++) counts[String(i)] = 0;
    settled3DRounds.forEach((r) => {
      if (r.winningNumber && r.winningNumber.length === 3) {
        for (const char of r.winningNumber) {
          counts[char] = (counts[char] || 0) + 1;
        }
      }
    });
    return counts;
  }, [settled3DRounds]);

  // Export 3D to Excel
  const export3DResults = () => {
    const rows = settled3DRounds.map((r) => {
      const perms = r.winningNumber ? getPermutations(r.winningNumber).filter((p) => p !== r.winningNumber).join(', ') : '-';
      return {
        'ရက်စွဲ (Date)': r.drawDate,
        'ပွဲစဉ်အမည် (Round Name)': r.name,
        'တည့်ပေါက်ဂဏန်း (Winning Straight)': r.winningNumber || 'မထွက်သေး',
        'ပတ်လည်ဂဏန်းများ (Todd/Rumble)': perms,
        'တည့်ပေါက်ဆ (Multiplier)': `${r.multiplier || 600}x`,
        'ပတ်လည်ပေါက်ဆ (Todd Mult)': `${r.toddMultiplier || 100}x`,
        'ကော်မရှင် (Commission)': `${r.commissionRate || 10}%`,
        'အခြေအနေ (Status)': r.status === 'settled' ? 'ပြီးဆုံး' : 'ဖွင့်လှစ်ဆဲ'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '3D_Previous_Results');
    XLSX.writeFile(wb, `3D_Winning_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ==========================================
  // 2D SETTLED ROUNDS & PREVIOUS RESULTS
  // ==========================================
  const settled2DRounds = lottery2D.rounds
    .filter((r) => r.status === 'settled' || !!r.winningNumber)
    .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());

  const filtered2DRounds = settled2DRounds.filter((r) => {
    const isMorning = r.session === 'morning' || r.name.includes('မနက်') || r.name.includes('12:01');
    if (sessionFilter2D === 'morning' && !isMorning) return false;
    if (sessionFilter2D === 'evening' && isMorning) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.name.toLowerCase().includes(q) ||
      r.drawDate.includes(q) ||
      (r.winningNumber && r.winningNumber.includes(q))
    );
  });

  // 2D Brake Frequency
  const brakeFrequency2D = useMemo(() => {
    const counts: { [brake: string]: number } = {};
    for (let i = 0; i <= 9; i++) counts[`${i}B`] = 0;
    settled2DRounds.forEach((r) => {
      if (r.winningNumber && r.winningNumber.length === 2) {
        const brakeVal = (parseInt(r.winningNumber[0], 10) + parseInt(r.winningNumber[1], 10)) % 10;
        const key = `${brakeVal}B`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [settled2DRounds]);

  // Export 2D to Excel
  const export2DResults = () => {
    const rows = settled2DRounds.map((r) => {
      const isMorning = r.session === 'morning' || r.name.includes('မနက်') || r.name.includes('12:01');
      const head = r.winningNumber ? r.winningNumber[0] : '-';
      const tail = r.winningNumber ? r.winningNumber[1] : '-';
      const brake = r.winningNumber
        ? `${(parseInt(r.winningNumber[0], 10) + parseInt(r.winningNumber[1], 10)) % 10}B`
        : '-';

      return {
        'ရက်စွဲ (Date)': r.drawDate,
        'အချိန်ပိုင်း (Session)': isMorning ? 'မနက် (12:01 PM)' : 'ညနေ (04:30 PM)',
        'ပွဲစဉ်အမည် (Round Name)': r.name,
        'ထွက်ဂဏန်း (Winning 2D)': r.winningNumber || 'မထွက်သေး',
        'ထိပ်စီး (Head)': head,
        'နောက်ပိတ် (Tail)': tail,
        'ဘရိတ် (Brake)': brake,
        'ပေါက်ဆ (Multiplier)': `${r.multiplier || 85}x`,
        'အခြေအနေ (Status)': r.status === 'settled' ? 'ပြီးဆုံး' : 'ဖွင့်လှစ်ဆဲ'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '2D_Previous_Results');
    XLSX.writeFile(wb, `2D_Winning_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ==========================================
  // FOOTBALL FINISHED MATCHES & RESULTS
  // ==========================================
  const finishedMatches = football.matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());

  const filteredMatches = finishedMatches.filter((m) => {
    if (leagueFilterFB !== 'all' && m.league !== leagueFilterFB) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q) ||
      m.league.toLowerCase().includes(q) ||
      m.matchDate.includes(q)
    );
  });

  // Export Football to Excel
  const exportFootballResults = () => {
    const rows = finishedMatches.map((m) => {
      const hScore = m.homeScore ?? 0;
      const aScore = m.awayScore ?? 0;
      const totalGoals = hScore + aScore;

      // Evaluate Handicap Outcome
      const line = parseHandicapGoals(m.handicapValue);
      let homeSpread = 0;
      if (m.handicapTeam === 'home') homeSpread = -line;
      else if (m.handicapTeam === 'away') homeSpread = line;
      const adjustedDiff = (hScore + homeSpread) - aScore;

      let handicapWinner = 'သရေ (Draw)';
      if (adjustedDiff >= 0.5) handicapWinner = `${m.homeTeam} နိုင်`;
      else if (adjustedDiff === 0.25) handicapWinner = `${m.homeTeam} ဝက်နိုင်`;
      else if (adjustedDiff === -0.25) handicapWinner = `${m.awayTeam} ဝက်နိုင်`;
      else if (adjustedDiff <= -0.5) handicapWinner = `${m.awayTeam} နိုင်`;

      // Evaluate Over/Under Outcome
      const ouLine = parseHandicapGoals(m.overUnderValue);
      const ouDiff = totalGoals - ouLine;
      let goalWinner = 'သရေ (Draw)';
      if (ouDiff >= 0.5) goalWinner = 'ဂိုးပေါင်း အပေါ် (Over)';
      else if (ouDiff === 0.25) goalWinner = 'ဂိုးပေါင်း အပေါ် ၅၀ စား (Over Half)';
      else if (ouDiff === -0.25) goalWinner = 'ဂိုးပေါင်း အောက် ၅၀ စား (Under Half)';
      else if (ouDiff <= -0.5) goalWinner = 'ဂိုးပေါင်း အောက် (Under)';

      return {
        'ရက်စွဲ (Date)': m.matchDate,
        'လိဂ် (League)': m.league,
        'အိမ်ကွင်း (Home Team)': m.homeTeam,
        'အဝေးကွင်း (Away Team)': m.awayTeam,
        'ပွဲပြီးရလဒ် (FT Score)': `${hScore} - ${aScore}`,
        'ဘော်ဒီအကြောပေါက် (Handicap Line)': `${m.handicapTeam === 'home' ? m.homeTeam : m.handicapTeam === 'away' ? m.awayTeam : 'တူတူ'} (${m.handicapValue})`,
        'ဘော်ဒီအဖြေ (Handicap Winner)': handicapWinner,
        'ဂိုးပေါင်းပေါက်ကြေး (Goal Line)': m.overUnderValue,
        'ဂိုးပေါင်းအဖြေ (Over/Under Winner)': goalWinner,
        'စုစုပေါင်းဂိုး (Total Goals)': totalGoals
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Football_Match_Results');
    XLSX.writeFile(wb, `Football_Match_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ==================================================== */}
        {/* MODAL HEADER - STRICTLY THEMED & TITLED BY ACTIVE MODE */}
        {/* ==================================================== */}
        <div
          className={`px-5 py-4 text-white flex items-center justify-between border-b shrink-0 ${
            mode === '3d'
              ? 'bg-slate-950 border-indigo-950'
              : mode === '2d'
              ? 'bg-slate-950 border-teal-950'
              : 'bg-slate-950 border-emerald-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm ${
                mode === '3d'
                  ? 'bg-indigo-600/30 border-indigo-400/40 text-indigo-300'
                  : mode === '2d'
                  ? 'bg-teal-600/30 border-teal-400/40 text-teal-300'
                  : 'bg-emerald-600/30 border-emerald-400/40 text-emerald-300'
              }`}
            >
              <Trophy className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    mode === '3d'
                      ? 'bg-indigo-500 text-white'
                      : mode === '2d'
                      ? 'bg-teal-500 text-white'
                      : 'bg-emerald-500 text-slate-900'
                  }`}
                >
                  {mode === '3d' ? 'အိုးစည်လေး' : mode === '2d' ? 'ဇီးကွက်' : 'ပစ်တိုင်းထောင်'}
                </span>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {mode === '3d' && 'အိုးစည်လေး အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'}
                  {mode === '2d' && 'ဇီးကွက် အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'}
                  {mode === 'football' && 'ပစ်တိုင်းထောင် ပြီးဆုံးခဲ့သော ပွဲစဉ်ရလဒ်များနှင့် အဖြေများ'}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === '3d' && 'ပြီးဆုံးခဲ့သော အိုးစည်လေး ပွဲစဉ်များ၊ တည့်ပေါက်/ပတ်လည်ပေါက်မှတ်တမ်းများနှင့် ထွက်ဂဏန်းများ'}
                {mode === '2d' && 'ထွက်ရှိခဲ့သော မနက် (12:01 PM) နှင့် ညနေ (04:30 PM) ဇီးကွက် ထွက်ဂဏန်းမှတ်တမ်းများ'}
                {mode === 'football' && 'ပြီးဆုံးသွားသော ပွဲများ၏ ပွဲပြီးဂိုးရလဒ်၊ အကြောပေါက် (Handicap) နှင့် ဂိုးပေါင်း (Over/Under) ပစ်တိုင်းထောင် အနိုင်/အရှုံး မှတ်တမ်းများ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Excel Export Button */}
            <button
              type="button"
              onClick={mode === '3d' ? export3DResults : mode === '2d' ? export2DResults : exportFootballResults}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Excel စာရင်းထုတ်ယူမည်"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel ထုတ်မည်</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SUB-HEADER: SEARCH & FILTERS DEDICATED TO THIS MODE */}
        {/* ==================================================== */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                mode === '3d'
                  ? 'ဂဏန်း (ဥပမာ ၇၈၂) သို့မဟုတ် ရက်စွဲ ရှာမည်...'
                  : mode === '2d'
                  ? 'ဂဏန်း (ဥပမာ ၇၉) သို့မဟုတ် ရက်စွဲ ရှာမည်...'
                  : 'အသင်းအမည်၊ လိဂ် သို့မဟုတ် ရက်စွဲ ရှာမည်...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-300"
            />
          </div>

          {/* Mode-Specific Filters */}
          <div className="flex items-center gap-2">
            {mode === '2d' && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSessionFilter2D('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    sessionFilter2D === 'all'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  အားလုံး ({settled2DRounds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter2D('morning')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    sessionFilter2D === 'morning'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>မနက် 12:01</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter2D('evening')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    sessionFilter2D === 'evening'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Moon className="w-3 h-3" />
                  <span>ညနေ 04:30</span>
                </button>
              </div>
            )}

            {mode === 'football' && (
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={leagueFilterFB}
                  onChange={(e) => setLeagueFilterFB(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 rounded-xl px-2.5 py-1.5 font-semibold text-xs focus:outline-hidden"
                >
                  <option value="all">လိဂ်အားလုံး ({finishedMatches.length} ပွဲ)</option>
                  {football.leagues.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === '3d' && (
              <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>တည့်: {lottery3D.settings.defaultMultiplier || 600}x | ပတ်: {lottery3D.settings.defaultToddMultiplier || 100}x</span>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================== */}
        {/* MODAL BODY - STRICTLY ISOLATED TO ACTIVE MODE ONLY */}
        {/* ==================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* ==================================================== */}
          {/* 1. THREE D (3D) MODE VIEW ONLY */}
          {/* ==================================================== */}
          {mode === '3d' && (
            <div className="space-y-6">
              {/* 3D Overview Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">ပြီးဆုံးပွဲစဉ်မှတ်တမ်း</span>
                  <div className="text-xl font-black text-indigo-950 font-mono">
                    {settled3DRounds.length} <span className="text-xs font-normal text-slate-500">ကြိမ်</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">နောက်ဆုံး ထွက်ဂဏန်း</span>
                  <div className="text-xl font-black text-amber-600 font-mono tracking-wider">
                    {settled3DRounds[0]?.winningNumber || 'မထွက်သေး'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">တည့်ပေါက် အလျော်ဆ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {lottery3D.settings.defaultMultiplier || 600} <span className="text-xs font-normal text-slate-500">ဆ</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">ပတ်လည်ပေါက် အလျော်ဆ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {lottery3D.settings.defaultToddMultiplier || 100} <span className="text-xs font-normal text-slate-500">ဆ</span>
                  </div>
                </div>
              </div>

              {/* 3D Winning Digits Frequency Bar */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>၃ လုံး ပေါက်ဂဏန်းများတွင် ဂဏန်းတစ်ခုချင်း အကြိမ်ရေ (Digit Frequency 0-9)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">ယခင်ပွဲစဉ်များ အချက်အလက်</span>
                </div>

                <div className="grid grid-cols-10 gap-1.5 pt-1">
                  {Object.entries(digitFrequency3D).map(([digit, count]) => (
                    <div
                      key={digit}
                      className="flex flex-col items-center bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl p-2 transition-colors"
                    >
                      <span className="text-sm font-black font-mono text-slate-900">{digit}</span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-1.5 py-0.2 rounded-md mt-0.5">
                        {count} ခါ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3D Rounds List */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>၃ လုံး ပြီးဆုံးခဲ့သော ပွဲစဉ်မှတ်တမ်းများ ({filtered3DRounds.length})</span>
                </h3>

                {filtered3DRounds.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-500 font-medium text-sm">
                      {searchQuery ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ၃ လုံး မှတ်တမ်း မရှိပါ။' : 'ပြီးဆုံးခဲ့သော ၃ လုံး ပွဲစဉ်မှတ်တမ်း မရှိသေးပါ။'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered3DRounds.map((round) => {
                      const perms = round.winningNumber
                        ? getPermutations(round.winningNumber).filter((p) => p !== round.winningNumber)
                        : [];

                      const isActive = round.id === lottery3D.activeRoundId;

                      return (
                        <div
                          key={round.id}
                          className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-2xs space-y-4 relative ${
                            isActive
                              ? 'border-indigo-400 ring-2 ring-indigo-200/60 bg-indigo-50/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  အိုးစည်လေး (3D)
                                </span>
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {round.drawDate}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    လက်ရှိဖွင့်ထားဆဲ
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">{round.name}</h4>
                            </div>

                            {/* Large 3D Winning Number Pill */}
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] uppercase font-black text-slate-400 mb-1">
                                တည့်ပေါက်ဂဏန်း
                              </span>
                              <div className="px-4 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-amber-300 flex items-center justify-center font-mono text-3xl font-black shadow-md border-2 border-indigo-400 tracking-wider">
                                {round.winningNumber || '---'}
                              </div>
                            </div>
                          </div>

                          {/* Permutations (Todd numbers) */}
                          {perms.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>ပတ်လည်ပေါက် ဂဏန်းများ (Todd Combinations):</span>
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {perms.map((p) => (
                                  <span
                                    key={p}
                                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-mono font-bold text-xs shadow-2xs"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Multipliers info & Actions */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="text-slate-600">
                              ပေါက်ဆ: တည့် <strong className="text-slate-900">{round.multiplier || 600}x</strong> | ပတ်{' '}
                              <strong className="text-slate-900">{round.toddMultiplier || 100}x</strong>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  lottery3D.setActiveRoundId(round.id);
                                  if (onSelectRound3D) onSelectRound3D(round.id);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-200"
                              >
                                <span>စာရင်းဖွင့်ကြည့်မည်</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>

                              {onGoToWinningPayouts3D && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    lottery3D.setActiveRoundId(round.id);
                                    onGoToWinningPayouts3D();
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                                >
                                  <span>ပေါက်ဘောင်ချာစစ်</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 2. TWO D (2D) MODE VIEW ONLY */}
          {/* ==================================================== */}
          {mode === '2d' && (
            <div className="space-y-6">
              {/* 2D Overview Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-teal-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">ပြီးဆုံး ၂ လုံးပွဲစဉ်များ</span>
                  <div className="text-xl font-black text-teal-950 font-mono">
                    {settled2DRounds.length} <span className="text-xs font-normal text-slate-500">ကြိမ်</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">နောက်ဆုံး မနက် (12:01)</span>
                  <div className="text-xl font-black text-amber-600 font-mono">
                    {settled2DRounds.find((r) => r.session === 'morning' || r.name.includes('မနက်'))?.winningNumber || '--'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">နောက်ဆုံး ညနေ (04:30)</span>
                  <div className="text-xl font-black text-indigo-600 font-mono">
                    {settled2DRounds.find((r) => r.session === 'evening' || r.name.includes('ညနေ'))?.winningNumber || '--'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">ပုံမှန်အလျော်ဆ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {lottery2D.settings.defaultMultiplier || 85} <span className="text-xs font-normal text-slate-500">ဆ</span>
                  </div>
                </div>
              </div>

              {/* 2D Brake Frequency Bar */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-teal-500" />
                    <span>၂ လုံး ထွက်ဂဏန်းများ၏ ဘရိတ် အကြိမ်ရေ (Brake Frequency 0B - 9B)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">ယခင်ပွဲစဉ်များ အချက်အလက်</span>
                </div>

                <div className="grid grid-cols-10 gap-1.5 pt-1">
                  {Object.entries(brakeFrequency2D).map(([brake, count]) => (
                    <div
                      key={brake}
                      className="flex flex-col items-center bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl p-2 transition-colors"
                    >
                      <span className="text-xs font-black font-mono text-slate-900">{brake}</span>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100/60 px-1.5 py-0.2 rounded-md mt-0.5">
                        {count} ခါ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2D Rounds List */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-teal-600" />
                  <span>၂ လုံး ပြီးဆုံးခဲ့သော ပွဲစဉ်မှတ်တမ်းများ ({filtered2DRounds.length})</span>
                </h3>

                {filtered2DRounds.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-500 font-medium text-sm">
                      {searchQuery ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ၂ လုံး မှတ်တမ်း မရှိပါ။' : 'ပြီးဆုံးခဲ့သော ၂ လုံး ပွဲစဉ်မှတ်တမ်း မရှိသေးပါ။'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered2DRounds.map((round) => {
                      const isMorning = round.session === 'morning' || round.name.includes('မနက်') || round.name.includes('12:01');
                      const isActive = round.id === lottery2D.activeRoundId;
                      const num = round.winningNumber;
                      const brake = num ? (parseInt(num[0], 10) + parseInt(num[1], 10)) % 10 : null;

                      return (
                        <div
                          key={round.id}
                          className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-2xs space-y-4 relative ${
                            isActive
                              ? 'border-teal-400 ring-2 ring-teal-200/60 bg-teal-50/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1 ${
                                    isMorning
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                  }`}
                                >
                                  {isMorning ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                                  <span>{isMorning ? 'မနက် 12:01 PM' : 'ညနေ 04:30 PM'}</span>
                                </span>
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {round.drawDate}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    လက်ရှိဖွင့်ထားဆဲ
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">{round.name}</h4>
                            </div>

                            {/* Large 2D Winning Number Badge */}
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] uppercase font-black text-slate-400 mb-1">
                                ထွက်ဂဏန်း
                              </span>
                              <div className="w-16 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 flex items-center justify-center font-mono text-3xl font-black shadow-md border-2 border-amber-300 tracking-wider">
                                {round.winningNumber || '--'}
                              </div>
                            </div>
                          </div>

                          {/* Digits Breakdown (Head, Tail, Brake) */}
                          {num && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-700">
                              <div className="flex items-center gap-3">
                                <div>
                                  ထိပ်စီး: <strong className="text-slate-900 font-mono text-sm">{num[0]}</strong>
                                </div>
                                <span>•</span>
                                <div>
                                  နောက်ပိတ်: <strong className="text-slate-900 font-mono text-sm">{num[1]}</strong>
                                </div>
                                <span>•</span>
                                <div>
                                  ဘရိတ်: <strong className="text-teal-700 font-mono text-sm font-black">{brake}B</strong>
                                </div>
                              </div>

                              <span className="text-slate-500 font-medium text-[11px]">
                                အလျော်ဆ: <strong>{round.multiplier || 85}x</strong>
                              </span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500 text-[11px]">
                              {round.winningNumber ? 'ထွက်ဂဏန်း ရှင်းပြီး' : 'ရလဒ်မထွက်သေး'}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  lottery2D.setActiveRoundId(round.id);
                                  if (onSelectRound2D) onSelectRound2D(round.id);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors cursor-pointer border border-teal-200"
                              >
                                <span>စာရင်းဖွင့်ကြည့်မည်</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>

                              {onGoToWinningPayouts2D && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    lottery2D.setActiveRoundId(round.id);
                                    onGoToWinningPayouts2D();
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                                >
                                  <span>ပေါက်ဘောင်ချာစစ်</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. FOOTBALL (FB) MODE VIEW ONLY */}
          {/* ==================================================== */}
          {mode === 'football' && (
            <div className="space-y-6">
              {/* Football Overview Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">ပြီးဆုံးပွဲစဉ်များ</span>
                  <div className="text-xl font-black text-emerald-950 font-mono">
                    {finishedMatches.length} <span className="text-xs font-normal text-slate-500">ပွဲ</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">အိမ်ကွင်း နိုင်ပွဲများ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {finishedMatches.filter((m) => (m.homeScore || 0) > (m.awayScore || 0)).length} <span className="text-xs font-normal text-slate-500">ပွဲ</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">အဝေးကွင်း နိုင်ပွဲများ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {finishedMatches.filter((m) => (m.awayScore || 0) > (m.homeScore || 0)).length} <span className="text-xs font-normal text-slate-500">ပွဲ</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">သရေ ပွဲစဉ်များ</span>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {finishedMatches.filter((m) => (m.homeScore || 0) === (m.awayScore || 0)).length} <span className="text-xs font-normal text-slate-500">ပွဲ</span>
                  </div>
                </div>
              </div>

              {/* Finished Matches List */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ဘောလုံး ပြီးဆုံးခဲ့သော ပွဲစဉ်ရလဒ်များနှင့် အဖြေများ ({filteredMatches.length})</span>
                </h3>

                {filteredMatches.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-500 font-medium text-sm">
                      {searchQuery ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဘောလုံးပွဲစဉ် မရှိပါ။' : 'ပြီးဆုံးခဲ့သော ဘောလုံးပွဲစဉ် မှတ်တမ်း မရှိသေးပါ။'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMatches.map((m) => {
                      const hScore = m.homeScore ?? 0;
                      const aScore = m.awayScore ?? 0;
                      const totalGoals = hScore + aScore;

                      // Evaluate Handicap Outcome
                      const line = parseHandicapGoals(m.handicapValue);
                      let homeSpread = 0;
                      if (m.handicapTeam === 'home') homeSpread = -line;
                      else if (m.handicapTeam === 'away') homeSpread = line;
                      const adjustedDiff = (hScore + homeSpread) - aScore;

                      let handicapLabel = 'သရေ';
                      let handicapColor = 'bg-slate-100 text-slate-800 border-slate-200';
                      if (adjustedDiff >= 0.5) {
                        handicapLabel = `${m.homeTeam} အပြည့်နိုင်`;
                        handicapColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                      } else if (adjustedDiff === 0.25) {
                        handicapLabel = `${m.homeTeam} ဝက်နိုင်`;
                        handicapColor = 'bg-teal-100 text-teal-900 border-teal-300';
                      } else if (adjustedDiff === -0.25) {
                        handicapLabel = `${m.awayTeam} ဝက်နိုင်`;
                        handicapColor = 'bg-amber-100 text-amber-900 border-amber-300';
                      } else if (adjustedDiff <= -0.5) {
                        handicapLabel = `${m.awayTeam} အပြည့်နိုင်`;
                        handicapColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                      }

                      // Evaluate Over/Under Outcome
                      const ouLine = parseHandicapGoals(m.overUnderValue);
                      const ouDiff = totalGoals - ouLine;
                      let goalLabel = 'သရေ';
                      let goalColor = 'bg-slate-100 text-slate-800 border-slate-200';
                      if (ouDiff >= 0.5) {
                        goalLabel = 'ဂိုးပေါင်း အပေါ်ပေါက် (Over)';
                        goalColor = 'bg-blue-100 text-blue-900 border-blue-300';
                      } else if (ouDiff === 0.25) {
                        goalLabel = 'ဂိုးပေါင်း အပေါ် ဝက်နိုင်';
                        goalColor = 'bg-cyan-100 text-cyan-900 border-cyan-300';
                      } else if (ouDiff === -0.25) {
                        goalLabel = 'ဂိုးပေါင်း အောက် ဝက်နိုင်';
                        goalColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
                      } else if (ouDiff <= -0.5) {
                        goalLabel = 'ဂိုးပေါင်း အောက်ပေါက် (Under)';
                        goalColor = 'bg-purple-100 text-purple-900 border-purple-300';
                      }

                      return (
                        <div
                          key={m.id}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 shadow-2xs space-y-3.5 transition-all"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{m.league}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {m.matchDate} ({m.kickoffTime})
                            </span>
                          </div>

                          {/* Match Score Display */}
                          <div className="bg-slate-900 rounded-2xl p-3.5 text-white flex items-center justify-between gap-2 shadow-sm">
                            <div className="flex-1 text-right pr-2">
                              <span className="font-black text-sm block leading-tight truncate">
                                {m.homeTeam}
                              </span>
                              {m.handicapTeam === 'home' && (
                                <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                                  အကြောပေး (-{m.handicapValue})
                                </span>
                              )}
                            </div>

                            <div className="px-3.5 py-1.5 bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-black text-xl rounded-xl shadow-xs">
                              {hScore} - {aScore}
                            </div>

                            <div className="flex-1 text-left pl-2">
                              <span className="font-black text-sm block leading-tight truncate">
                                {m.awayTeam}
                              </span>
                              {m.handicapTeam === 'away' && (
                                <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                                  အကြောပေး (-{m.handicapValue})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Handicap & Goal Settlement Results */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                ဘော်ဒီ အဖြေရလဒ်:
                              </span>
                              <div className={`px-2 py-1 rounded-lg text-xs font-black border ${handicapColor}`}>
                                {handicapLabel}
                              </div>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                ဂိုးပေါင်း ({m.overUnderValue} / စုစုပေါင်း {totalGoals} ဂိုး):
                              </span>
                              <div className={`px-2 py-1 rounded-lg text-xs font-black border ${goalColor}`}>
                                {goalLabel}
                              </div>
                            </div>
                          </div>

                          {/* Link to view tickets on that date */}
                          {onGoToFootballSlips && (
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-500 text-[11px]">
                                ရေကြေး: ဘော်ဒီ {m.bodyOdds} | ဂိုးပေါင်း {m.goalOdds}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  football.setActiveDate(m.matchDate);
                                  onGoToFootballSlips();
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
                              >
                                <span>ထိုရက်စွဲ စာရင်းကြည့်မည်</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* MODAL FOOTER */}
        {/* ==================================================== */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {mode === '3d' && '၃ လုံး စာရင်းစနစ်နှင့် တိုက်ရိုက်ချိတ်ဆက်ထားသော မှတ်တမ်းများ ဖြစ်ပါသည်။'}
              {mode === '2d' && '၂ လုံး စာရင်းစနစ်နှင့် တိုက်ရိုက်ချိတ်ဆက်ထားသော မှတ်တမ်းများ ဖြစ်ပါသည်။'}
              {mode === 'football' && 'ပစ်တိုင်းထောင် အားကစား စာရင်းစနစ်နှင့် တိုက်ရိုက်ချိတ်ဆက်ထားသော ပွဲစဉ်များ ဖြစ်ပါသည်။'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
