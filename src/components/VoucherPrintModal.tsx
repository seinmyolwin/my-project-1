import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Receipt,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Voucher } from '../types';
import { useLottery } from '../context/LotteryContext';
import { formatAmount } from '../utils/lotteryUtils';
import { printVoucherSlip } from '../utils/printUtils';

interface VoucherPrintModalProps {
  voucher: Voucher | null;
  onClose: () => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({ voucher, onClose }) => {
  const { settings, activeRound } = useLottery();
  const [copied, setCopied] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!voucher) return null;

  const isMyanmar = settings.language === 'my';

  const handlePrint = () => {
    printVoucherSlip('printable-voucher', `အိုးစည်လေး ဘောင်ချာ - ${voucher.voucherNo}`);
  };

  const handleCopyText = () => {
    const lines = voucher.items
      .map(i => `${i.number}${i.betType === 'rumble' ? 'R' : ''} = ${formatAmount(i.amount, settings.currency)}`)
      .join('\n');

    const text = `🧾 ${settings.shopName} (အိုးစည်လေး)
ဘောင်ချာအမှတ်: ${voucher.voucherNo}
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(voucher.createdAt).toLocaleString('en-GB')}
ဝယ်သူ: ${voucher.customerName} ${voucher.customerPhone ? `(${voucher.customerPhone})` : ''}
--------------------------------
${lines}
--------------------------------
စုစုပေါင်း: ${formatAmount(voucher.subtotal, settings.currency)}
${voucher.discountAmount > 0 ? `လျှော့ငွေ (${voucher.discountPercent}%): -${formatAmount(voucher.discountAmount, settings.currency)}\n` : ''}အသားတင် ကျသင့်ငွေ: ${formatAmount(voucher.netPayable, settings.currency)}
ငွေပေးချေမှု: ${voucher.isPaid ? 'ငွေပေးချေပြီး' : 'ကြွေးကျန်'}

${settings.voucherFooterMessage || 'ဘောင်ချာအား ပေါက်ဂဏန်းထွက်သည်အထိ သိမ်းဆည်းထားပါ'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectSave = () => {
    setSaveToast(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const isThreeCol = voucher.items.length > 14;
  const isMultiCol = voucher.items.length > 6 || isThreeCol;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isMyanmar ? 'အိုးစည်လေး ဘောင်ချာ' : 'Voucher Receipt'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-saved Notification Strip */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>အော်တိုသိမ်းဆည်းပြီးပါပြီ (နောက်ကြိုက်သည့်အချိန် ပြန်ထုတ်နိုင်ပါသည်)</span>
          </span>
          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-black">
            A6 Size
          </span>
        </div>

        {/* Printable Thermal/A6 Receipt Container */}
        <div className="p-3 sm:p-5 bg-slate-50/50 flex justify-center">
          <div
            ref={printRef}
            id="printable-voucher"
            className="w-full max-w-[340px] bg-white text-slate-900 p-4 rounded-xl shadow-xs font-mono text-[11px] space-y-2.5 border border-slate-200"
          >
            {/* Shop Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-2">
              <h2 className="font-black text-sm tracking-tight font-sans text-slate-950">
                {settings.shopName}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 font-sans">
                {settings.shopPhone && <span>ဖုန်း: {settings.shopPhone}</span>}
                <span className="font-bold bg-slate-100 px-1.5 py-0.2 rounded text-slate-800">အိုးစည်လေး</span>
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="space-y-0.5 text-[10px] text-slate-700 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">ဘောင်ချာအမှတ်:</span>
                <span className="font-bold text-slate-950">{voucher.voucherNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ရက်စွဲ:</span>
                <span>{new Date(voucher.createdAt).toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ဝယ်သူ:</span>
                <span className="font-bold text-slate-900 font-sans truncate max-w-[170px]">
                  {voucher.customerName} {voucher.customerPhone ? `(${voucher.customerPhone})` : ''}
                </span>
              </div>
              {activeRound && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ပွဲစဉ်:</span>
                  <span className="font-sans font-bold">{activeRound.name}</span>
                </div>
              )}
            </div>

            {/* Items Table - Responsive 2-Col Grid for Single Sheet A6 fit */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between font-bold text-[10px] text-slate-900 border-b border-slate-200 pb-0.5">
                <span>ဂဏန်း</span>
                <span>ထိုးကြေးငွေ</span>
              </div>

              <div
                className={`voucher-items-container ${
                  isThreeCol
                    ? 'grid grid-cols-3 gap-x-2 gap-y-0.5 max-h-48 overflow-y-auto pr-0.5'
                    : isMultiCol
                    ? 'grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-48 overflow-y-auto pr-0.5'
                    : 'space-y-0.5 max-h-48 overflow-y-auto pr-0.5'
                }`}
              >
                {voucher.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10.5px] leading-tight">
                    <span className="font-bold tracking-wider text-slate-900">
                      {item.number} {item.betType === 'rumble' ? '(R)' : ''}
                    </span>
                    <span className="font-bold text-slate-700">
                      {formatAmount(item.amount, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>စုစုပေါင်း:</span>
                <span>{formatAmount(voucher.subtotal, settings.currency)}</span>
              </div>
              {voucher.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>လျှော့ငွေ ({voucher.discountPercent}%):</span>
                  <span>-{formatAmount(voucher.discountAmount, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs text-slate-950 pt-1 border-t border-slate-300">
                <span>ကျသင့်ငွေ စုစုပေါင်း:</span>
                <span className="text-indigo-950">{formatAmount(voucher.netPayable, settings.currency)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-1.5 space-y-0.5 border-t border-dashed border-slate-300">
              <p className="text-[9px] text-slate-500 font-sans leading-tight">
                {settings.voucherFooterMessage || 'ဘောင်ချာအား ပေါက်ဂဏန်းထွက်သည်အထိ သိမ်းဆည်းထားပါ'}
              </p>
            </div>

          </div>
        </div>

        {/* Modal 3 Dedicated Actions: SMS/Chat Copy, Save, Print */}
        <div className="bg-slate-50 px-3 sm:px-4 py-3 border-t border-slate-200 grid grid-cols-3 gap-2">
          {/* Action 1: SMS/Chat Copy */}
          <button
            type="button"
            onClick={handleCopyText}
            className="py-2.5 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95"
            title="SMS / Chat သို့ စာသားကူးထည့်ရန်"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span className="truncate">{copied ? 'ကူးပြီး' : 'SMS/Chat'}</span>
          </button>

          {/* Action 2: Save (Auto-Saved Instant Confirm) */}
          <button
            type="button"
            onClick={handleDirectSave}
            className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
            title="အော်တိုသိမ်းဆည်းထားပြီးဖြစ်သည် - ချက်ချင်းပိတ်မည်"
          >
            {saveToast ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span className="truncate">{saveToast ? 'သိမ်းပြီး' : 'Save'}</span>
          </button>

          {/* Action 3: Print (A6 Single Sheet Exact Print / PDF) */}
          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
            title="A6 တရွက်တည်း ထွက်အောင် ပရင့်ထုတ်မည် / PDF အဖြစ် သိမ်းဆည်းမည်"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="truncate">ပရင့် / PDF (တရွက်)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

