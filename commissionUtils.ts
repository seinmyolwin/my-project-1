export const getCustomerCommissionRates = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem('shwe_customer_commission_rates');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setCustomerCommissionRates = (rates: Record<string, number>) => {
  localStorage.setItem('shwe_customer_commission_rates', JSON.stringify(rates));
};

export const getCustomerCommission = (customerName: string, defaultRate: number): number => {
  const rates = getCustomerCommissionRates();
  return rates[customerName] !== undefined ? rates[customerName] : defaultRate;
};
