export type CommissionBusinessMode = '2d' | '3d' | 'football';
export type ScopedCommissionRates = Record<CommissionBusinessMode, Record<string, number>>;

export const COMMISSION_BUSINESS_MODES: CommissionBusinessMode[] = ['2d', '3d', 'football'];

const SCOPED_CUSTOMER_RATES_KEY = 'shwe_customer_commission_rates_v2';
const SCOPED_UPLINE_RATES_KEY = 'shwe_upline_commission_rates_v2';

const LEGACY_PRIMARY_RATES_KEY = 'shwe_customer_commission_rates';
const LEGACY_RATES_KEY = 'shwe_customer_commissions_v1';
const LEGACY_UPLINE_RATES_KEY = 'shwe_upline_commission_rates';

const ROUND_RATES_KEY = 'shwe_round_customer_commissions_v1';
const ROUND_UPLINE_RATES_KEY = 'shwe_round_upline_commissions_v1';
const MASTER_AGENTS_LIST_KEY = 'shwe_master_agents_list';
export const COMMISSION_UPDATED_EVENT = 'shwe_customer_commissions_updated';

export function inferModeFromRoundKey(roundKey?: string): CommissionBusinessMode {
  const key = (roundKey || '').trim().toLowerCase();
  if (key.startsWith('2d-')) return '2d';
  if (key.startsWith('football-')) return 'football';
  return '3d';
}

function readRawStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRawStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function readJsonMap(key: string): Record<string, any> {
  try {
    const saved = readRawStorage(key);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanFlatRateMap(raw: unknown): Record<string, number> {
  const cleaned: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cleaned;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const trimmed = k.trim();
    const num = Number(v);
    if (trimmed && !isNaN(num) && isFinite(num) && num >= 0) {
      cleaned[trimmed] = num;
    }
  }
  return cleaned;
}

function createEmptyScopedRates(): ScopedCommissionRates {
  return {
    '2d': {},
    '3d': {},
    'football': {}
  };
}

function dispatchCommissionUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMISSION_UPDATED_EVENT));
  }
}

// ====================================================
// DOWNLINE (ထိုးသား / အောက်လက်ဒိုင်ငယ်) BUSINESS-SCOPED COMMISSIONS
// ====================================================

export const getCustomerCommissionRatesByMode = (): ScopedCommissionRates => {
  const rawV2 = readRawStorage(SCOPED_CUSTOMER_RATES_KEY);
  if (rawV2 !== null) {
    try {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          '2d': cleanFlatRateMap(parsed['2d']),
          '3d': cleanFlatRateMap(parsed['3d']),
          'football': cleanFlatRateMap(parsed['football'])
        };
      }
    } catch {
      // fall through to legacy migration
    }
  }

  // One-time migration from legacy flat customer commission maps
  const legacy = cleanFlatRateMap(readJsonMap(LEGACY_RATES_KEY));
  const legacyPrimary = cleanFlatRateMap(readJsonMap(LEGACY_PRIMARY_RATES_KEY));
  const mergedLegacy: Record<string, number> = { ...legacy, ...legacyPrimary };

  if (Object.keys(mergedLegacy).length > 0) {
    const migrated: ScopedCommissionRates = {
      '2d': { ...mergedLegacy },
      '3d': { ...mergedLegacy },
      'football': { ...mergedLegacy }
    };
    writeRawStorage(SCOPED_CUSTOMER_RATES_KEY, JSON.stringify(migrated));
    return migrated;
  }

  return createEmptyScopedRates();
};

export const getCustomerCommissionRates = (mode: CommissionBusinessMode): Record<string, number> => {
  const byMode = getCustomerCommissionRatesByMode();
  return { ...byMode[mode] };
};

export const setCustomerCommissionRates = (
  rates: Record<string, number>,
  mode: CommissionBusinessMode
) => {
  const cleaned = cleanFlatRateMap(rates);
  const byMode = getCustomerCommissionRatesByMode();
  byMode[mode] = cleaned;
  writeRawStorage(SCOPED_CUSTOMER_RATES_KEY, JSON.stringify(byMode));
  dispatchCommissionUpdated();
};

export const getCustomerCommission = (
  customerName: string,
  defaultRate: number,
  mode: CommissionBusinessMode
): number => {
  const rates = getCustomerCommissionRates(mode);
  const key = (customerName || '').trim();
  return rates[key] !== undefined ? rates[key] : defaultRate;
};

export const getAllRoundCustomerCommissions = (): Record<string, Record<string, number>> => {
  const raw = readJsonMap(ROUND_RATES_KEY);
  const result: Record<string, Record<string, number>> = {};
  for (const [roundKey, map] of Object.entries(raw)) {
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      result[roundKey] = cleanFlatRateMap(map);
    }
  }
  return result;
};

export const getRoundCustomerCommissions = (roundKey: string): Record<string, number> => {
  const all = getAllRoundCustomerCommissions();
  return all[roundKey] || {};
};

export const setRoundCustomerCommissions = (roundKey: string, rates: Record<string, number>) => {
  const all = getAllRoundCustomerCommissions();
  all[roundKey] = cleanFlatRateMap(rates);
  writeRawStorage(ROUND_RATES_KEY, JSON.stringify(all));
  dispatchCommissionUpdated();
};

export interface ModeCommissionBulkEntry {
  roundKey?: string;
  mode: CommissionBusinessMode;
  rates: Record<string, number>;
}

export const setBulkRoundAndGlobalCustomerCommissionsByMode = (
  entries: ModeCommissionBulkEntry[]
) => {
  const byMode = getCustomerCommissionRatesByMode();
  const allRounds = getAllRoundCustomerCommissions();

  entries.forEach(({ roundKey, mode, rates }) => {
    const cleanedInput = cleanFlatRateMap(rates);
    byMode[mode] = {
      ...byMode[mode],
      ...cleanedInput
    };
    if (roundKey) {
      allRounds[roundKey] = {
        ...(allRounds[roundKey] || {}),
        ...cleanedInput
      };
    }
  });

  writeRawStorage(SCOPED_CUSTOMER_RATES_KEY, JSON.stringify(byMode));
  writeRawStorage(ROUND_RATES_KEY, JSON.stringify(allRounds));
  dispatchCommissionUpdated();
};

export const setBulkRoundAndGlobalCustomerCommissions = (
  roundKeys: string[],
  rates: Record<string, number>,
  mode: CommissionBusinessMode
) => {
  const entries: ModeCommissionBulkEntry[] =
    roundKeys.length > 0
      ? roundKeys.map((rk) => ({ roundKey: rk, mode, rates }))
      : [{ mode, rates }];
  setBulkRoundAndGlobalCustomerCommissionsByMode(entries);
};

export const resolveCustomerCommissionRate = (params: {
  mode?: CommissionBusinessMode;
  roundKey?: string;
  customerName?: string;
  defaultRate: number;
  globalRates?: Record<string, number>;
  globalRatesByMode?: ScopedCommissionRates;
  roundRates?: Record<string, Record<string, number>>;
}): { rate: number; isExplicit: boolean } => {
  const cust = (params.customerName || 'အထွေထွေ').trim();
  const effectiveMode = params.mode ?? inferModeFromRoundKey(params.roundKey);

  const roundMap = params.roundKey
    ? (params.roundRates ? params.roundRates[params.roundKey] : getRoundCustomerCommissions(params.roundKey))
    : undefined;
  if (roundMap && roundMap[cust] !== undefined) {
    return { rate: roundMap[cust], isExplicit: true };
  }

  const globalMap =
    params.globalRates ??
    (params.globalRatesByMode
      ? params.globalRatesByMode[effectiveMode]
      : getCustomerCommissionRates(effectiveMode));

  if (globalMap && globalMap[cust] !== undefined) {
    return { rate: globalMap[cust], isExplicit: true };
  }
  return { rate: params.defaultRate, isExplicit: false };
};

// ====================================================
// UPLINE (အထက်ဒိုင် / လွှဲတင်ဒိုင်) BUSINESS-SCOPED COMMISSIONS
// ====================================================

function syncSavedMasterAgentsRates(
  cleanedRates: Record<string, number>,
  mode: CommissionBusinessMode
) {
  try {
    const raw = readRawStorage(MASTER_AGENTS_LIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    let changed = false;
    const updated = parsed.map((agent: any) => {
      const name = String(agent?.name || '').trim();
      if (!name) return agent;
      const existingByMode: Partial<Record<CommissionBusinessMode, number>> = {
        ...(agent?.commissionRatesByMode && typeof agent.commissionRatesByMode === 'object'
          ? agent.commissionRatesByMode
          : {})
      };
      if (cleanedRates[name] !== undefined) {
        if (existingByMode[mode] !== cleanedRates[name]) {
          existingByMode[mode] = cleanedRates[name];
          changed = true;
          return {
            ...agent,
            commissionRatesByMode: existingByMode
          };
        }
      } else if (existingByMode[mode] !== undefined) {
        delete existingByMode[mode];
        changed = true;
        return {
          ...agent,
          commissionRatesByMode: existingByMode
        };
      }
      return agent;
    });
    if (changed) {
      writeRawStorage(MASTER_AGENTS_LIST_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export const getUplineCommissionRatesByMode = (): ScopedCommissionRates => {
  const rawV2 = readRawStorage(SCOPED_UPLINE_RATES_KEY);
  if (rawV2 !== null) {
    try {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          '2d': cleanFlatRateMap(parsed['2d']),
          '3d': cleanFlatRateMap(parsed['3d']),
          'football': cleanFlatRateMap(parsed['football'])
        };
      }
    } catch {
      // fall through to legacy migration
    }
  }

  // One-time migration from legacy flat upline map
  const legacyUpline = cleanFlatRateMap(readJsonMap(LEGACY_UPLINE_RATES_KEY));
  if (Object.keys(legacyUpline).length > 0) {
    const migrated: ScopedCommissionRates = {
      '2d': { ...legacyUpline },
      '3d': { ...legacyUpline },
      'football': { ...legacyUpline }
    };
    writeRawStorage(SCOPED_UPLINE_RATES_KEY, JSON.stringify(migrated));
    return migrated;
  }

  return createEmptyScopedRates();
};

export const getUplineCommissionRates = (mode: CommissionBusinessMode): Record<string, number> => {
  const byMode = getUplineCommissionRatesByMode();
  return { ...byMode[mode] };
};

export const setUplineCommissionRates = (
  rates: Record<string, number>,
  mode: CommissionBusinessMode
) => {
  const cleaned = cleanFlatRateMap(rates);
  const byMode = getUplineCommissionRatesByMode();
  byMode[mode] = cleaned;
  writeRawStorage(SCOPED_UPLINE_RATES_KEY, JSON.stringify(byMode));
  syncSavedMasterAgentsRates(cleaned, mode);
  dispatchCommissionUpdated();
};

export const getUplineCommission = (
  masterAgentName: string,
  defaultRate: number,
  mode: CommissionBusinessMode
): number => {
  const rates = getUplineCommissionRates(mode);
  const key = (masterAgentName || '').trim();
  return rates[key] !== undefined ? rates[key] : defaultRate;
};

export const getAllRoundUplineCommissions = (): Record<string, Record<string, number>> => {
  const raw = readJsonMap(ROUND_UPLINE_RATES_KEY);
  const result: Record<string, Record<string, number>> = {};
  for (const [roundKey, map] of Object.entries(raw)) {
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      result[roundKey] = cleanFlatRateMap(map);
    }
  }
  return result;
};

export const getRoundUplineCommissions = (roundKey: string): Record<string, number> => {
  const all = getAllRoundUplineCommissions();
  return all[roundKey] || {};
};

export const setRoundUplineCommissions = (roundKey: string, rates: Record<string, number>) => {
  const all = getAllRoundUplineCommissions();
  all[roundKey] = cleanFlatRateMap(rates);
  writeRawStorage(ROUND_UPLINE_RATES_KEY, JSON.stringify(all));
  dispatchCommissionUpdated();
};

export const setBulkRoundAndGlobalUplineCommissionsByMode = (
  entries: ModeCommissionBulkEntry[]
) => {
  const byMode = getUplineCommissionRatesByMode();
  const allRounds = getAllRoundUplineCommissions();
  const touchedModes = new Set<CommissionBusinessMode>();

  entries.forEach(({ roundKey, mode, rates }) => {
    const cleanedInput = cleanFlatRateMap(rates);
    byMode[mode] = {
      ...byMode[mode],
      ...cleanedInput
    };
    touchedModes.add(mode);
    if (roundKey) {
      allRounds[roundKey] = {
        ...(allRounds[roundKey] || {}),
        ...cleanedInput
      };
    }
  });

  writeRawStorage(SCOPED_UPLINE_RATES_KEY, JSON.stringify(byMode));
  touchedModes.forEach((m) => syncSavedMasterAgentsRates(byMode[m], m));
  writeRawStorage(ROUND_UPLINE_RATES_KEY, JSON.stringify(allRounds));
  dispatchCommissionUpdated();
};

export const setBulkRoundAndGlobalUplineCommissions = (
  roundKeys: string[],
  rates: Record<string, number>,
  mode: CommissionBusinessMode
) => {
  const entries: ModeCommissionBulkEntry[] =
    roundKeys.length > 0
      ? roundKeys.map((rk) => ({ roundKey: rk, mode, rates }))
      : [{ mode, rates }];
  setBulkRoundAndGlobalUplineCommissionsByMode(entries);
};

export const resolveUplineCommissionRate = (params: {
  mode?: CommissionBusinessMode;
  roundKey?: string;
  masterAgentName?: string;
  defaultRate: number;
  uplineGlobalRates?: Record<string, number>;
  uplineGlobalRatesByMode?: ScopedCommissionRates;
  uplineRoundRates?: Record<string, Record<string, number>>;
}): { rate: number; isExplicit: boolean } => {
  const agent = (params.masterAgentName || 'ဒိုင်ချုပ်ကြီး').trim();
  const effectiveMode = params.mode ?? inferModeFromRoundKey(params.roundKey);

  const roundMap = params.roundKey
    ? (params.uplineRoundRates ? params.uplineRoundRates[params.roundKey] : getRoundUplineCommissions(params.roundKey))
    : undefined;
  if (roundMap && roundMap[agent] !== undefined) {
    return { rate: roundMap[agent], isExplicit: true };
  }

  const globalMap =
    params.uplineGlobalRates ??
    (params.uplineGlobalRatesByMode
      ? params.uplineGlobalRatesByMode[effectiveMode]
      : getUplineCommissionRates(effectiveMode));

  if (globalMap && globalMap[agent] !== undefined) {
    return { rate: globalMap[agent], isExplicit: true };
  }
  return { rate: params.defaultRate, isExplicit: false };
};
