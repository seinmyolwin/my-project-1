import React, { useState } from 'react';
import { Trophy, Calendar, Sparkles, ChevronRight, Clock, Eye, EyeOff } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode } from '../types';

interface QuickResultsBannerProps {
  mode: BookieMode;
  onOpenHistory: () => void;
}

export const QuickResultsBanner: React.FC<QuickResultsBannerProps> = ({ mode, onOpenHistory }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  // Hide & Show toggle state with local storage persistence
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('quick_results_banner_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleVisible = () => {
    setIsVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('quick_results_banner_visible', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  if (!isVisible) {
    return (
      <div className="flex justify-end py-1">
        <button
          type="button"
          onClick={toggleVisible}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-200/90 hover:bg-teal-100 text-slate-700 hover:text-teal-900 border border-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          title={mode === '2d' ? 'ဇီးကွက်ဂဏန်း Box အား ပြန်ဖွင့်ပြရန်' : 'ရလဒ် Box အား ဖွင့်ရန်'}
        >
          <Eye className="w-3.5 h-3.5 text-teal-700" />
          <span>{mode === '2d' ? 'ဇီးကွက်ဂဏန်း (ဖွင့်ရန်)' : mode === '3d' ? 'အိုးစည်လေးဂဏန်း (ဖွင့်ရန်)' : 'ပွဲရလဒ်များ (ဖွင့်ရန်)'}</span>
        </button>
      </div>
    );
  }

  if (mode === '2d') {
    // Determine the 2 target dates: Today and Yesterday (or recent 2 draw dates)
    const uniqueDates: string[] = Array.from(new Set<string>(lottery2D.rounds.map((r) => r.drawDate))).sort((a: string, b: string) =>
      b.localeCompare(a)
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDateStr = uniqueDates.includes(todayStr) ? todayStr : (uniqueDates[0] || todayStr);
    const yesterdayDateStr = uniqueDates.find((d) => d < todayDateStr) || uniqueDates[1] || '';

    // Today rounds (Morning 12:01 & Evening 04:30)
    const todayMorn = lottery2D.rounds.find(
      (r) =>
        r.drawDate === todayDateStr &&
        (r.session === 'morning' || r.name.includes('မနက်') || r.name.includes('12:01'))
    );
    const todayEve = lottery2D.rounds.find(
      (r) =>
        r.drawDate === todayDateStr &&
        (r.session === 'evening' || r.name.includes('ညနေ') || r.name.includes('04:30') || r.name.includes('16:30'))
    );

    // Yesterday rounds (Morning 12:01 & Evening 04:30)
    const yesterdayMorn = lottery2D.rounds.find(
      (r) =>
        r.drawDate === yesterdayDateStr &&
        (r.session === 'morning' || r.name.includes('မနက်') || r.name.includes('12:01'))
    );
    const yesterdayEve = lottery2D.rounds.find(
      (r) =>
        r.drawDate === yesterdayDateStr &&
        (r.session === 'evening' || r.name.includes('ညနေ') || r.name.includes('04:30') || r.name.includes('16:30'))
    );

    const formatDisplayDate = (dStr: string) => {
      if (!dStr) return '';
      try {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        }
      } catch {
        // fallback
      }
      return dStr;
    };

    let multiplierVal =
      lottery2D.activeRound?.multiplier || lottery2D.settings.defaultMultiplier || 80;

    return (
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-950 text-white rounded-2xl p-2.5 sm:px-4 shadow-sm border border-teal-800/60 flex flex-wrap items-center justify-between gap-3">
        {/* Title: ဇီးကွက်ဂဏန်း and အဆ */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold border border-teal-500/30 shrink-0">
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white tracking-wide">
              ဇီးကွက်ဂဏန်း
            </h3>
            <span className="text-[11px] font-bold text-teal-300 block">
              အဆ - {multiplierVal} ဆ
            </span>
          </div>
        </div>

        {/* 2 Days Display (Yesterday & Today) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* 1. Yesterday (အရင်ရက် / မနေ့က) */}
          {yesterdayDateStr && (
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-300 mb-1 flex items-center justify-between gap-2">
                <span>မနေ့က</span>
                <span className="text-slate-400 font-mono text-[9px]">({formatDisplayDate(yesterdayDateStr)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/60 rounded-lg px-2 py-0.5">
                  <span className="text-[10px] text-teal-300 font-medium">မနက်:</span>
                  <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                    {yesterdayMorn?.winningNumber || '--'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/60 rounded-lg px-2 py-0.5">
                  <span className="text-[10px] text-indigo-300 font-medium">ညနေ:</span>
                  <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                    {yesterdayEve?.winningNumber || '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Today (ဒီနေ့) */}
          <div className="bg-teal-950/80 border border-teal-700/70 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <div className="text-[10px] font-bold text-teal-200 mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ဒီနေ့</span>
              </div>
              <span className="text-teal-400 font-mono text-[9px]">({formatDisplayDate(todayDateStr)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-slate-900/90 border border-teal-700/60 rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-teal-300 font-medium">မနက်:</span>
                <span
                  className={`font-mono font-black text-xs sm:text-sm ${
                    todayMorn?.winningNumber
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {todayMorn?.winningNumber || '--'}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900/90 border border-teal-700/60 rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-indigo-300 font-medium">ညနေ:</span>
                <span
                  className={`font-mono font-black text-xs sm:text-sm ${
                    todayEve?.winningNumber
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {todayEve?.winningNumber || '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions: View History & Hide Toggle */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={onOpenHistory}
              className="text-xs font-bold text-teal-300 hover:text-white flex items-center gap-0.5 hover:underline cursor-pointer pl-1"
              title="ရလဒ်မှတ်တမ်းအားလုံး ကြည့်ရန်"
            >
              <span>မှတ်တမ်း</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleVisible}
              className="p-1 sm:px-2 sm:py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-teal-200 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ml-1"
              title="ဇီးကွက်ဂဏန်း Box အား ခေတ္တဖျောက်ထားရန်"
            >
              <EyeOff className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">ဖျောက်မည်</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === '3d') {
    const settled = lottery3D.rounds
      .filter((r) => r.status === 'settled' || !!r.winningNumber)
      .slice(0, 3);

    if (settled.length === 0) return null;

    const latest = settled[0];

    return (
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-2.5 sm:px-4 shadow-sm border border-indigo-800/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold border border-amber-400/30 shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
            <span className="text-xs font-bold text-indigo-200">
              အရင်ပွဲစဉ် ထွက်ဂဏန်း (အိုးစည်လေး):
            </span>
            <span className="text-[10px] text-indigo-300/80 font-mono">
              [ဒီနေ့: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}]
            </span>
          </div>
          {latest && (
            <div className="flex items-center gap-2 bg-indigo-900/80 border border-indigo-700/60 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[11px] text-indigo-300">{latest.name.split(' ')[0]}:</span>
              <span className="font-mono font-black text-amber-400 text-base px-2 py-0.5 bg-amber-950/80 border border-amber-500/40 rounded tracking-wider">
                {latest.winningNumber}
              </span>
            </div>
          )}
        </div>

        {/* View All & Hide Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>အိုးစည်လေး ရလဒ်မှတ်တမ်းအားလုံး</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleVisible}
            className="p-1 sm:px-2 sm:py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Box အား ခေတ္တဖျောက်ထားရန်"
          >
            <EyeOff className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">ဖျောက်မည်</span>
          </button>
        </div>
      </div>
    );
  }

  // Football
  const finished = football.matches.filter((m) => m.status === 'finished').slice(0, 3);
  if (finished.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-2xl p-2.5 sm:px-4 shadow-sm border border-emerald-800/60 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-bold border border-emerald-400/30 shrink-0">
          <Trophy className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-emerald-200">
          ပြီးဆုံးခဲ့သော ပစ်တိုင်းထောင် ပွဲရလဒ်များ:
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {finished.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-1.5 bg-slate-800/90 border border-emerald-700/50 rounded-xl px-2.5 py-1 text-xs shadow-2xs shrink-0"
          >
            <span className="text-slate-300 text-[11px]">{m.homeTeam}</span>
            <span className="font-mono font-black text-emerald-400 text-xs px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/40 rounded">
              {m.homeScore ?? 0} - {m.awayScore ?? 0}
            </span>
            <span className="text-slate-300 text-[11px]">{m.awayTeam}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>ပစ်တိုင်းထောင် ရလဒ်မှတ်တမ်းအားလုံး</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleVisible}
          className="p-1 sm:px-2 sm:py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          title="Box အား ခေတ္တဖျောက်ထားရန်"
        >
          <EyeOff className="w-3.5 h-3.5 text-emerald-300" />
          <span className="hidden sm:inline">ဖျောက်မည်</span>
        </button>
      </div>
    </div>
  );
};
