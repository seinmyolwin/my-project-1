import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { getCustomerCommissionRates, setCustomerCommissionRates } from '../utils/commissionUtils';

export const CustomerCommissionManager: React.FC = () => {
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');

  useEffect(() => {
    setCommissions(getCustomerCommissionRates());
  }, []);

  const add = () => {
    if (!name || !rate) return;
    const newCommissions = { ...commissions, [name]: parseFloat(rate) };
    setCustomerCommissionRates(newCommissions);
    setCommissions(newCommissions);
    setName('');
    setRate('');
  };

  const remove = (name: string) => {
    const newCommissions = { ...commissions };
    delete newCommissions[name];
    setCustomerCommissionRates(newCommissions);
    setCommissions(newCommissions);
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-900">အောက်လက်ဒိုင်ငယ်များ ကော်မရှင်သတ်မှတ်ချက်</h3>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 flex-1 text-xs" value={name} onChange={e => setName(e.target.value)} placeholder="ဒိုင်ငယ်အမည်" />
        <input className="border rounded px-2 py-1 w-20 text-xs" type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="%" />
        <button className="bg-indigo-600 text-white px-3 rounded" onClick={add}><Plus size={16}/></button>
      </div>
      <div className="space-y-2">
        {Object.entries(commissions).map(([n, r]) => (
          <div key={n} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs">
            <span>{n}: {r}%</span>
            <button className="text-rose-500" onClick={() => remove(n)}><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};
