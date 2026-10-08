import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Trash2,
  Calendar,
  Phone,
  User,
  X,
  FileSpreadsheet,
  Eye,
  Copy,
  Check,
  Trophy,
  ShieldAlert,
  Send,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDVoucher, TwoDForwardSlip } from '../../types';
import { formatAmount } from '../../utils/lotteryUtils';

interface TwoDVouchersViewProps {
  onOpenPrintVoucher?: (voucher: TwoDVoucher) => void;
}

export const TwoDVouchersView: React.FC<TwoDVouchersViewProps> = ({ onOpenPrintVoucher }) => {
  const {
    settings,
    activeRound,
    activeRoundVouchers,
    activeRoundForwardSlips,
    deleteVoucher,
    deleteForwardSlip,
    exportToExcel
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  // Tab filter: all customer vouchers vs master agent forward slips
  const [activeTabType, setActiveTabType] = useState<'all' | 'customer' | 'forward'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<TwoDVoucher | null>(null);
  const [selectedForwardSlip, setSelectedForwardSlip] = useState<TwoDForwardSlip | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter Customer Vouchers
  const filteredCustomerVouchers = useMemo(() => {
    let list = activeRoundVouchers;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        v =>
          v.voucherNo.toLowerCase().includes(q) ||
          v.customerName.toLowerCase().includes(q) ||
          (v.customerPhone && v.customerPhone.includes(q)) ||
          v.items.some(it => it.number.includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeRoundVouchers, searchTerm]);

  // Filter Forward Slips (ဒိုင်ကြီးဆီတင်သည့် ဘောင်ချာများ)
  const filteredForwardSlips = useMemo(() => {
    let list = activeRoundForwardSlips;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        s =>
          s.slipNo.toLowerCase().includes(q) ||
          s.masterAgentName.toLowerCase().includes(q) ||
          (s.masterAgentPhone && s.masterAgentPhone.includes(q)) ||
          s.items.some(it => it.number.includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeRoundForwardSlips, searchTerm]);

  // Copy text for Customer Voucher (Viber/SMS)
  const handleCopySlipText = (v: TwoDVoucher) => {
    const lines = v.items
      .map(i => `${i.number} = ${formatAmount(i.amount, settings.currency)}`)
      .join('\n');

    const text = `🧾 ${settings.shopName || 'ဇီးကွက်'}
ဘောင်ချာအမှတ်: ${v.voucherNo}
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(v.createdAt).toLocaleString('en-GB')}
ဝယ်သူ: ${v.customerName} ${v.customerPhone ? `(${v.customerPhone})` : ''}
--------------------------------
${lines}
--------------------------------
စုစုပေါင်း: ${formatAmount(v.subtotal, settings.currency)}
${v.discountAmount > 0 ? `လျှော့ငွေ (${v.discountPercent}%): -${formatAmount(v.discountAmount, settings.currency)}\n` : ''}အသားတင် ကျသင့်ငွေ: ${formatAmount(v.netPayable, settings.currency)}

${settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy text for Master Agent Forward Slip (ဒိုင်ကြီးလွှဲစလစ်)
  const handleCopyForwardText = (s: TwoDForwardSlip) => {
    const lines = s.items
      .map(it => `${it.number} = ${formatAmount(it.amount, settings.currency)}`)
      .join('\n');

    const text = `【ဒိုင်လွှဲစလစ်: ${s.slipNo}】
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(s.createdAt).toLocaleString('en-GB')}
ဒိုင်ချုပ်ကြီး: ${s.masterAgentName} ${s.masterAgentPhone ? `(${s.masterAgentPhone})` : ''}
--------------------------------
${lines}
--------------------------------
စုစုပေါင်း လွှဲငွေ: ${formatAmount(s.totalAmount, settings.currency)}
ကော်မရှင် (${s.commissionRate}%): +${formatAmount(s.commissionAmount, settings.currency)}
ဒိုင်သို့ အမှန်ပေးချေငွေ: ${formatAmount(s.netPaid, settings.currency)}
${s.notes ? `မှတ်ချက်: ${s.notes}\n` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Summary counts
  const totalCustomerCount = activeRoundVouchers.length;
  const totalForwardCount = activeRoundForwardSlips.length;
  const totalCustomerSales = activeRoundVouchers.reduce((acc, v) => acc + v.netPayable, 0);
  const totalForwardAmount = activeRoundForwardSlips.reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header and Filter Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-600" />
              <span>{isMyanmar ? '၂ လုံး ပြေစာနှင့် ဘောင်ချာမှတ်တမ်းများ' : '2D Vouchers & Forward Slips'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {activeRound?.name} ({activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'}) • စုစုပေါင်း အရောင်း {formatAmount(totalCustomerSales, settings.currency)} | ဒိုင်ကြီးတင်ငွေ {formatAmount(totalForwardAmount, settings.currency)}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTabType === 'forward'
                    ? (isMyanmar ? 'ဒိုင်လွှဲစလစ်နံပါတ် / ဒိုင်ချုပ် / ဂဏန်း...' : 'Search forward slip...')
                    : (isMyanmar ? 'ဘောင်ချာအမှတ် / ဝယ်သူ / ဂဏန်း...' : 'Search voucher or number...')
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-200 bg-slate-50"
              />
            </div>

            <button
              type="button"
              onClick={exportToExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              title="ဘောင်ချာများနှင့် ဒိုင်လွှဲစာရင်းအားလုံး Excel ထုတ်မည်"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'Excel ထုတ်' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: သီးသန့်ခွဲကြည့်ရန် (All vs Customer Vouchers vs Master Agent Forward Slips) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTabType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTabType === 'all'
                ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-800'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>{isMyanmar ? 'အားလုံး ပေါင်းကြည့်မည်' : 'All Records'}</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-md text-[10px] font-mono">
              {totalCustomerCount + totalForwardCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabType('customer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTabType === 'customer'
                ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-400/40'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'ထိုးသူ/ဝယ်သူ ဘောင်ချာများ' : 'Customer Vouchers'}</span>
            <span className="px-1.5 py-0.2 bg-teal-800/30 text-teal-100 rounded-md text-[10px] font-mono">
              {totalCustomerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabType('forward')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTabType === 'forward'
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/40'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'ဒိုင်ကြီးဆီတင်သော စလစ်များ (သီးသန့်)' : 'Master Agent Forward Slips'}</span>
            <span className="px-1.5 py-0.2 bg-indigo-800/30 text-indigo-100 rounded-md text-[10px] font-mono">
              {totalForwardCount}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MASTER AGENT FORWARD SLIPS SECTION (ဒိုင်ကြီးဆီတင်သော ဘောင်ချာများ သီးသန့်/တွဲလျက်) */}
      {/* ========================================================================= */}
      {(activeTabType === 'all' || activeTabType === 'forward') && (
        <div className="bg-white rounded-3xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 px-5 py-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              <h3 className="text-xs sm:text-sm font-black tracking-wide">
                {isMyanmar ? 'ဒိုင်ကြီးဆီ ပြန်တင်ထားသော ပြေစာစလစ်များ' : 'Forwarded Slips to Master Agent'}
              </h3>
              <span className="px-2 py-0.5 bg-amber-400 text-amber-950 text-[11px] font-black rounded-full">
                {filteredForwardSlips.length} စောင်
              </span>
            </div>
            <span className="text-[11px] text-indigo-200 font-bold">
              စုစုပေါင်းလွှဲငွေ: {formatAmount(filteredForwardSlips.reduce((a, s) => a + s.totalAmount, 0), settings.currency)}
            </span>
          </div>

          {filteredForwardSlips.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <Send className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
              <p className="text-xs font-semibold">
                {isMyanmar ? 'ဒိုင်ကြီးဆီ တင်ထားသော ဘောင်ချာ မရှိသေးပါ' : 'No forwarded slips recorded.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-indigo-50/70 text-indigo-950 font-bold border-b border-indigo-100">
                  <tr>
                    <th className="p-3.5">လွှဲစလစ်နံပါတ်</th>
                    <th className="p-3.5">ဒိုင်ချုပ်ကြီး</th>
                    <th className="p-3.5">ဖုန်းနံပါတ်</th>
                    <th className="p-3.5 text-center">ဂဏန်းအရေအတွက်</th>
                    <th className="p-3.5 text-right">စုစုပေါင်းလွှဲငွေ</th>
                    <th className="p-3.5 text-right">ကော်မရှင်ငွေ</th>
                    <th className="p-3.5 text-right">အမှန်ပေးချေငွေ</th>
                    <th className="p-3.5">အချိန်</th>
                    <th className="p-3.5 text-center">လုပ်ဆောင်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50 font-mono">
                  {filteredForwardSlips.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedForwardSlip(s)}
                      className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-bold text-indigo-800 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{s.slipNo}</span>
                      </td>
                      <td className="p-3.5 font-sans font-bold text-slate-900">{s.masterAgentName}</td>
                      <td className="p-3.5 text-slate-500 font-sans">{s.masterAgentPhone || '-'}</td>
                      <td className="p-3.5 text-center font-bold">
                        <span className="px-2 py-0.5 bg-indigo-100/80 text-indigo-900 rounded-md font-bold">
                          {s.items.length} လုံး
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-indigo-900">
                        {formatAmount(s.totalAmount, settings.currency)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-600">
                        +{formatAmount(s.commissionAmount, settings.currency)} ({s.commissionRate}%)
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-950 text-sm">
                        {formatAmount(s.netPaid, settings.currency)}
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans text-[11px]">
                        {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. View Detail Modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedForwardSlip(s)}
                            title="လွှဲစလစ် အသေးစိတ် ကြည့်ရှုမည်"
                            className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                          </button>

                          {/* 2. Copy for Viber */}
                          <button
                            type="button"
                            onClick={() => handleCopyForwardText(s)}
                            title="ဒိုင်ကြီးထံ Viber ပို့ရန် စာသားကူးမည်"
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedId === s.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* 3. Delete Forward Slip */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isMyanmar ? 'ဤဒိုင်ကြီးလွှဲစလစ်ကို ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Delete this forward slip?')) {
                                deleteForwardSlip(s.id);
                              }
                            }}
                            title="Delete Slip"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CUSTOMER SALES VOUCHERS SECTION (ထိုးသူများ၏ အရောင်းဘောင်ချာများ) */}
      {/* ========================================================================= */}
      {(activeTabType === 'all' || activeTabType === 'customer') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs sm:text-sm font-black tracking-wide">
                {isMyanmar ? 'ထိုးသူ ဝယ်သူများ၏ အရောင်းဘောင်ချာများ' : 'Customer Sales Vouchers'}
              </h3>
              <span className="px-2 py-0.5 bg-teal-400 text-teal-950 text-[11px] font-black rounded-full">
                {filteredCustomerVouchers.length} စောင်
              </span>
            </div>
            <span className="text-[11px] text-slate-300 font-bold">
              စုစုပေါင်းကျသင့်ငွေ: {formatAmount(filteredCustomerVouchers.reduce((a, v) => a + v.netPayable, 0), settings.currency)}
            </span>
          </div>

          {filteredCustomerVouchers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Receipt className="w-10 h-10 mx-auto stroke-1" />
              <p className="text-xs font-semibold">
                {isMyanmar ? 'ဝယ်သူဘောင်ချာမှတ်တမ်း မရှိသေးပါ' : 'No customer vouchers found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">ဘောင်ချာအမှတ်</th>
                    <th className="p-3.5">ထိုးသူအမည်</th>
                    <th className="p-3.5">ဖုန်းနံပါတ်</th>
                    <th className="p-3.5 text-center">ဂဏန်းအရေအတွက်</th>
                    <th className="p-3.5 text-right">စုစုပေါင်းငွေ</th>
                    <th className="p-3.5 text-right">ကျသင့်ငွေ</th>
                    <th className="p-3.5">အချိန်</th>
                    <th className="p-3.5 text-center">လုပ်ဆောင်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredCustomerVouchers.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVoucher(v)}
                      className="hover:bg-teal-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-bold text-teal-700">{v.voucherNo}</td>
                      <td className="p-3.5 font-sans font-bold text-slate-900">{v.customerName}</td>
                      <td className="p-3.5 text-slate-500 font-sans">{v.customerPhone || '-'}</td>
                      <td className="p-3.5 text-center font-bold">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700">
                          {v.items.length} ကွက်
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-700">
                        {formatAmount(v.subtotal, settings.currency)}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                        {formatAmount(v.netPayable, settings.currency)}
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans text-[11px]">
                        {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. View on screen */}
                          <button
                            type="button"
                            onClick={() => setSelectedVoucher(v)}
                            title={isMyanmar ? 'ပြေစာ အသေးစိတ် ကြည့်ရှုမည်' : 'View Voucher Slip'}
                            className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                          </button>

                          {/* 2. Copy for Viber */}
                          <button
                            type="button"
                            onClick={() => handleCopySlipText(v)}
                            title="Viber ပို့ရန် စာသားကူးမည်"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedId === v.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* 3. Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isMyanmar ? 'ဤဘောင်ချာကို ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Delete this voucher?')) {
                                deleteVoucher(v.id);
                              }
                            }}
                            title="Delete Voucher"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MASTER AGENT FORWARD SLIP DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedForwardSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-5 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-bold">
                  {isMyanmar ? 'ဒိုင်ကြီးလွှဲစလစ် အသေးစိတ်' : 'Forward Slip Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForwardSlip(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Slip Header Box */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">လွှဲစလစ်အမှတ်</span>
                    <span className="font-mono font-black text-sm text-indigo-800">{selectedForwardSlip.slipNo}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold block">ရက်စွဲ/အချိန်</span>
                    <span className="text-[11px] text-slate-700 font-bold">
                      {new Date(selectedForwardSlip.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-slate-600">ဒိုင်ချုပ်:</span>
                    <span className="font-bold text-slate-900">{selectedForwardSlip.masterAgentName}</span>
                  </div>
                  {selectedForwardSlip.masterAgentPhone && (
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedForwardSlip.masterAgentPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Numbers Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>ဒိုင်ကြီးဆီ လွှဲတင်သည့်ဂဏန်းများ ({selectedForwardSlip.items.length} လုံး)</span>
                  <span>လွှဲငွေ</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedForwardSlip.items.map((item, idx) => {
                      const isHit = activeRound?.winningNumber === item.number;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                            isHit
                              ? 'bg-amber-100 border-amber-300 text-slate-950 font-black ring-2 ring-amber-400 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-base text-indigo-900">{item.number}</span>
                            {isHit && <Trophy className="w-3 h-3 text-amber-600" />}
                          </div>
                          <span className="font-bold text-slate-700">
                            {formatAmount(item.amount, settings.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>စုစုပေါင်း လွှဲတင်ငွေ:</span>
                  <span className="font-bold text-slate-900">{formatAmount(selectedForwardSlip.totalAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>ကော်မရှင် ရငွေ ({selectedForwardSlip.commissionRate}%):</span>
                  <span>+{formatAmount(selectedForwardSlip.commissionAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-indigo-200">
                  <span>ဒိုင်သို့ အမှန်ပေးငွေ:</span>
                  <span className="text-indigo-900 font-black text-base">{formatAmount(selectedForwardSlip.netPaid, settings.currency)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyForwardText(selectedForwardSlip)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
                >
                  {copiedId === selectedForwardSlip.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">ကူးယူပြီးပါပြီ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Viber စာသားကူးမည်</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>ပရင့်ထုတ်</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedForwardSlip(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CUSTOMER VOUCHER DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold">
                  {isMyanmar ? 'ပြေစာမှတ်တမ်း အသေးစိတ်' : 'Voucher Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip On-Screen Card View */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* Slip Header Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">ဘောင်ချာအမှတ်</span>
                    <span className="font-mono font-black text-sm text-teal-700">{selectedVoucher.voucherNo}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold block">ရက်စွဲ/အချိန်</span>
                    <span className="text-[11px] text-slate-700 font-bold">
                      {new Date(selectedVoucher.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">ထိုးသူ:</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.customerName}</span>
                  </div>
                  {selectedVoucher.customerPhone && (
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedVoucher.customerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Numbers Grid (Scrollable on Screen) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>ထိုးထားသော ဂဏန်းများ ({selectedVoucher.items.length} ကွက်)</span>
                  <span>ထိုးကြေးငွေ</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedVoucher.items.map((item, idx) => {
                      const isHit = activeRound?.winningNumber === item.number;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                            isHit
                              ? 'bg-amber-100 border-amber-300 text-slate-950 font-black ring-2 ring-amber-400 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-base text-slate-950">{item.number}</span>
                            {item.betType === 'rumble' && (
                              <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1 rounded">
                                R
                              </span>
                            )}
                            {isHit && (
                              <Trophy className="w-3 h-3 text-amber-600" />
                            )}
                          </div>
                          <span className="font-bold text-slate-700">
                            {formatAmount(item.amount, settings.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>စုစုပေါင်း ထိုးကြေး:</span>
                  <span className="font-bold text-slate-800">{formatAmount(selectedVoucher.subtotal, settings.currency)}</span>
                </div>
                {selectedVoucher.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>ကော်မရှင် / လျှော့ငွေ ({selectedVoucher.discountPercent}%):</span>
                    <span>-{formatAmount(selectedVoucher.discountAmount, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-teal-200">
                  <span>အသားတင် ပေးချေငွေ:</span>
                  <span className="text-teal-800 font-black text-base">{formatAmount(selectedVoucher.netPayable, settings.currency)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                {/* Copy for Viber */}
                <button
                  type="button"
                  onClick={() => handleCopySlipText(selectedVoucher)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
                >
                  {copiedId === selectedVoucher.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">ကူးယူပြီးပါပြီ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Viber စာသားကူးမည်</span>
                    </>
                  )}
                </button>

                {/* Optional Print */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPrintVoucher) {
                      onOpenPrintVoucher(selectedVoucher);
                    } else {
                      window.print();
                    }
                  }}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>ပရင့်ထုတ်</span>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
