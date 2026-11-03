import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PeriodClosing, GameType } from '../types';
import { STORAGE_KEYS, loadStoredData, saveStoredData } from '../utils/storage';

interface PeriodContextType {
  periodClosings: PeriodClosing[];
  isPeriodClosed: (game: GameType, date: string) => boolean;
  closePeriod: (period: PeriodClosing) => void;
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

  const closePeriod = useCallback((period: PeriodClosing) => {
    setPeriodClosings(prev => [...prev, period]);
  }, []);

  return (
    <PeriodContext.Provider value={{ periodClosings, isPeriodClosed, closePeriod }}>
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (!context) throw new Error('usePeriod must be used within a PeriodProvider');
  return context;
};
