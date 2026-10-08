import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  FootballMatch,
  FootballSlip,
  FootballForwardSlip,
  FootballSettings,
  FootballSummary,
  FootballLeague
} from '../types';
import {
  DEFAULT_FOOTBALL_SETTINGS,
  DEFAULT_FOOTBALL_LEAGUES,
  INITIAL_FOOTBALL_MATCHES,
  INITIAL_FOOTBALL_SLIPS,
  INITIAL_FOOTBALL_FORWARD_SLIPS,
  STORAGE_KEYS,
  loadStoredData,
  saveStoredData
} from '../utils/storage';
import { calculateSlipSettlement, exportFootballDataToExcel } from '../utils/footballUtils';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';
import { getLocalDateString } from '../utils/moneyUtils';

interface FootballContextType {
  settings: FootballSettings;
  updateSettings: (newSettings: Partial<FootballSettings>) => void;
  matches: FootballMatch[];
  activeDate: string;
  setActiveDate: (date: string) => void;
  createMatch: (match: Omit<FootballMatch, 'id'>) => FootballMatch;
  updateMatch: (id: string, data: Partial<FootballMatch>) => void;
  deleteMatch: (id: string) => void;
  setMatchScore: (id: string, homeScore: number, awayScore: number) => void;

  // Leagues & Teams Management
  leagues: FootballLeague[];
  allTeams: string[];
  addLeague: (name: string, initialTeams?: string[]) => FootballLeague;
  updateLeague: (id: string, name: string) => void;
  deleteLeague: (id: string) => void;
  addTeamToLeague: (leagueIdOrName: string, teamName: string) => void;
  updateTeamInLeague: (leagueId: string, oldTeamName: string, newTeamName: string) => void;
  deleteTeamFromLeague: (leagueId: string, teamName: string) => void;
  resetLeaguesToDefault: () => void;

  slips: FootballSlip[];
  activeDateSlips: FootballSlip[];
  addSlip: (slip: Omit<FootballSlip, 'id' | 'slipNo' | 'createdAt'>) => FootballSlip;
  updateSlip: (id: string, data: Partial<FootballSlip>) => void;
  deleteSlip: (id: string) => void;

  forwardSlips: FootballForwardSlip[];
  activeDateForwardSlips: FootballForwardSlip[];
  addForwardSlip: (slip: Omit<FootballForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => FootballForwardSlip;
  deleteForwardSlip: (id: string) => void;

  settleMatches: (customMatches?: FootballMatch[]) => void;
  summary: FootballSummary;
  exportToExcel: () => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
  exportJSONBackup: () => string;
  importJSONBackup: (jsonString: string) => boolean;
}

const FootballContext = createContext<FootballContextType | undefined>(undefined);

export const FootballProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with LocalStorage Persistence (Strictly Football Keys)
  const [settings, setSettingsState] = useState<FootballSettings>(() =>
    loadStoredData(STORAGE_KEYS.SETTINGS_FOOTBALL, DEFAULT_FOOTBALL_SETTINGS)
  );

  const [matches, setMatches] = useState<FootballMatch[]>(() =>
    loadStoredData(STORAGE_KEYS.MATCHES_FOOTBALL, INITIAL_FOOTBALL_MATCHES)
  );

  const [activeDate, setActiveDateState] = useState<string>(() => {
    const saved = loadStoredData<string>(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL, '');
    if (saved) return saved;
    return getLocalDateString();
  });

  const [slips, setSlips] = useState<FootballSlip[]>(() =>
    loadStoredData(STORAGE_KEYS.SLIPS_FOOTBALL, INITIAL_FOOTBALL_SLIPS)
  );

  const [forwardSlips, setForwardSlips] = useState<FootballForwardSlip[]>(() =>
    loadStoredData(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL, INITIAL_FOOTBALL_FORWARD_SLIPS)
  );

  const [leagues, setLeagues] = useState<FootballLeague[]>(() =>
    loadStoredData(STORAGE_KEYS.LEAGUES_FOOTBALL, DEFAULT_FOOTBALL_LEAGUES)
  );

  // Sync to localStorage
  useEffect(() => {
    saveStoredData(STORAGE_KEYS.SETTINGS_FOOTBALL, settings);
  }, [settings]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.MATCHES_FOOTBALL, matches);
  }, [matches]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL, activeDate);
  }, [activeDate]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.SLIPS_FOOTBALL, slips);
  }, [slips]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL, forwardSlips);
  }, [forwardSlips]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.LEAGUES_FOOTBALL, leagues);
  }, [leagues]);

  // Combined sorted list of all unique team names across leagues
  const allTeams = useMemo(() => {
    const set = new Set<string>();
    leagues.forEach(l => {
      l.teams.forEach(t => {
        if (t && t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leagues]);

  const addLeague = useCallback((name: string, initialTeams: string[] = []) => {
    const trimmed = name.trim();
    if (!trimmed) return leagues[0];
    const newLeague: FootballLeague = {
      id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      teams: initialTeams.filter(t => t && t.trim())
    };
    setLeagues(prev => [...prev, newLeague]);
    return newLeague;
  }, [leagues]);

  const updateLeague = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLeagues(prev => prev.map(l => l.id === id ? { ...l, name: trimmed } : l));
  }, []);

  const deleteLeague = useCallback((id: string) => {
    setLeagues(prev => prev.filter(l => l.id !== id));
  }, []);

  const addTeamToLeague = useCallback((leagueIdOrName: string, teamName: string) => {
    const trimmedTeam = teamName.trim();
    if (!trimmedTeam) return;

    setLeagues(prev => {
      // Find league by id or name
      const targetIdx = prev.findIndex(l => l.id === leagueIdOrName || l.name.toLowerCase() === leagueIdOrName.toLowerCase());
      if (targetIdx === -1) {
        // Create new league if not found
        const newL: FootballLeague = {
          id: `league-${Date.now()}`,
          name: leagueIdOrName.trim() || 'Custom League',
          teams: [trimmedTeam]
        };
        return [...prev, newL];
      }

      const target = prev[targetIdx];
      if (target.teams.some(t => t.toLowerCase() === trimmedTeam.toLowerCase())) {
        return prev; // already exists
      }

      const updated = [...prev];
      updated[targetIdx] = {
        ...target,
        teams: [...target.teams, trimmedTeam]
      };
      return updated;
    });
  }, []);

  const updateTeamInLeague = useCallback((leagueId: string, oldTeamName: string, newTeamName: string) => {
    const trimmedNew = newTeamName.trim();
    if (!trimmedNew) return;
    setLeagues(prev =>
      prev.map(l => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          teams: l.teams.map(t => (t === oldTeamName ? trimmedNew : t))
        };
      })
    );
    // Also update existing matches containing this team name
    setMatches(prev =>
      prev.map(m => {
        let updatedHome = m.homeTeam;
        let updatedAway = m.awayTeam;
        if (m.homeTeam === oldTeamName) updatedHome = trimmedNew;
        if (m.awayTeam === oldTeamName) updatedAway = trimmedNew;
        if (updatedHome !== m.homeTeam || updatedAway !== m.awayTeam) {
          return {
            ...m,
            homeTeam: updatedHome,
            awayTeam: updatedAway
          };
        }
        return m;
      })
    );
  }, []);

  const deleteTeamFromLeague = useCallback((leagueId: string, teamName: string) => {
    setLeagues(prev =>
      prev.map(l => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          teams: l.teams.filter(t => t !== teamName)
        };
      })
    );
  }, []);

  const resetLeaguesToDefault = useCallback(() => {
    setLeagues(DEFAULT_FOOTBALL_LEAGUES);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<FootballSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  }, []);

  const setActiveDate = useCallback((date: string) => {
    setActiveDateState(date);
  }, []);

  const activeDateSlips = useMemo(() => {
    return slips.filter(s => s.roundDate === activeDate && s.status !== 'cancelled');
  }, [slips, activeDate]);

  const activeDateForwardSlips = useMemo(() => {
    return forwardSlips.filter(f => f.roundDate === activeDate);
  }, [forwardSlips, activeDate]);

  const createMatch = useCallback((matchData: Omit<FootballMatch, 'id'>) => {
    const newMatch: FootballMatch = {
      ...matchData,
      id: `match-${Date.now()}`
    };
    setMatches(prev => [newMatch, ...prev]);
    return newMatch;
  }, []);

  const updateMatch = useCallback((id: string, data: Partial<FootballMatch>) => {
    setMatches(prev =>
      prev.map(m => (m.id === id ? { ...m, ...data } : m))
    );
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
  }, []);

  const setMatchScore = useCallback((id: string, homeScore: number, awayScore: number) => {
    setMatches(prev =>
      prev.map(m =>
        m.id === id
          ? {
              ...m,
              homeScore,
              awayScore,
              status: 'finished' as const
            }
          : m
      )
    );
  }, []);

  const addSlip = useCallback((slipData: Omit<FootballSlip, 'id' | 'slipNo' | 'createdAt'>) => {
    // Duplicate Protection: Prevent same football slip submit twice within 4 seconds
    const fp = generateSubmissionFingerprint('FOOTBALL_SLIP_SAVE', {
      roundDate: slipData.roundDate,
      customerName: slipData.customerName,
      stakeAmount: slipData.stakeAmount,
      netPayable: slipData.netPayable,
      selections: slipData.selections
    });
    if (isDuplicateSubmission(fp, 4000)) {
      console.warn('Duplicate football slip submission detected and blocked!');
      const existing = slips.find(s =>
        s.roundDate === slipData.roundDate &&
        s.customerName === slipData.customerName &&
        s.stakeAmount === slipData.stakeAmount &&
        JSON.stringify(s.selections) === JSON.stringify(slipData.selections)
      );
      if (existing) return existing;
    }

    const localDate = getLocalDateString();
    const todayStr = localDate.slice(2).replace(/-/g, '');
    const todaySlips = slips.filter(s => s.slipNo && s.slipNo.startsWith(`FB-${todayStr}-`));
    let nextSeq = 1001;
    if (todaySlips.length > 0) {
      const seqNums = todaySlips.map(s => {
        const parts = s.slipNo.split('-');
        const last = parts[parts.length - 1];
        const n = parseInt(last, 10);
        return isNaN(n) ? 0 : n;
      });
      nextSeq = Math.max(...seqNums) + 1;
    } else {
      nextSeq = 1001 + slips.length;
    }
    const newSlip: FootballSlip = {
      ...slipData,
      id: `fb-slip-${Date.now()}`,
      slipNo: `FB-${todayStr}-${nextSeq}`,
      createdAt: new Date().toISOString()
    };
    setSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [slips]);

  const updateSlip = useCallback((id: string, data: Partial<FootballSlip>) => {
    setSlips(prev =>
      prev.map(s => (s.id === id ? { ...s, ...data } : s))
    );
  }, []);

  const deleteSlip = useCallback((id: string) => {
    setSlips(prev => prev.filter(s => s.id !== id));
  }, []);

  const addForwardSlip = useCallback((slipData: Omit<FootballForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => {
    const localDate = getLocalDateString();
    const todayStr = localDate.slice(2).replace(/-/g, '');
    const todayFwd = forwardSlips.filter(f => f.slipNo && f.slipNo.startsWith(`FBFWD-${todayStr}-`));
    let nextSeq = 101;
    if (todayFwd.length > 0) {
      const seqNums = todayFwd.map(f => {
        const parts = f.slipNo.split('-');
        const last = parts[parts.length - 1];
        const n = parseInt(last, 10);
        return isNaN(n) ? 0 : n;
      });
      nextSeq = Math.max(...seqNums) + 1;
    } else {
      nextSeq = 101 + forwardSlips.length;
    }
    const newSlip: FootballForwardSlip = {
      ...slipData,
      id: `fb-fwd-${Date.now()}`,
      slipNo: `FBFWD-${todayStr}-${nextSeq}`,
      createdAt: new Date().toISOString()
    };
    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [forwardSlips]);

  const deleteForwardSlip = useCallback((id: string) => {
    setForwardSlips(prev => prev.filter(f => f.id !== id));
  }, []);

  // Automated match results settlement for all active tickets
  const settleMatches = useCallback((customMatches?: FootballMatch[]) => {
    const targetMatches = customMatches || matches;
    const matchesMap = targetMatches.reduce((acc, m) => {
      acc[m.id] = m;
      return acc;
    }, {} as { [id: string]: FootballMatch });

    let settledCount = 0;
    let anyWon = false;

    setSlips(prevSlips =>
      prevSlips.map(slip => {
        // Never settle cancelled tickets
        if (slip.status === 'cancelled') {
          return slip;
        }

        const res = calculateSlipSettlement(slip, matchesMap);
        if (res.outcome !== 'pending') {
          settledCount++;
          if (res.outcome === 'won' || res.outcome === 'half_won') {
            anyWon = true;
          }
          return {
            ...slip,
            status: 'settled',
            outcome: res.outcome,
            actualPayout: res.actualPayout,
            selections: res.evaluatedSelections
          };
        }

        // If match was deleted or score was reset/invalidated, revert to active and reset payout
        return {
          ...slip,
          status: 'active',
          outcome: 'pending',
          actualPayout: undefined,
          selections: res.evaluatedSelections
        };
      })
    );

    if (anyWon) {
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Safe fail
      }
    }
  }, [matches]);

  // Overall financial summary for active date
  const summary = useMemo<FootballSummary>(() => {
    let totalStake = 0;
    let totalBodyStake = 0;
    let totalMaungStake = 0;
    let totalDiscount = 0;
    let netRevenue = 0;
    let totalPayout = 0;
    let wonTicketsCount = 0;
    let lostTicketsCount = 0;
    let pendingTicketsCount = 0;

    activeDateSlips.forEach(s => {
      totalStake += s.stakeAmount;
      totalDiscount += s.discountAmount;
      netRevenue += s.netPayable;

      if (s.slipType === 'body_single') {
        totalBodyStake += s.stakeAmount;
      } else {
        totalMaungStake += s.stakeAmount;
      }

      if (s.outcome === 'won' || s.outcome === 'half_won') {
        wonTicketsCount++;
        totalPayout += s.actualPayout || 0;
      } else if (s.outcome === 'lost') {
        lostTicketsCount++;
      } else {
        pendingTicketsCount++;
      }
    });

    let totalForwarded = 0;
    let forwardedCommission = 0;
    activeDateForwardSlips.forEach(f => {
      totalForwarded += f.stakeAmount;
      forwardedCommission += f.commissionAmount;
    });

    const netProfit = (netRevenue - totalPayout) + forwardedCommission;

    return {
      totalStake,
      totalTickets: activeDateSlips.length,
      totalBodyStake,
      totalMaungStake,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      totalPayout,
      netProfit,
      isProfit: netProfit >= 0,
      wonTicketsCount,
      lostTicketsCount,
      pendingTicketsCount
    };
  }, [activeDateSlips, activeDateForwardSlips]);

  const exportToExcel = useCallback(() => {
    exportFootballDataToExcel(
      activeDate,
      matches,
      activeDateSlips,
      activeDateForwardSlips,
      summary,
      settings.shopName
    );
  }, [activeDate, matches, activeDateSlips, activeDateForwardSlips, summary, settings.shopName]);

  const resetToSampleData = useCallback(() => {
    setSettingsState(DEFAULT_FOOTBALL_SETTINGS);
    setMatches(INITIAL_FOOTBALL_MATCHES);
    setSlips(INITIAL_FOOTBALL_SLIPS);
    setForwardSlips(INITIAL_FOOTBALL_FORWARD_SLIPS);
    setLeagues(DEFAULT_FOOTBALL_LEAGUES);
    setActiveDateState(getLocalDateString());
  }, []);

  const clearAllData = useCallback(() => {
    setSlips([]);
    setForwardSlips([]);
  }, []);

  // Dedicated Football JSON Backup Export
  const exportJSONBackup = useCallback(() => {
    const backupObj = {
      app: 'Football Ledger Pro',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      storageType: 'FOOTBALL_BETTING_ISOLATED',
      data: {
        settings,
        matches,
        slips,
        forwardSlips,
        activeDate,
        leagues
      }
    };
    return JSON.stringify(backupObj, null, 2);
  }, [settings, matches, slips, forwardSlips, activeDate, leagues]);

  // Dedicated Football JSON Backup Import
  const importJSONBackup = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.data || parsed;

      if (data.settings) setSettingsState(data.settings);
      if (Array.isArray(data.matches)) setMatches(data.matches);
      if (Array.isArray(data.slips)) setSlips(data.slips);
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (Array.isArray(data.leagues)) setLeagues(data.leagues);
      if (data.activeDate) setActiveDateState(data.activeDate);

      return true;
    } catch (err) {
      console.error('Failed to import Football backup:', err);
      return false;
    }
  }, []);

  return (
    <FootballContext.Provider
      value={{
        settings,
        updateSettings,
        matches,
        activeDate,
        setActiveDate,
        createMatch,
        updateMatch,
        deleteMatch,
        setMatchScore,
        leagues,
        allTeams,
        addLeague,
        updateLeague,
        deleteLeague,
        addTeamToLeague,
        updateTeamInLeague,
        deleteTeamFromLeague,
        resetLeaguesToDefault,
        slips,
        activeDateSlips,
        addSlip,
        updateSlip,
        deleteSlip,
        forwardSlips,
        activeDateForwardSlips,
        addForwardSlip,
        deleteForwardSlip,
        settleMatches,
        summary,
        exportToExcel,
        resetToSampleData,
        clearAllData,
        exportJSONBackup,
        importJSONBackup
      }}
    >
      {children}
    </FootballContext.Provider>
  );
};

export const useFootball = () => {
  const context = useContext(FootballContext);
  if (!context) {
    throw new Error('useFootball must be used within a FootballProvider');
  }
  return context;
};
