/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Layers,
  Trophy,
  Copy,
  Check,
  Plus,
  Trash2,
  Terminal,
  PlayCircle,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
  Info
} from 'lucide-react';
import {
  CommandRule,
  CommandRuleModule,
  loadCommandRules,
  saveCommandRules,
  resetCommandRulesToDefault
} from '../utils/commandRulesUtils';
import { parseTwoDBatchInput } from '../utils/twoDLotteryUtils';
import { parseQuickBetText, formatAmount } from '../utils/lotteryUtils';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useLottery } from '../context/LotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode } from '../types';

interface CommandRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode?: BookieMode;
  onApplyToActiveCart?: (mode: BookieMode, payload: any) => void;
}

export const CommandRulesModal: React.FC<CommandRulesModalProps> = ({
  isOpen,
  onClose,
  activeMode = '2d',
  onApplyToActiveCart
}) => {
  const [activeTab, setActiveTab] = useState<'2d' | '3d' | 'football' | 'custom'>(
    activeMode === 'football' ? 'football' : activeMode === '3d' ? '3d' : '2d'
  );

  const [rules, setRules] = useState<CommandRule[]>(() => loadCommandRules());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Module-specific playground/test inputs & confirmation states
  const [input2d, setInput2d] = useState<string>('');
  const [confirmed2d, setConfirmed2d] = useState<boolean>(() => {
    try { return localStorage.getItem('is_2d_rule_confirmed') === 'true'; } catch { return false; }
  });

  const [input3d, setInput3d] = useState<string>('');
  const [confirmed3d, setConfirmed3d] = useState<boolean>(() => {
    try { return localStorage.getItem('is_3d_rule_confirmed') === 'true'; } catch { return false; }
  });

  const [inputFb, setInputFb] = useState<string>('');
  const [confirmedFb, setConfirmedFb] = useState<boolean>(() => {
    try { return localStorage.getItem('is_fb_rule_confirmed') === 'true'; } catch { return false; }
  });

  // Custom rule form modal/drawer
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleModule, setNewRuleModule] = useState<CommandRuleModule>(
    activeMode === 'football' ? 'football' : activeMode === '3d' ? '3d' : '2d'
  );
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleExample, setNewRuleExample] = useState('');
  const [newRuleOutput, setNewRuleOutput] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  // Parsers for each module
  const result2d = useMemo(() => {
    if (!input2d.trim()) return { items: [], warnings: [], totalAmount: 0 };
    const result = parseTwoDBatchInput(input2d, 1000);
    const items = Array.isArray(result) ? result : (result as any).items || [];
    const warnings = (result as any).warnings || [];
    const totalAmount = items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0);
    return { items, warnings, totalAmount };
  }, [input2d]);

  const result3d = useMemo(() => {
    if (!input3d.trim()) return { items: [], warnings: [], totalAmount: 0 };
    const result = parseQuickBetText(input3d);
    const items = result.items || [];
    const warnings = result.errors || [];
    const totalAmount = items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0);
    return { items, warnings, totalAmount };
  }, [input3d]);

  const resultFb = useMemo(() => {
    if (!inputFb.trim()) return { items: [], warnings: [], totalAmount: 0 };
    const lines = inputFb.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const items: any[] = [];
    const warnings: string[] = [];

    lines.forEach(line => {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const amt = parseInt(tokens[tokens.length - 1].replace(/\D/g, ''), 10) || 5000;
        const teamPart = tokens.slice(0, tokens.length - 1).join(' ');
        const isOver = /over|အပေါ်/i.test(line);
        const isUnder = /under|အောက်/i.test(line);
        items.push({
          id: `fb-sim-${Math.random()}`,
          team: teamPart.replace(/over|under|အပေါ်|အောက်|body/gi, '').trim(),
          type: isOver ? 'Over' : isUnder ? 'Under' : 'Body',
          amount: amt
        });
      } else {
        warnings.push(`[${line}] ဖော်ပြချက်တွင် ထိုးကြေးငွေ ထည့်သွင်းပါ`);
      }
    });
    const totalAmount = items.reduce((sum: number, it: any) => sum + (it.amount || 0), 0);
    return { items, warnings, totalAmount };
  }, [inputFb]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim()) {
      alert('စည်းမျဉ်းအမည်နှင့် ပုံစံကို ဖြည့်သွင်းပါ');
      return;
    }

    const newRule: CommandRule = {
      id: `custom-rule-${Date.now()}`,
      module: newRuleModule,
      name: newRuleName.trim(),
      syntaxPattern: newRulePattern.trim(),
      exampleInput: newRuleExample.trim() || newRulePattern.trim(),
      exampleOutput: newRuleOutput.trim() || 'အလိုအလျောက် သတ်မှတ်သည့်အတိုင်း ယူပါမည်',
      description: newRuleDesc.trim() || 'အသုံးပြုသူ ကိုယ်တိုင် သတ်မှတ်ထားသော ထိုးကြေးစည်းမျဉ်းဖြစ်ပါသည်',
      isCustom: true,
      isEnabled: true,
      category: 'custom',
      createdAt: new Date().toISOString()
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveCommandRules(updated);

    setNewRuleName('');
    setNewRulePattern('');
    setNewRuleExample('');
    setNewRuleOutput('');
    setNewRuleDesc('');
    setIsAddRuleOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('ဤစည်းမျဉ်းကို ဖျက်ပစ်ရန် သေချာပါသလား?')) {
      const updated = rules.filter(r => r.id !== id);
      setRules(updated);
      saveCommandRules(updated);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('မူလသတ်မှတ်ထားသော လမ်းညွှန်ချက် စည်းမျဉ်းများအတိုင်း ပြန်လည်ထားရှိမည်လား?')) {
      const defs = resetCommandRulesToDefault();
      setRules(defs);
    }
  };

  const handleConfirm2d = () => {
    setConfirmed2d(true);
    try { localStorage.setItem('is_2d_rule_confirmed', 'true'); } catch {}
    setAppliedToast('ဇီးကွက် စည်းမျဉ်းကို အတည်ပြုပြီးပါပြီ!');
    setTimeout(() => setAppliedToast(null), 3000);
  };

  const handleConfirm3d = () => {
    setConfirmed3d(true);
    try { localStorage.setItem('is_3d_rule_confirmed', 'true'); } catch {}
    setAppliedToast('အိုးစည် စည်းမျဉ်းကို အတည်ပြုပြီးပါပြီ!');
    setTimeout(() => setAppliedToast(null), 3000);
  };

  const handleConfirmFb = () => {
    setConfirmedFb(true);
    try { localStorage.setItem('is_fb_rule_confirmed', 'true'); } catch {}
    setAppliedToast('ပစ်တိုင်းထောင် စည်းမျဉ်းကို အတည်ပြုပြီးပါပြီ!');
    setTimeout(() => setAppliedToast(null), 3000);
  };

  const handleApplyCart = (mode: BookieMode, items: any[]) => {
    if (!items || items.length === 0) {
      alert('ထည့်သွင်းရန် စာရင်းမရှိပါ');
      return;
    }
    if (onApplyToActiveCart) {
      onApplyToActiveCart(mode, items);
      setAppliedToast(`(${items.length}) ကွက်ကို တိုက်ရိုက် စာရင်းသွင်းပြီးပါပြီ!`);
      setTimeout(() => setAppliedToast(null), 3000);
    }
  };

  const filteredRules = rules.filter(r => {
    if (activeTab === 'custom') return r.isCustom;
    return r.module === activeTab;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>ထိုးကြေး ဂဏန်း ယူနည်းလမ်းညွှန်</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                  Command & Rules Engine
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                အိုးစည် (3D)၊ ဇီးကွက် (2D) နှင့် ပစ်တိုင်းထောင် (Football) ထိုးသားများ ထိုးသည့်ပုံစံများအတိုင်း စာသား/ဓာတ်ပုံ/တယ်လီဂရမ်မှ အလိုအလျောက် စာရင်းယူနည်း စည်းမျဉ်းများ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 pt-2 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('2d')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === '2d'
                  ? 'bg-white text-teal-700 shadow-xs border-t-2 border-t-teal-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>ဇီးကွက် (2D)</span>
            </button>

            <button
              onClick={() => setActiveTab('3d')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === '3d'
                  ? 'bg-white text-indigo-700 shadow-xs border-t-2 border-t-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>အိုးစည်လေး (3D)</span>
            </button>

            <button
              onClick={() => setActiveTab('football')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'football'
                  ? 'bg-white text-emerald-700 shadow-xs border-t-2 border-t-emerald-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>ပစ်တိုင်းထောင် (Football)</span>
            </button>

            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-white text-amber-700 shadow-xs border-t-2 border-t-amber-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Plus className="w-4 h-4 text-amber-600" />
              <span>စိတ်ကြိုက် စည်းမျဉ်းများ ({rules.filter(r => r.isCustom).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => {
                setNewRuleModule(activeTab === 'custom' ? '2d' : activeTab);
                setIsAddRuleOpen(true);
              }}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              title="လမ်းညွှန်ချက် အသစ် ဖန်တီးရန်"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">စည်းမျဉ်းအသစ်</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
          
          {/* TAB CONTENT: 2D (ဇီးကွက်) */}
          {activeTab === '2d' && (
            <div className="space-y-6">
              {/* Dual-Box Test & Verification for 2D */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-teal-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                      2D
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">ဇီးကွက် (2D) စမ်းသပ်ထည့်သွင်းခန်းနှင့် ညွှန်ကြားချက် အတည်ပြုခြင်း</h3>
                      <p className="text-[11px] text-slate-500">ဘယ်ဘက်တွင် စာသား/တယ်လီဂရမ်/ဓာတ်ပုံမှ ကူးလာသောစာသားထည့်ပါ၊ ညာဘက်တွင် ဂဏန်းယူပုံ လက်တွေ့မြင်ရမည်။</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Box: Input */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px]">၁</span>
                          <span>ဘယ်ဘက် Box: ထိုးကြေး စာသားထည့်ရန်</span>
                        </label>
                        <button onClick={() => setInput2d('')} className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer">ဖျက်မည်</button>
                      </div>
                      <textarea
                        rows={5}
                        value={input2d}
                        onChange={(e) => setInput2d(e.target.value)}
                        placeholder="ဥပမာ - ၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀ သို့မဟုတ် ၃၄ ၄၆ ၃၇ ၁၀၀၀/၅၀၀"
                        className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">အက္ခရာ: {input2d.length} လုံး</span>
                      <button onClick={() => handleCopy(input2d, 'copy-2d')} className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === 'copy-2d' ? 'ကူးပြီး' : 'ကူးယူ'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Box: Live Preview */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">၂</span>
                          <span>ညာဘက် Box: ယူမည့်ပုံစံ (Live Preview)</span>
                        </label>
                        <span className="text-xs font-bold text-teal-700">
                          {formatAmount(result2d.totalAmount, 'MMK')} ({result2d.items.length} ကွက်)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-40 overflow-y-auto">
                        {result2d.items.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">ဘယ်ဘက်တွင် ထိုးကြေး စာသားထည့်ပါ</div>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-2">စဥ်</th>
                                <th className="p-2">ဂဏန်း</th>
                                <th className="p-2">အမျိုးအစား</th>
                                <th className="p-2 text-right">ထိုးကြေး</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result2d.items.map((it: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-slate-400">{idx + 1}</td>
                                  <td className="p-2 font-black text-slate-900">{it.number}</td>
                                  <td className="p-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${it.isRumble ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                      {it.isRumble ? 'အာ' : 'ဒဲ့'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-black text-slate-900">{formatAmount(it.amount, 'MMK')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      {confirmed2d ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>အတည်ပြုပြီး! ဤပုံစံအတိုင်း ဆက်လက်ယူပါမည်။</span>
                          </span>
                          <button onClick={() => setConfirmed2d(false)} className="text-[11px] underline cursor-pointer">ပြင်မည်</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">မှန်ကန်ပါက အတည်ပြုပါ</span>
                          <button
                            onClick={handleConfirm2d}
                            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>မှန်တယ်ဆို အတည်ပြုမည်</span>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-700 font-bold">{appliedToast}</span>
                        <button
                          onClick={() => handleApplyCart('2d', result2d.items)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>တိုက်ရိုက် စာရင်းသွင်းမည်</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2D Rules List ("ဒီခုလုပ်သည် ဒီလိုယူသည်" concise display) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>ဇီးကွက် (2D) အတည်ပြုပြီး စည်းမျဉ်းများနှင့် ဂဏန်းယူပုံများ</span>
                  <button onClick={handleResetDefaults} className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="w-3 h-3" />
                    <span>မူလအတိုင်းပြန်ထား</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-900 text-xs">{rule.name}</h4>
                        {rule.isCustom && (
                          <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-[11px] font-black text-teal-800 bg-teal-50/80 p-1.5 rounded-lg border border-teal-100">
                        {rule.syntaxPattern}
                      </div>
                      <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 text-[11px]">နမူနာ: {rule.exampleInput}</span>
                          <button onClick={() => handleCopy(rule.exampleInput, rule.id)} className="text-[10px] text-amber-700 hover:underline">
                            {copiedId === rule.id ? 'ကူးပြီး' : 'ကူးယူ'}
                          </button>
                        </div>
                        <div className="text-slate-700 text-[11px]">
                          <span className="font-bold">ယူသည် - </span>
                          <span className="text-emerald-700 font-bold">{rule.exampleOutput}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: 3D (အိုးစည်လေး) */}
          {activeTab === '3d' && (
            <div className="space-y-6">
              {/* Dual-Box Test & Verification for 3D */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      3D
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">အိုးစည်လေး (3D) စမ်းသပ်ထည့်သွင်းခန်းနှင့် ညွှန်ကြားချက် အတည်ပြုခြင်း</h3>
                      <p className="text-[11px] text-slate-500">ဘယ်ဘက်တွင် 3D ထိုးကြေးစာသားထည့်ပါ၊ ညာဘက်တွင် ဂဏန်းယူပုံ လက်တွေ့မြင်ရမည်။</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Box: Input */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">၁</span>
                          <span>ဘယ်ဘက် Box: 3D ထိုးကြေး စာသားထည့်ရန်</span>
                        </label>
                        <button onClick={() => setInput3d('')} className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer">ဖျက်မည်</button>
                      </div>
                      <textarea
                        rows={5}
                        value={input3d}
                        onChange={(e) => setInput3d(e.target.value)}
                        placeholder="ဥပမာ - 123 456 1000/200 သို့မဟုတ် 123 R 1000"
                        className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">အက္ခရာ: {input3d.length} လုံး</span>
                      <button onClick={() => handleCopy(input3d, 'copy-3d')} className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === 'copy-3d' ? 'ကူးပြီး' : 'ကူးယူ'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Box: Live Preview */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">၂</span>
                          <span>ညာဘက် Box: ယူမည့်ပုံစံ (Live Preview)</span>
                        </label>
                        <span className="text-xs font-bold text-indigo-700">
                          {formatAmount(result3d.totalAmount, 'MMK')} ({result3d.items.length} ကွက်)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-40 overflow-y-auto">
                        {result3d.items.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">ဘယ်ဘက်တွင် 3D ထိုးကြေး စာသားထည့်ပါ</div>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-2">စဥ်</th>
                                <th className="p-2">ဂဏန်း</th>
                                <th className="p-2">အမျိုးအစား</th>
                                <th className="p-2 text-right">ထိုးကြေး</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result3d.items.map((it: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-slate-400">{idx + 1}</td>
                                  <td className="p-2 font-black text-slate-900">{it.number}</td>
                                  <td className="p-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                      {it.isRumble ? 'အာ' : 'ဒဲ့'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-black text-slate-900">{formatAmount(it.amount, 'MMK')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      {confirmed3d ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>အတည်ပြုပြီး! ဤပုံစံအတိုင်း ဆက်လက်ယူပါမည်။</span>
                          </span>
                          <button onClick={() => setConfirmed3d(false)} className="text-[11px] underline cursor-pointer">ပြင်မည်</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">မှန်ကန်ပါက အတည်ပြုပါ</span>
                          <button
                            onClick={handleConfirm3d}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>မှန်တယ်ဆို အတည်ပြုမည်</span>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-700 font-bold">{appliedToast}</span>
                        <button
                          onClick={() => handleApplyCart('3d', result3d.items)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>တိုက်ရိုက် စာရင်းသွင်းမည်</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3D Rules List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>အိုးစည်လေး (3D) စည်းမျဉ်းများနှင့် ဂဏန်းယူပုံများ</span>
                  <button onClick={handleResetDefaults} className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="w-3 h-3" />
                    <span>မူလအတိုင်းပြန်ထား</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-900 text-xs">{rule.name}</h4>
                        {rule.isCustom && (
                          <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-[11px] font-black text-indigo-800 bg-indigo-50/80 p-1.5 rounded-lg border border-indigo-100">
                        {rule.syntaxPattern}
                      </div>
                      <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 text-[11px]">နမူနာ: {rule.exampleInput}</span>
                          <button onClick={() => handleCopy(rule.exampleInput, rule.id)} className="text-[10px] text-amber-700 hover:underline">
                            {copiedId === rule.id ? 'ကူးပြီး' : 'ကူးယူ'}
                          </button>
                        </div>
                        <div className="text-slate-700 text-[11px]">
                          <span className="font-bold">ယူသည် - </span>
                          <span className="text-emerald-700 font-bold">{rule.exampleOutput}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: FOOTBALL (ပစ်တိုင်းထောင်) */}
          {activeTab === 'football' && (
            <div className="space-y-6">
              {/* Dual-Box Test & Verification for Football */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      FB
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">ပစ်တိုင်းထောင် (Football) စမ်းသပ်ထည့်သွင်းခန်းနှင့် ညွှန်ကြားချက် အတည်ပြုခြင်း</h3>
                      <p className="text-[11px] text-slate-500">ဘယ်ဘက်တွင် ဘောလုံးထိုးကြေး စာသားထည့်ပါ၊ ညာဘက်တွင် ယူမည့်ပုံစံ လက်တွေ့မြင်ရမည်။</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Box: Input */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">၁</span>
                          <span>ဘယ်ဘက် Box: ဘောလုံးထိုးကြေး စာသားထည့်ရန်</span>
                        </label>
                        <button onClick={() => setInputFb('')} className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer">ဖျက်မည်</button>
                      </div>
                      <textarea
                        rows={5}
                        value={inputFb}
                        onChange={(e) => setInputFb(e.target.value)}
                        placeholder="ဥပမာ - မန်ယူ 5000\nChelsea Over 3000"
                        className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">အက္ခရာ: {inputFb.length} လုံး</span>
                      <button onClick={() => handleCopy(inputFb, 'copy-fb')} className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === 'copy-fb' ? 'ကူးပြီး' : 'ကူးယူ'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Box: Live Preview */}
                  <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">၂</span>
                          <span>ညာဘက် Box: ယူမည့်ပုံစံ (Live Preview)</span>
                        </label>
                        <span className="text-xs font-bold text-emerald-700">
                          {formatAmount(resultFb.totalAmount, 'MMK')} ({resultFb.items.length} ပွဲ)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-40 overflow-y-auto">
                        {resultFb.items.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">ဘယ်ဘက်တွင် ဘောလုံးထိုးကြေး စာသားထည့်ပါ</div>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-2">စဥ်</th>
                                <th className="p-2">အသင်း</th>
                                <th className="p-2">အမျိုးအစား</th>
                                <th className="p-2 text-right">ထိုးကြေး</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {resultFb.items.map((it: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-slate-400">{idx + 1}</td>
                                  <td className="p-2 font-black text-slate-900">{it.team}</td>
                                  <td className="p-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      {it.type}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-black text-slate-900">{formatAmount(it.amount, 'MMK')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      {confirmedFb ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>အတည်ပြုပြီး! ဤပုံစံအတိုင်း ဆက်လက်ယူပါမည်။</span>
                          </span>
                          <button onClick={() => setConfirmedFb(false)} className="text-[11px] underline cursor-pointer">ပြင်မည်</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">မှန်ကန်ပါက အတည်ပြုပါ</span>
                          <button
                            onClick={handleConfirmFb}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>မှန်တယ်ဆို အတည်ပြုမည်</span>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-700 font-bold">{appliedToast}</span>
                        <button
                          onClick={() => handleApplyCart('football', resultFb.items)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>တိုက်ရိုက် စာရင်းသွင်းမည်</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Football Rules List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>ပစ်တိုင်းထောင် (Football) စည်းမျဉ်းများနှင့် ဂဏန်းယူပုံများ</span>
                  <button onClick={handleResetDefaults} className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="w-3 h-3" />
                    <span>မူလအတိုင်းပြန်ထား</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-900 text-xs">{rule.name}</h4>
                        {rule.isCustom && (
                          <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-[11px] font-black text-emerald-800 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
                        {rule.syntaxPattern}
                      </div>
                      <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 text-[11px]">နမူနာ: {rule.exampleInput}</span>
                          <button onClick={() => handleCopy(rule.exampleInput, rule.id)} className="text-[10px] text-amber-700 hover:underline">
                            {copiedId === rule.id ? 'ကူးပြီး' : 'ကူးယူ'}
                          </button>
                        </div>
                        <div className="text-slate-700 text-[11px]">
                          <span className="font-bold">ယူသည် - </span>
                          <span className="text-emerald-700 font-bold">{rule.exampleOutput}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: CUSTOM RULES */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>စိတ်ကြိုက် ဖန်တီးထားသော စည်းမျဉ်းများ ({filteredRules.length} ခု)</span>
                <button
                  onClick={() => setIsAddRuleOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>စည်းမျဉ်းအသစ်ထည့်ရန်</span>
                </button>
              </div>

              {filteredRules.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 space-y-2">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold">စိတ်ကြိုက် စည်းမျဉ်း မရှိသေးပါ</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRules.map((rule) => (
                    <div key={rule.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                            {rule.module.toUpperCase()} - စိတ်ကြိုက်
                          </span>
                          <h4 className="font-black text-slate-900 text-sm mt-1">{rule.name}</h4>
                        </div>
                        <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="font-mono text-xs font-black text-slate-800 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        {rule.syntaxPattern}
                      </div>
                      <p className="text-xs text-slate-600">{rule.description}</p>
                      <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 text-xs space-y-1">
                        <div className="font-bold text-amber-900">နမူနာ: {rule.exampleInput}</div>
                        <div className="text-emerald-700 font-bold">ယူမည့်ပုံစံ: {rule.exampleOutput}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>သက်ဆိုင်ရာ လုပ်ငန်းအလိုက် ထိုးကြေးဂဏန်း ယူနည်းလမ်းညွှန်များကို အလိုအလျောက် သုံးစွဲနေပါသည်</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs active:scale-95"
          >
            ပိတ်မည်
          </button>
        </div>

      </div>

      {/* CREATE CUSTOM RULE MODAL */}
      {isAddRuleOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>စိတ်ကြိုက် ထိုးကြေး စည်းမျဉ်းအသစ် ဖန်တီးရန်</span>
              </h3>
              <button onClick={() => setIsAddRuleOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">စည်းမျဉ်း အမည် (ဥပမာ: "ကိုအောင် အထူးထိုးကွက်"):</label>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="စည်းမျဉ်း အမည် ရိုက်ထည့်ပါ"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">သက်ဆိုင်ရာ လုပ်ငန်း (Module):</label>
                <select
                  value={newRuleModule}
                  onChange={(e) => setNewRuleModule(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="2d">ဇီးကွက် (2D)</option>
                  <option value="3d">အိုးစည်လေး (3D)</option>
                  <option value="football">ပစ်တိုင်းထောင် (Football)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ရေးသားရမည့် Syntax / ပုံစံ:</label>
                <input
                  type="text"
                  required
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  placeholder="[ဂဏန်း] [ကြေး1]/[ကြေး2]"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">နမူနာ ရေးထိုးပုံ:</label>
                <input
                  type="text"
                  value={newRuleExample}
                  onChange={(e) => setNewRuleExample(e.target.value)}
                  placeholder="၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">အလိုအလျောက် ယူမည့်ပုံစံ:</label>
                <input
                  type="text"
                  value={newRuleOutput}
                  onChange={(e) => setNewRuleOutput(e.target.value)}
                  placeholder="၂၃=၈၀၀, ၄၅=၈၀၀, ၃၂=၂၀၀"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">စည်းမျဉ်း ရှင်းလင်းချက်:</label>
                <textarea
                  rows={2}
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="ရှင်းလင်းချက် ရိုက်ထည့်ပါ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active:scale-95"
                >
                  စည်းမျဉ်းသိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
