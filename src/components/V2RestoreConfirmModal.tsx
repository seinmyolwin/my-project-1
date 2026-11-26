import React from 'react';
import { X, Database, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import type { BackupV2Inspection, RestoreMode } from '../utils/backupSyncV2';

interface V2RestoreConfirmModalProps {
  isOpen: boolean;
  inspection: BackupV2Inspection | null;
  isRestoring: boolean;
  onCancel: () => void;
  onConfirm: (mode: RestoreMode) => void;
}

export const V2RestoreConfirmModal: React.FC<V2RestoreConfirmModalProps> = ({
  isOpen,
  inspection,
  isRestoring,
  onCancel,
  onConfirm
}) => {
  if (!isOpen || !inspection || !inspection.preview || !inspection.counts) return null;

  const { manifest, preview, counts, isOlderSequence, lastImportedSequence } = inspection;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900">Backup ဖိုင် (.rhmg) ပြန်သွင်းမည်</h4>
              <p className="text-[10px] text-slate-500 font-mono">
                Exported: {manifest?.exportedAt ? new Date(manifest.exportedAt).toLocaleString('my-MM') : '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRestoring}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isOlderSequence && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              ဤဖိုင်သည် ယခင်သွင်းခဲ့ဖူးသော sequence ({lastImportedSequence}) ထက် ဟောင်းနေပါသည် (seq {manifest?.exportSequence})။ သေချာစွာ စစ်ဆေးပြီးမှ ရွေးချယ်ပါ။
            </span>
          </div>
        )}

        {/* File Contents Breakdown */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
          <div className="font-black text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Backup ဖိုင်အတွင်း ပါဝင်သော စာရင်းများ:</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <span className="text-[10px] font-bold text-teal-800 block">ဇီးကွက် (2D)</span>
              <span className="font-mono font-black text-slate-900">
                {counts.vouchers2D} ဘောင်ချာ
              </span>
              <span className="font-mono text-[10px] text-slate-600 block">
                {counts.forwards2D} အထက်တင်
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <span className="text-[10px] font-bold text-indigo-800 block">အိုးစည်လေး (3D)</span>
              <span className="font-mono font-black text-slate-900">
                {counts.vouchers3D} ဘောင်ချာ
              </span>
              <span className="font-mono text-[10px] text-slate-600 block">
                {counts.forwards3D} အထက်တင်
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <span className="text-[10px] font-bold text-emerald-800 block">ပစ်တိုင်းထောင်</span>
              <span className="font-mono font-black text-slate-900">
                {counts.slipsFB} စလစ်
              </span>
              <span className="font-mono text-[10px] text-slate-600 block">
                {counts.forwardsFB} အထက်တင်
              </span>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-700 font-bold flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-emerald-700">အသစ်ဝင်မည်: {preview.added}</span>
            <span>တူပြီးသား: {preview.same}</span>
            <span className="text-indigo-700">ပြင်မည်: {preview.updated}</span>
            <span>ပိတ်ပြီးသား: {preview.protectedCount}</span>
          </div>
        </div>

        {/* Mode Buttons (No window.confirm!) */}
        <div className="space-y-2 text-xs">
          {!preview.ledgerNotEmpty ? (
            <button
              type="button"
              disabled={isRestoring}
              onClick={() => onConfirm('fresh')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isRestoring ? 'သွင်းနေပါသည်...' : 'ဒေတာအားလုံး ပြန်သွင်းမည်'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => onConfirm('merge')}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRestoring ? 'သွင်းနေပါသည်...' : 'လက်ရှိစာရင်းနှင့် ပေါင်းစည်းသွင်းမည် (Merge)'}</span>
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => onConfirm('replace')}
                className="w-full py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
              >
                လက်ရှိဒေတာအားလုံးကို Backup ဖြင့် အစားထိုးမည် (Replace All)
              </button>
            </>
          )}
          <button
            type="button"
            disabled={isRestoring}
            onClick={onCancel}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            ပယ်ဖျက်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
