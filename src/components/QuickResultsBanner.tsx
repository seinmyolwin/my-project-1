import React from 'react';
import { Trophy, Calendar, Sparkles, ChevronRight, Clock } from 'lucide-react';
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

  if (mode === '2d') {
    const settled = lottery2D.rounds
      .filter((r) => r.status === 'settled' || !!r.winningNumber)
      .slice(0, 4);

    if (settled.length === 0) return null;

    return (
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white rounded-2xl p-2.5 sm:px-4 shadow-sm border border-teal-800/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold border border-amber-400/30 shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-teal-200">
            အရင်ပွဲစဉ် ထွက်ဂဏန်းများ (ဇီးကွက် - 2D):
          </span>
        </div>

        {/* Badges of past winning numbers */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {settled.map((r) => {
            const isMorning = r.session === 'morning' || r.name.includes('မနက်') || r.name.includes('12:01');
            return (
              <div
                key={r.id}
                className="flex items-center gap-1.5 bg-slate-800/90 border border-teal-700/50 rounded-xl px-2.5 py-1 text-xs shadow-2xs shrink-0"
              >
                <span className="text-[10px] text-teal-300 font-medium">
                  {isMorning ? 'မနက်' : 'ညနေ'}:
                </span>
                <span className="font-mono font-black text-amber-400 text-sm px-1.5 py-0.2 bg-amber-950/60 border border-amber-500/40 rounded">
                  {r.winningNumber}
                </span>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-xs font-bold text-teal-300 hover:text-white flex items-center gap-1 hover:underline ml-auto cursor-pointer"
        >
          <span>ဇီးကွက် မှတ်တမ်းအားလုံး</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
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
          <span className="text-xs font-bold text-indigo-200">
            အရင်ပွဲစဉ် ထွက်ဂဏန်း (အိုးစည်လေး - 3D):
          </span>
          {latest && (
            <div className="flex items-center gap-2 bg-indigo-900/80 border border-indigo-700/60 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[11px] text-indigo-300">{latest.name.split(' ')[0]}:</span>
              <span className="font-mono font-black text-amber-400 text-base px-2 py-0.5 bg-amber-950/80 border border-amber-500/40 rounded tracking-wider">
                {latest.winningNumber}
              </span>
            </div>
          )}
        </div>

        {/* View All Button */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1 hover:underline ml-auto cursor-pointer"
        >
          <span>အိုးစည်လေး ရလဒ်မှတ်တမ်းအားလုံး</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
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

      <button
        type="button"
        onClick={onOpenHistory}
        className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1 hover:underline ml-auto cursor-pointer"
      >
        <span>ပစ်တိုင်းထောင် ရလဒ်မှတ်တမ်းအားလုံး</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
