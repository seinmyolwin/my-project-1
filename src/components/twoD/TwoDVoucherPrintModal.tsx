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
import { TwoDVoucher } from '../../types';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount } from '../../utils/lotteryUtils';
import { printVoucherSlip } from '../../utils/printUtils';

interface TwoDVoucherPrintModalProps {
  voucher: TwoDVoucher | null;
  onClose: () => void;
}

export const TwoDVoucherPrintModal: React.FC<TwoDVoucherPrintModalProps> = ({ voucher, onClose }) => {
  const { settings, activeRound } = useTwoDLottery();
  const [copied, setCopied] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!voucher) return null;

  const isMyanmar = settings.language === 'my';

  const handlePrint = () => {
    printVoucherSlip('printable-voucher', `ဇီးကွက် ဘောင်ချာ - ${voucher.voucherNo}`);
  };

  const handleCopyText = () => {
    const lines = voucher.items
      .map(i => `${i.number} = ${formatAmount(i.amount, settings.currency)}`)
      .join('\n');

    const text = `🧾 ${settings.shopName} (ဇီးကွက် မှတ်တမ်း)
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

${settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}`;

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
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isMyanmar ? 'ဇီးကွက် အရောင်းဘောင်ချာ' : '2D Voucher Slip'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-saved Notification Strip */}
        <div className="bg-teal-50 border-b border-teal-100 px-4 py-1.5 flex items-center justify-between text-[11px] text-teal-800 font-bold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>အော်တိုသိမ်းဆည်းပြီးပါပြီ (နောက်ကြိုက်သည့်အချိန် ပြန်ထုတ်နိုင်ပါသည်)</span>
          </span>
          <span className="font-mono text-[10px] text-teal-700 bg-teal-100/80 px-1.5 py-0.2 rounded font-black">
            A6 Size
          </span>
        </div>

        {/* Printable Thermal/A6 Slip Container */}
        <div className="p-3 sm:p-5 bg-slate-50/50 flex justify-center">
          <div
            ref={printRef}
            id="printable-voucher"
            className="w-full max-w-[340px] bg-white text-slate-900 p-4 rounded-xl shadow-xs font-mono text-[11px] space-y-2.5 border border-slate-200"
          >
            {/* Shop Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-2">
              <h4 className="font-black text-sm text-slate-900 font-sans">{settings.shopName}</h4>
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 font-sans">
                {settings.shopPhone && <span>ဖုန်း: {settings.shopPhone}</span>}
                <span className="font-bold bg-slate-100 px-1.5 py-0.2 rounded text-slate-800">ဇီးကွက်</span>
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-[10px] text-slate-700 pb-1.5">
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

            {/* Numbers list - Responsive 2/3-Col Grid for Single Sheet A6 fit */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1 pb-1.5">
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
                {voucher.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10.5px] leading-tight">
                    <span className="font-black tracking-wider text-slate-950">{it.number}</span>
                    <span className="font-bold text-slate-700">{formatAmount(it.amount, settings.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial summary */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 font-bold text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>စုစုပေါင်း:</span>
                <span>{formatAmount(voucher.subtotal, settings.currency)}</span>
              </div>
              {voucher.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>လျှော့ငွေ ({voucher.discountPercent}%):</span>
                  <span>-{formatAmount(voucher.discountAmount, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 text-xs pt-1 border-t border-slate-200">
                <span>ကျသင့်ငွေ:</span>
                <span className="text-teal-700">{formatAmount(voucher.netPayable, settings.currency)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[9px] text-slate-400 pt-1.5 border-t border-dashed border-slate-300 font-sans">
              {settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}
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
            {copied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
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
            className="flex-1 py-2.5 px-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
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

