import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PeriodClosing, GameType } from '../types';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from '../utils/storage';
import { generateUUID, createRestorePoint } from '../utils/restorePoints';
import { generateContentHash } from '../utils/hashUtils';
import { verifyOwnerPassword, hashPassword } from '../utils/securityUtils';

interface PeriodContextType {
  periodClosings: PeriodClosing[];
  isPeriodClosed: (game: GameType, date: string) => boolean;
  closePeriod: (period: Partial<PeriodClosing> & { game: GameType; periodStart: string; periodEnd: string; totals: any }) => Promise<PeriodClosing>;
  reopenPeriod: (id: string, pin: string, reason: string) => Promise<boolean>;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export const PeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [periodClosings, setPeriodClosings] = useState<PeriodClosing[]>(() =>
    loadStoredData(STORAGE_KEYS.PERIOD_CLOSINGS, [])
  );

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.PERIOD_CLOSINGS, periodClosings);
  }, [periodClosings]);

  const isPeriodClosed = useCallback((game: GameType, date: string) => {
    return periodClosings.some(pc => 
      pc.game === game && date >= pc.periodStart && date <= pc.periodEnd
    );
  }, [periodClosings]);

  const closePeriod = useCallback(async (periodData: Partial<PeriodClosing> & { game: GameType; periodStart: string; periodEnd: string; totals: any }): Promise<PeriodClosing> => {
    // 1. Create restore point before closing period
    try {
      await createRestorePoint('before-period-close', { game: periodData.game, start: periodData.periodStart, end: periodData.periodEnd });
    } catch {
      // safe fallback
    }

    const contentHash = await generateContentHash(periodData);
    const newClosing: PeriodClosing = {
      id: generateUUID(),
      closedAt: new Date().toISOString(),
      game: periodData.game,
      periodStart: periodData.periodStart,
      periodEnd: periodData.periodEnd,
      totals: periodData.totals,
      contentHash,
      ...periodData
    } as PeriodClosing;

    setPeriodClosings(prev => [...prev, newClosing]);
    return newClosing;
  }, []);

  const reopenPeriod = useCallback(async (id: string, pin: string, reason: string): Promise<boolean> => {
    if (!verifyOwnerPassword(pin)) {
      throw new Error('Owner PIN Code မမှန်ကန်ပါ');
    }

    const target = periodClosings.find(pc => pc.id === id);
    if (!target) return false;

    const pinHash = await hashPassword(pin);
    const auditLogItem = {
      id: generateUUID(),
      periodId: id,
      reopenedAt: new Date().toISOString(),
      reason,
      previousHash: target.contentHash,
      pinHash
    };

    try {
      const logsRaw = localStorage.getItem('shwe_period_reopen_audit_log') || '[]';
      const logs = JSON.parse(logsRaw);
      logs.push(auditLogItem);
      localStorage.setItem('shwe_period_reopen_audit_log', JSON.stringify(logs));
    } catch {
      // ignore
    }

    setPeriodClosings(prev => prev.filter(pc => pc.id !== id));
    return true;
  }, [periodClosings]);

  return (
    <PeriodContext.Provider value={{ periodClosings, isPeriodClosed, closePeriod, reopenPeriod }}>
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (!context) throw new Error('usePeriod must be used within a PeriodProvider');
  return context;
};

