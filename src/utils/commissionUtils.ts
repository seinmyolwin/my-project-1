const PRIMARY_RATES_KEY = 'shwe_customer_commission_rates';
const LEGACY_RATES_KEY = 'shwe_customer_commissions_v1';
const ROUND_RATES_KEY = 'shwe_round_customer_commissions_v1';
export const COMMISSION_UPDATED_EVENT = 'shwe_customer_commissions_updated';

function readJsonMap(key: string): Record<string, any> {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function dispatchCommissionUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMISSION_UPDATED_EVENT));
  }
}

export const getCustomerCommissionRates = (): Record<string, number> => {
  const legacy = readJsonMap(LEGACY_RATES_KEY);
  const primary = readJsonMap(PRIMARY_RATES_KEY);
  const merged: Record<string, number> = {};
  for (const [k, v] of Object.entries(legacy)) {
    const num = Number(v);
    if (!isNaN(num)) merged[k.trim()] = num;
  }
  for (const [k, v] of Object.entries(primary)) {
    const num = Number(v);
    if (!isNaN(num)) merged[k.trim()] = num;
  }
  return merged;
};

export const setCustomerCommissionRates = (rates: Record<string, number>) => {
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const trimmed = k.trim();
    const num = Number(v);
    if (trimmed && !isNaN(num) && num >= 0) {
      cleaned[trimmed] = num;
    }
  }
  localStorage.setItem(PRIMARY_RATES_KEY, JSON.stringify(cleaned));
  localStorage.setItem(LEGACY_RATES_KEY, JSON.stringify(cleaned));
  dispatchCommissionUpdated();
};

export const getCustomerCommission = (customerName: string, defaultRate: number): number => {
  const rates = getCustomerCommissionRates();
  const key = (customerName || '').trim();
  return rates[key] !== undefined ? rates[key] : defaultRate;
};

export const getAllRoundCustomerCommissions = (): Record<string, Record<string, number>> => {
  const raw = readJsonMap(ROUND_RATES_KEY);
  const result: Record<string, Record<string, number>> = {};
  for (const [roundKey, map] of Object.entries(raw)) {
    if (map && typeof map === 'object') {
      const cleanedMap: Record<string, number> = {};
      for (const [cust, rate] of Object.entries(map as Record<string, unknown>)) {
        const num = Number(rate);
        if (!isNaN(num) && num >= 0) {
          cleanedMap[cust.trim()] = num;
        }
      }
      result[roundKey] = cleanedMap;
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
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const trimmed = k.trim();
    const num = Number(v);
    if (trimmed && !isNaN(num) && num >= 0) {
      cleaned[trimmed] = num;
    }
  }
  all[roundKey] = cleaned;
  localStorage.setItem(ROUND_RATES_KEY, JSON.stringify(all));
  dispatchCommissionUpdated();
};

export const setBulkRoundAndGlobalCustomerCommissions = (
  roundKeys: string[],
  rates: Record<string, number>
) => {
  const existingGlobal = getCustomerCommissionRates();
  const nextGlobal: Record<string, number> = { ...existingGlobal };
  const cleanedInput: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const trimmed = k.trim();
    const num = Number(v);
    if (trimmed && !isNaN(num) && num >= 0) {
      cleanedInput[trimmed] = num;
      nextGlobal[trimmed] = num;
    }
  }
  localStorage.setItem(PRIMARY_RATES_KEY, JSON.stringify(nextGlobal));
  localStorage.setItem(LEGACY_RATES_KEY, JSON.stringify(nextGlobal));

  const allRounds = getAllRoundCustomerCommissions();
  roundKeys.forEach((rk) => {
    allRounds[rk] = { ...(allRounds[rk] || {}), ...cleanedInput };
  });
  localStorage.setItem(ROUND_RATES_KEY, JSON.stringify(allRounds));
  dispatchCommissionUpdated();
};

export const resolveCustomerCommissionRate = (params: {
  roundKey?: string;
  customerName?: string;
  defaultRate: number;
  globalRates?: Record<string, number>;
  roundRates?: Record<string, Record<string, number>>;
}): { rate: number; isExplicit: boolean } => {
  const cust = (params.customerName || 'အထွေထွေ').trim();
  const roundMap = params.roundKey
    ? (params.roundRates ? params.roundRates[params.roundKey] : getRoundCustomerCommissions(params.roundKey))
    : undefined;
  if (roundMap && roundMap[cust] !== undefined) {
    return { rate: roundMap[cust], isExplicit: true };
  }
  const globalMap = params.globalRates || getCustomerCommissionRates();
  if (globalMap[cust] !== undefined) {
    return { rate: globalMap[cust], isExplicit: true };
  }
  return { rate: params.defaultRate, isExplicit: false };
};
