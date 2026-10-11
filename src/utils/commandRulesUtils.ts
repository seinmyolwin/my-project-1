/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { convertMyanmarToEnglishDigits } from './lotteryUtils';

export type CommandRuleModule = '2d' | '3d' | 'football' | 'all';

export interface CommandRule {
  id: string;
  module: CommandRuleModule;
  name: string;
  syntaxPattern: string;
  exampleInput: string;
  exampleOutput: string;
  description: string;
  isCustom: boolean;
  isEnabled: boolean;
  category: 'ratio' | 'combination' | 'special_set' | 'football' | 'custom';
  createdAt?: string;
}

export const STORAGE_KEY_COMMAND_RULES = 'bookie_custom_command_rules_v1';

// Default standard rules for 2D, 3D, and Football
export const DEFAULT_COMMAND_RULES: CommandRule[] = [
  // 2D Rules
  {
    id: 'rule-2d-ratio-slash',
    module: '2d',
    name: 'တိုက်ရိုက် နှင့် အာ သီးသန့်ခွဲထိုးခြင်း [၈၀၀/၂၀၀]',
    syntaxPattern: '[ဂဏန်းများ] [ဒဲ့ကြေး]/[အာကြေး]',
    exampleInput: '၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀',
    exampleOutput: '၂၃=၈၀၀, ၄၅=၈၀၀, ၂၆=၈၀၀, ၃၂=၂၀၀, ၅၄=၂၀၀, ၆၂=၂၀၀',
    description: 'ရိုက်ထည့်ထားသော ဂဏန်းများကို ပထမထိုးကြေး (၈၀၀) ဖြင့် ဒဲ့ယူပြီး၊ ၎င်းတို့၏ ပြန်လှည့် (အာ) ဂဏန်းများကို ဒုတိယထိုးကြေး (၂၀၀) ဖြင့် အလိုအလျောက် သီးခြားခွဲယူပါသည် (ဥပမာ: ၃၄ ၄၆ ၃၇ ၁၀၀၀/၅၀၀ ဆိုပါက ၃၄,၄၆,၃၇=၁၀၀၀ နှင့် ၄၃,၆၄,၇၃=၅၀၀ ယူပါသည်)',
    isCustom: false,
    isEnabled: true,
    category: 'ratio'
  },
  {
    id: 'rule-2d-khway-all',
    module: '2d',
    name: 'ခွေ / ခွေပူး / ခွေအာ / ခွေပူးအာ (အတွဲလိုက် ခွေနည်းများ)',
    syntaxPattern: '[ဂဏန်း] ခွေ [ကြေး] / ခွေပူး / ခွေအာ / ခွေပူးအာ',
    exampleInput: '1234 ခွေ 500',
    exampleOutput: '12, 13, 14, 23, 24, 34 (၆ ကွက်) တစ်ကွက် ၅၀၀ ကျပ်',
    description: 'ပေးထားသော ဂဏန်းများမှ အတွဲလိုက်ခွေယူခြင်း (ခွေ)၊ အပူးပါခွေယူခြင်း (ခွေပူး)၊ အာခွေ (ခွေအာ) နှင့် အပူးပါအာခွေ (ခွေပူးအာ) အားလုံးကို အလိုအလျောက် ဖြန့်ထုတ်တွက်ချက်ပေးပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-special-sets',
    module: '2d',
    name: 'အပူး / ပါဝါ / နက္ခတ် / ညီကို (အထူးဂဏန်းအတွဲများ)',
    syntaxPattern: 'အပူး [ကြေး] / ပါဝါ [ကြေး] / နက္ခတ် [ကြေး] / ညီကို [ကြေး]',
    exampleInput: 'အပူး 1000',
    exampleOutput: '00, 11, 22, 33, 44, 55, 66, 77, 88, 99 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: 'အပူး (၁၀ ကွက်)၊ ပါဝါ (၁၀ ကွက်)၊ နက္ခတ် (၁၀ ကွက်) နှင့် ညီကို (၁၀ ကွက်) အုပ်စုလိုက် စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'special_set'
  },
  {
    id: 'rule-2d-head-tail-break',
    module: '2d',
    name: 'ထိပ် / ပိတ် / ဘရိတ် / စုံမ အုပ်စုများ',
    syntaxPattern: '[ဂဏန်း] ထိပ် [ကြေး] / [ဂဏန်း] ပိတ် [ကြေး] / [ဂဏန်း] ဘရိတ် [ကြေး]',
    exampleInput: '5 ထိပ် 1000\n4 ဘရိတ် 2000',
    exampleOutput: '50-59 (၁၀ ကွက်) ၁၀၀၀ စီ ၊ ဘရိတ် ၄ ရသောဂဏန်း (၁၀ ကွက်) ၂၀၀၀ စီ',
    description: 'ထိပ်စီးဂဏန်း (Head)၊ နောက်ပိတ်ဂဏန်း (Tail)၊ ပေါင်းခြင်းဘရိတ် (Break) နှင့် စုံစုံ/မမ/စုံမ/မစုံ ဂဏန်းများကို အလိုအလျောက် ရွေးထုတ်ယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-rumble-r',
    module: '2d',
    name: 'အာ / R (ပြန်လှည့် ၂ ကွက်တွဲ)',
    syntaxPattern: '[ဂဏန်းများ] R [ကြေး] သို့မဟုတ် [ဂဏန်းများ] အာ [ကြေး]',
    exampleInput: '24 57 R 1000',
    exampleOutput: '24=1000, 42=1000, 57=1000, 75=1000 (၄ ကွက်)',
    description: 'ဂဏန်းနှင့် ၎င်း၏ အပြန် (အာ) ကို သတ်မှတ်ထားသော တူညီသည့်ထိုးကြေးဖြင့် တွဲဖက်စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },

  // 3D Rules
  {
    id: 'rule-3d-ratio-slash',
    module: '3d',
    name: 'ဒဲ့ နှင့် အာ သီးသန့်ခွဲထိုးခြင်း [၁၀၀၀/၂၀၀]',
    syntaxPattern: '[ဂဏန်းများ] [ဒဲ့ကြေး]/[အာကြေး]',
    exampleInput: '123 456 1000/200',
    exampleOutput: '123 ဒဲ့ ၁၀၀၀၊ 456 ဒဲ့ ၁၀၀၀၊ 123 R/ပတ် ၂၀၀၊ 456 R/ပတ် ၂၀၀',
    description: '၃ လုံးဂဏန်းများကို ဒဲ့ (Straight) အတွက် ပထမထိုးကြေး (၁၀၀၀) ယူပြီး၊ အာ (Rumble) အတွက် ဒုတိယထိုးကြေး (၂၀၀) အဖြစ် အလိုအလျောက် ခွဲယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'ratio'
  },
  {
    id: 'rule-3d-rumble-all',
    module: '3d',
    name: 'ပတ်လည် / အာ / R (Permutation ခွေအားလုံး)',
    syntaxPattern: '[ဂဏန်းများ] R [ကြေး] သို့မဟုတ် [ဂဏန်းများ] ပတ် [ကြေး]',
    exampleInput: '123 R 1000',
    exampleOutput: '123, 132, 213, 231, 312, 321 (၆ ခွေ) တစ်ကွက် ၁၀၀၀ စီ',
    description: '၃ လုံးဂဏန်း၏ ဖြစ်နိုင်သမျှ အလှည့်အားလုံး (၆ ခွေ သို့မဟုတ် အပူးပါပါက ၃ ခွေ) ကို အပြည့်အဝ စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-3d-straight-batch',
    module: '3d',
    name: 'ဒဲ့ သီးသန့် အမြန်စာရင်းသွင်းခြင်း (Straight Bets)',
    syntaxPattern: '[ဂဏန်းများ] = [ကြေး] သို့မဟုတ် [ဂဏန်းများ] [ကြေး]',
    exampleInput: '123, 456, 789 = 500',
    exampleOutput: '123=500, 456=500, 789=500',
    description: '၃ လုံး ဒဲ့ သီးသန့် အကွက်များကို ကော်မာ သို့မဟုတ် ခြား၍ တပြိုင်နက်တည်း အမြန်စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },

  // Football Rules
  {
    id: 'rule-fb-body-single',
    module: 'football',
    name: 'ဘော်ဒီ အမြန်ထိုးခြင်း (Body Bet Command)',
    syntaxPattern: '[အသင်းအမည်] [ကြေး] သို့မဟုတ် [အသင်းအမည်] Body [ကြေး]',
    exampleInput: 'မန်ယူ 5000',
    exampleOutput: 'မန်ယူ (Body) - ၅,၀၀၀ ကျပ်',
    description: 'ပွဲစဉ်များထဲမှ သက်ဆိုင်ရာ အသင်းအမည်ကို အလိုအလျောက် ရှာဖွေပြီး အဆိုပါအသင်း၏ ဘော်ဒီထိုးကြေးအဖြစ် တိုက်ရိုက်ယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'football'
  },
  {
    id: 'rule-fb-over-under',
    module: 'football',
    name: 'ဂိုးပေါင်း အပေါ် / အောက် (Over / Under Command)',
    syntaxPattern: '[အသင်းအမည်] Over/အပေါ် [ကြေး] သို့မဟုတ် [အသင်းအမည်] Under/အောက် [ကြေး]',
    exampleInput: 'မန်ယူ Over 5000\nChelsea အောက် 3000',
    exampleOutput: 'မန်ယူပွဲ ဂိုးပေါင်း အပေါ် ၅၀၀၀၊ Chelsea ပွဲ ဂိုးပေါင်း အောက် ၃၀၀၀',
    description: 'သတ်မှတ်ပွဲစဉ်၏ သတ်မှတ်ဂိုးပေါင်းလိုင်းအတိုင်း အပေါ် (Over) သို့မဟုတ် အောက် (Under) ကို ရွေးချယ်စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'football'
  },
  {
    id: 'rule-fb-parlay-maung',
    module: 'football',
    name: 'မောင်းအတွဲလိုက် အမြန်ထိုးခြင်း (Mix Parlay Command)',
    syntaxPattern: '[အသင်း၁] [အသင်း၂] [အသင်း၃] [ကြေး]',
    exampleInput: 'မန်ယူ ချဲလ်ဆီး အာဆင်နယ် 3000',
    exampleOutput: '၃ သင်းမောင်း (မန်ယူ + ချဲလ်ဆီး + အာဆင်နယ်) - ၃,၀၀၀ ကျပ်',
    description: 'အသင်းအမည်များစွာကို တစ်ကြောင်းတည်း ရိုက်ထည့်၍ မောင်းတွဲပြီး ထိုးကြေးကို တိုက်ရိုက်စာရင်းသွင်းယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'football'
  }
];

export function loadCommandRules(): CommandRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMAND_RULES);
    if (!raw) return DEFAULT_COMMAND_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COMMAND_RULES;

    // Merge any missing default rules into loaded array
    const loadedIds = new Set(parsed.map((r: CommandRule) => r.id));
    const merged = [...parsed];
    for (const def of DEFAULT_COMMAND_RULES) {
      if (!loadedIds.has(def.id)) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return DEFAULT_COMMAND_RULES;
  }
}

export function saveCommandRules(rules: CommandRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COMMAND_RULES, JSON.stringify(rules));
  } catch (err) {
    console.error('Failed to save command rules to localStorage:', err);
  }
}

export function resetCommandRulesToDefault(): CommandRule[] {
  try {
    localStorage.removeItem(STORAGE_KEY_COMMAND_RULES);
  } catch {}
  return DEFAULT_COMMAND_RULES;
}
