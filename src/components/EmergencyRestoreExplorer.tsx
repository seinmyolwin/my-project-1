import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  History,
  Database,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  FileText,
  ArchiveRestore,
  Eye
} from 'lucide-react';
import {
  listRestorePoints,
  restoreFromRestorePoint,
  summarizeKeysMap,
  listLocalEmergencySnapshots,
  restoreFromSnapshotKeys,
  detectRecoverableBackupMirrors,
  recoverFromBackupMirrors,
  inspectLiveStorageState,
  recoverTombstonedRecords,
  type RestorePoint,
  type SnapshotDataSummary,
  type LocalPreRestoreSnapshot,
  type BackupMirrorMismatch,
  type LiveStorageDiagnostics
} from '../utils/restorePoints';
import {
  findMissingVouchersFromRawClips,
  rebuildVouchersFromRawClips,
  type MissingRawClipScanResult
} from '../utils/rawClipRecovery';
import { downloadFile } from '../utils/backupUtils';

interface EmergencyRestoreExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: (message: string) => void;
}

type UnifiedSnapshotItem = {
  uid: string;
  source: 'restore_point' | 'local_snapshot';
  id: string;
  createdAt: string;
  reason: string;
  keyCount: number;
  bytes: number;
  keys: Record<string, string>;
  summary: SnapshotDataSummary;
};

const REASON_LABELS: Record<string, string> = {
  'manual': 'Manual Backup',
  'auto': 'Auto Backup',
  'before-import': 'Import မတိုင်မီ',
  'before-migration': 'Migration မတိုင်မီ',
  'before-rollback': 'Restore မတိုင်မီ',
  'before-period-close': 'ကာလမပိတ်မီ',
  'pre-restore-snapshot': 'Pre-Restore Snapshot'
};

export const EmergencyRestoreExplorer: React.FC<EmergencyRestoreExplorerProps> = ({
  isOpen,
  onClose,
  onRestored
}) => {
  const [items, setItems] = useState<UnifiedSnapshotItem[]>([]);
  const [mirrors, setMirrors] = useState<BackupMirrorMismatch[]>([]);
  const [liveDiag, setLiveDiag] = useState<LiveStorageDiagnostics | null>(null);
  const [rawClipScan, setRawClipScan] = useState<MissingRawClipScanResult | null>(null);
  const [confirmingTombstone, setConfirmingTombstone] = useState(false);
  const [confirmingRawGroupKey, setConfirmingRawGroupKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingUid, setConfirmingUid] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    setConfirmingUid(null);
    setConfirmingTombstone(false);
    setConfirmingRawGroupKey(null);
    try {
      const [points, localSnaps, mirrorMismatches, diag, rawScan] = await Promise.all([
        listRestorePoints(),
        Promise.resolve(listLocalEmergencySnapshots()),
        Promise.resolve(detectRecoverableBackupMirrors()),
        Promise.resolve(inspectLiveStorageState()),
        Promise.resolve(findMissingVouchersFromRawClips())
      ]);

      const unified: UnifiedSnapshotItem[] = [];

      for (const p of points as RestorePoint[]) {
        unified.push({
          uid: `rp_${p.id}`,
          source: 'restore_point',
          id: p.id,
          createdAt: p.createdAt,
          reason: p.reason,
          keyCount: p.keyCount || Object.keys(p.keys || {}).length,
          bytes: p.bytes || 0,
          keys: p.keys || {},
          summary: summarizeKeysMap(p.keys || {})
        });
      }

      for (const s of localSnaps as LocalPreRestoreSnapshot[]) {
        unified.push({
          uid: `ls_${s.storageKey}`,
          source: 'local_snapshot',
          id: s.storageKey,
          createdAt: s.createdAt,
          reason: s.reason,
          keyCount: s.keyCount,
          bytes: JSON.stringify(s.keys).length,
          keys: s.keys,
          summary: s.summary
        });
      }

      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(unified);
      setMirrors(mirrorMismatches);
      setLiveDiag(diag);
      setRawClipScan(rawScan);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Restore Points ရှာဖွေရာတွင် အမှားရှိပါသည်: ${err?.message || ''}`
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, loadSnapshots]);

  if (!isOpen) return null;

  const nonEmptyCount = items.filter(it => it.summary.totalLedgerRecords > 0).length;

  const handleRestoreItem = async (item: UnifiedSnapshotItem) => {
    setIsRestoring(true);
    setStatusMsg(null);
    try {
      let msg = '';
      if (item.source === 'restore_point') {
        const res = await restoreFromRestorePoint(item.id);
        // Also keep *_backup mirrors aligned for restored ledger keys
        for (const [k, v] of Object.entries(item.keys)) {
          if (
            typeof v === 'string' &&
            !k.endsWith('_backup') &&
            (k.startsWith('3d_ledger_') || k.startsWith('2d_ledger_') || k.startsWith('football_ledger_'))
          ) {
            try { localStorage.setItem(`${k}_backup`, v); } catch { /* ignore */ }
          }
        }
        msg = res.message;
      } else {
        const res = await restoreFromSnapshotKeys(item.keys, item.id);
        msg = res.message;
      }
      setStatusMsg({ type: 'success', text: `${msg}။ စာမျက်နှာ ပြန်လည်ဖွင့်နေပါသည်...` });
      if (onRestored) onRestored(msg);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `ပြန်ယူမှု မအောင်မြင်ပါ: ${err?.message || 'မသိရသော အမှား'}`
      });
      setIsRestoring(false);
    }
  };

  const handleRecoverMirrors = async () => {
    setIsRestoring(true);
    try {
      const res = await recoverFromBackupMirrors();
      if (res.success) {
        setStatusMsg({ type: 'success', text: `${res.message}။ စာမျက်နှာ ပြန်လည်ဖွင့်နေပါသည်...` });
        if (onRestored) onRestored(res.message);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
        setIsRestoring(false);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Recovery error' });
      setIsRestoring(false);
    }
  };

  const handleRecoverTombstones = async () => {
    setIsRestoring(true);
    setStatusMsg(null);
    try {
      const res = await recoverTombstonedRecords();
      if (res.success) {
        setStatusMsg({ type: 'success', text: `${res.message}။ စာမျက်နှာ ပြန်လည်ဖွင့်နေပါသည်...` });
        if (onRestored) onRestored(res.message);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
        setIsRestoring(false);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Tombstone recovery error' });
      setIsRestoring(false);
    }
  };

  const handleRebuildFromRawClips = async (groupKey?: string) => {
    setIsRestoring(true);
    setStatusMsg(null);
    try {
      const res = await rebuildVouchersFromRawClips(groupKey ? { groupKey } : undefined);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `${res.message}။ စာမျက်နှာ ပြန်လည်ဖွင့်နေပါသည်...` });
        if (onRestored) onRestored(res.message);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
        setIsRestoring(false);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Raw clip reconstruction error' });
      setIsRestoring(false);
    }
  };

  const handleDownloadSnapshotJson = (item: UnifiedSnapshotItem) => {
    const safeDate = item.createdAt.slice(0, 19).replace(/[:T]/g, '-');
    const filename = `snapshot_${item.reason}_${safeDate}.json`;
    downloadFile(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        source: item.source,
        id: item.id,
        createdAt: item.createdAt,
        reason: item.reason,
        summary: item.summary,
        keys: item.keys
      }, null, 2),
      filename,
      'application/json;charset=utf-8'
    );
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black leading-tight">
                စက်တွင်း Restore Points & Snapshots ရှာဖွေပြန်ယူခြင်း
              </h3>
              <p className="text-[10px] text-slate-400">
                IndexedDB & LocalStorage ထဲတွင် သိမ်းထားသမျှ မှတ်တမ်းအဟောင်းများကို တစ်ခုချင်းစီ စစ်ဆေးပြန်ယူနိုင်သည်
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadSnapshots}
              disabled={loading || isRestoring}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              title="ပြန်လည်ရှာဖွေမည်"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isRestoring}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                statusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {statusMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Mirror Recovery Alert if *_backup has more items than primary */}
          {mirrors.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-400 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-950 font-black">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>_backup မိတ္တူထဲတွင် ပျောက်နေသော ဒေတာများ တွေ့ရှိပါသည်!</span>
                </div>
                <button
                  type="button"
                  onClick={handleRecoverMirrors}
                  disabled={isRestoring}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg cursor-pointer shrink-0"
                >
                  _backup မှ ချက်ချင်းပြန်ယူမည်
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-emerald-900">
                {mirrors.map(m => (
                  <span key={m.primaryKey} className="px-2 py-0.5 bg-white rounded border border-emerald-200 font-mono">
                    {m.primaryKey}: {m.primaryCount} → {m.backupCount}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Live Storage Diagnostics & Tombstone / Unsettled Round Detection */}
          {liveDiag && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>လက်ရှိ Browser စက်တွင်း သိုလှောင်မှု စစ်ဆေးချက် (Live Storage Diagnostics)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-mono">
                  Raw Archive: {liveDiag.rawClipsActiveCount} စောင်
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                {liveDiag.buckets.map((b) => (
                  <div
                    key={b.key}
                    className={`rounded-lg border px-2 py-1.5 bg-white ${
                      b.tombstonedCount > 0 || b.backupActiveCount > b.activeCount
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-slate-800 truncate">{b.label}</div>
                    <div className="font-mono text-[10px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-900">Active: {b.activeCount}</span>
                      {b.backupActiveCount > 0 && (
                        <span className="text-indigo-700">_bk: {b.backupActiveCount}</span>
                      )}
                      {b.tombstonedCount > 0 && (
                        <span className="text-amber-700 font-bold">Del: {b.tombstonedCount}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tombstone Recovery Card */}
              {liveDiag.totalTombstonedLedger > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-950 font-black">
                      <ArchiveRestore className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        ဖျက်မိ/Cancel ဖြစ်ထားသော (Tombstone) မှတ်တမ်း {liveDiag.totalTombstonedLedger} ခု ကျန်ရှိနေပါသည်
                      </span>
                    </div>
                    {!confirmingTombstone && (
                      <button
                        type="button"
                        onClick={() => setConfirmingTombstone(true)}
                        disabled={isRestoring}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-[11px] cursor-pointer shrink-0"
                      >
                        ဖျက်မိထားသော မှတ်တမ်း {liveDiag.totalTombstonedLedger} ခု ပြန်ဖော်မည်
                      </button>
                    )}
                  </div>
                  {confirmingTombstone && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200">
                      <span className="text-[11px] font-bold text-amber-900">
                        Tombstone ဖြစ်နေသော ဘောင်ချာ/အထက်တင်/ပွဲစဉ်များကို Active အဖြစ် ပြန်ဖော်ရန် သေချာပါသလား?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmingTombstone(false)}
                          disabled={isRestoring}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          မလုပ်တော့ပါ
                        </button>
                        <button
                          type="button"
                          onClick={handleRecoverTombstones}
                          disabled={isRestoring}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                        >
                          {isRestoring ? 'ပြန်ဖော်နေသည်...' : 'အတည်ပြု ပြန်ဖော်မည်'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Unsettled Rounds Notice (present in localStorage, hidden from Statements because winningNumber is empty) */}
              {liveDiag.unsettledRoundsWithData.length > 0 && (
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1.5 text-indigo-950">
                  <div className="font-black flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>ထွက်ဂဏန်း မထည့်ရသေး၍ စာရင်းရှင်းတမ်း (Statements) ထဲ မပေါ်သေးသော ပွဲစဉ်များ ရှိနေပါသည်</span>
                  </div>
                  <p className="text-[11px] text-indigo-900">
                    အောက်ပါပွဲစဉ်များတွင် ဘောင်ချာ/အထက်တင် ဒေတာ ရှိနေသော်လည်း ထွက်ဂဏန်း (Winning Number) မထည့်ရသေးသဖြင့် စာရင်းရှင်းတမ်း (Statements) ထဲတွင် မပေါ်သေးခြင်း ဖြစ်နိုင်ပါသည်။ သက်ဆိုင်ရာ ပွဲစဉ်ကို ရွေးချယ်၍ ထွက်ဂဏန်း ထည့်ပေးပါ။
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {liveDiag.unsettledRoundsWithData.map((r) => (
                      <span
                        key={`${r.mode}_${r.roundId}`}
                        className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-[10px] font-bold"
                      >
                        [{r.mode.toUpperCase()}] {r.roundName} ({r.drawDate}) — {r.vouchersCount} ဘောင်ချာ / {r.forwardsCount} တင်
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw Text Archive Customer Voucher Reconstruction */}
          {rawClipScan && rawClipScan.totalMissingClips > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-amber-950 font-black">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Raw Text Archive ထဲမှ စာရင်းထဲမရှိတော့သော ထိုးသားဘောင်ချာ {rawClipScan.totalParseableClips} စောင် တွေ့ရှိပါသည်!
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    စုစုပေါင်း ထိုးကြေး <span className="font-mono font-black">{rawClipScan.totalAmount.toLocaleString()} Ks</span> ကို ထိုးသားဘောင်ချာ (2D/3D) အဖြစ် ပြန်လည်တည်ဆောက်နိုင်ပါသည်။ (သတိပြုရန်: Raw Text Archive ထဲတွင် ထိုးသားဘောင်ချာ မူရင်းစာသားများသာ ပါဝင်ပြီး အထက်တင်ကြေး စလစ်များ မပါဝင်ပါ — အထက်တင်ကြေးအတွက် Restore Points / _backup / .rhmg ဖိုင်မှသာ ပြန်ယူနိုင်ပါသည်။)
                  </p>
                </div>

                {rawClipScan.totalParseableClips > 0 && confirmingRawGroupKey !== '__ALL__' && (
                  <button
                    type="button"
                    onClick={() => setConfirmingRawGroupKey('__ALL__')}
                    disabled={isRestoring}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-[11px] cursor-pointer shrink-0"
                  >
                    အားလုံး ပြန်တည်ဆောက်မည် ({rawClipScan.totalParseableClips})
                  </button>
                )}
              </div>

              {confirmingRawGroupKey === '__ALL__' && (
                <div className="p-2.5 rounded-xl bg-white border border-amber-300 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-amber-950">
                    တွေ့ရှိထားသော ထိုးသားဘောင်ချာ {rawClipScan.totalParseableClips} စောင်လုံးကို Ledger ထဲသို့ ပြန်သွင်းရန် သေချာပါသလား?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmingRawGroupKey(null)}
                      disabled={isRestoring}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer"
                    >
                      မလုပ်တော့ပါ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRebuildFromRawClips()}
                      disabled={isRestoring}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                    >
                      {isRestoring ? 'တည်ဆောက်နေသည်...' : 'အတည်ပြု ပြန်သွင်းမည်'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {rawClipScan.groups.map((grp) => {
                  const isGroupConfirming = confirmingRawGroupKey === grp.groupKey;
                  return (
                    <div
                      key={grp.groupKey}
                      className="bg-white border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px]">
                          <span className="font-black text-slate-900">
                            [{grp.category.toUpperCase()}] {grp.roundName}
                          </span>
                          <span className="text-slate-500 font-mono ml-1.5">({grp.date})</span>
                          <div className="text-[10px] text-slate-600 font-mono">
                            ပြန်တည်ဆောက်နိုင်: <span className="font-black text-emerald-700">{grp.parseableCount} စောင်</span> ({grp.totalAmount.toLocaleString()} Ks)
                            {grp.unparseableCount > 0 && (
                              <span className="text-amber-700 ml-2">• စာသားမဖတ်နိုင်/ဓာတ်ပုံသီးသန့်: {grp.unparseableCount}</span>
                            )}
                          </div>
                        </div>
                        {grp.parseableCount > 0 && !isGroupConfirming && (
                          <button
                            type="button"
                            onClick={() => setConfirmingRawGroupKey(grp.groupKey)}
                            disabled={isRestoring}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer shrink-0"
                          >
                            ဤပွဲစဉ် ပြန်သွင်းမည် ({grp.parseableCount})
                          </button>
                        )}
                      </div>
                      {isGroupConfirming && (
                        <div className="pt-1 border-t border-amber-100 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-amber-950">
                            ဤပွဲစဉ်မှ ဘောင်ချာ {grp.parseableCount} စောင် ပြန်သွင်းမည်လား?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmingRawGroupKey(null)}
                              disabled={isRestoring}
                              className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                            >
                              မလုပ်တော့ပါ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRebuildFromRawClips(grp.groupKey)}
                              disabled={isRestoring}
                              className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] cursor-pointer"
                            >
                              {isRestoring ? 'သွင်းနေသည်...' : 'အတည်ပြုမည်'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Origin / Summary Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-700">
              <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <div className="font-bold text-slate-900">
                  စုစုပေါင်း Snapshot {items.length} ခု (ဘောင်ချာ/အထက်တင် ဒေတာပါဝင်သော Snapshot: {nonEmptyCount} ခု)
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  လက်ရှိ Browser URL: {typeof window !== 'undefined' ? window.location.origin : ''}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-500 font-bold">
              စက်တွင်း Snapshot များကို စစ်ဆေးရှာဖွေနေပါသည်...
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
              <div className="font-black flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>လက်ရှိ Browser URL ထဲတွင် စက်တွင်း Restore Point မရှိသေးပါ</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-900">
                <li>
                  သင့်ဒေတာများသည် ယခင်အသုံးပြုခဲ့သော အခြား Browser / ဖုန်း / App Link (ဥပမာ Preview Link နှင့် Shared Link မတူညီခြင်း) ထဲတွင် ကျန်ရှိနေနိုင်ပါသည်။
                </li>
                <li>
                  သိမ်းဆည်းထားသော <code className="font-mono font-bold">.rhmg</code> သို့မဟုတ် <code className="font-mono font-bold">.json</code> Backup ဖိုင် ရှိပါက Backup ဖိုင်မှ တိုက်ရိုက်ပြန်သွင်းနိုင်ပါသည်။
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2.5">
              {nonEmptyCount === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] space-y-1">
                  <div className="font-black flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>တွေ့ရှိထားသော Snapshot {items.length} ခုလုံးတွင် ဘောင်ချာ/အထက်တင် စာရင်း (0) ဖြစ်နေပါသည်</span>
                  </div>
                  <p>
                    ယခင်က Restore ခလုတ်နှိပ်မိစဉ် (သို့မဟုတ် Browser URL/Site Data ပြောင်းသွားစဉ်) အလွတ် Snapshot များသာ ကျန်ခဲ့ခြင်း ဖြစ်နိုင်ပါသည်။ ယခင်အသုံးပြုခဲ့သော Browser / URL Link သို့မဟုတ် သိမ်းထားသော <span className="font-mono font-bold">.rhmg</span> ဖိုင် ရှိမရှိ စစ်ဆေးပေးပါ။
                  </p>
                </div>
              )}

              {items.map((item, idx) => {
                const hasData = item.summary.totalLedgerRecords > 0;
                const isConfirming = confirmingUid === item.uid;
                const formattedDate = (() => {
                  try {
                    return new Date(item.createdAt).toLocaleString('my-MM');
                  } catch {
                    return item.createdAt;
                  }
                })();

                return (
                  <div
                    key={item.uid}
                    className={`rounded-xl border p-3 space-y-2 transition-all ${
                      hasData
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            #{idx + 1}
                          </span>
                          <span className="font-black text-slate-900">{formattedDate}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                            {REASON_LABELS[item.reason] || item.reason}
                          </span>
                          {hasData ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                              ဒေတာ {item.summary.totalLedgerRecords} ခု ရှိသည်
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                              ဘောင်ချာမရှိ (0)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.createdAt} • {item.keyCount} keys ({Math.round(item.bytes / 1024)} KB)
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadSnapshotJson(item)}
                          disabled={isRestoring}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Snapshot ကို JSON ဖိုင်အဖြစ် သိမ်းထားမည်"
                        >
                          <Download className="w-3 h-3" />
                          <span>JSON</span>
                        </button>
                        {!isConfirming && (
                          <button
                            type="button"
                            onClick={() => setConfirmingUid(item.uid)}
                            disabled={isRestoring}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                              hasData
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-700 hover:bg-slate-800 text-white'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>ပြန်ယူမည်</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-Business Breakdown */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <div className="bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-bold text-teal-800 block">ဇီးကွက် (2D)</span>
                        <span className="font-mono font-bold text-slate-900">
                          {item.summary.vouchers2D} ဘောင်ချာ / {item.summary.forwards2D} တင်
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-bold text-indigo-800 block">အိုးစည်လေး (3D)</span>
                        <span className="font-mono font-bold text-slate-900">
                          {item.summary.vouchers3D} ဘောင်ချာ / {item.summary.forwards3D} တင်
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-bold text-emerald-800 block">ပစ်တိုင်းထောင်</span>
                        <span className="font-mono font-bold text-slate-900">
                          {item.summary.slipsFB} စလစ် / {item.summary.forwardsFB} တင်
                        </span>
                      </div>
                    </div>

                    {/* Inline In-App Confirm (No window.confirm!) */}
                    {isConfirming && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                        <span className="text-[11px] font-black text-amber-950">
                          ဤ Snapshot ဖြင့် လက်ရှိဒေတာကို အစားထိုးပြန်ယူရန် သေချာပါသလား?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmingUid(null)}
                            disabled={isRestoring}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer"
                          >
                            မယူတော့ပါ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreItem(item)}
                            disabled={isRestoring}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                          >
                            {isRestoring ? 'ပြန်သွင်းနေပါသည်...' : 'အတည်ပြု ပြန်ယူမည်'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Restore ပြုလုပ်တိုင်း လက်ရှိအခြေအနေကို Before-Rollback Snapshot အဖြစ် သိမ်းပေးပါသည်</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
