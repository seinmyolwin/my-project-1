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

export const STORAGE_KEY_COMMAND_RULES = 'bookie_custom_command_rules_v2';

// Default standard rules for 2D, 3D, and Football (အမြဲတမ်းအတည် ဂဏန်းယူနည်း စည်းမျဉ်းများ)
export const DEFAULT_COMMAND_RULES: CommandRule[] = [
  // ----------------------------------------------------
  // 2D Rules (ဇီးကွက် အမြဲတမ်းအတည် ဂဏန်းယူနည်းများ)
  // ----------------------------------------------------
  {
    id: 'rule-2d-straight',
    module: '2d',
    name: 'ဒဲ့ (Direct / Straight ထိုးနည်း)',
    syntaxPattern: '[ဂဏန်း] ဒဲ့ [ကြေး] သို့မဟုတ် [ဂဏန်း]=[ကြေး]',
    exampleInput: '၂၄ ဒဲ့ ၁၀၀၀ သို့ ၂၄=၁၀၀၀',
    exampleOutput: '၂၄ = ၁,၀၀၀ ကျပ် (တိုက်ရိုက် ၁ ကွက်)',
    description: 'ဂဏန်းကွက်ထဲ ကြိုက်သည့်ဂဏန်းရိုက်ပြီး "ဒဲ့" နှိပ်ပါက ထိုဂဏန်းအတိုင်း တိုက်ရိုက်ယူပါသည် (ဥပမာ: ၂၄ -> 24)',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-rumble-r',
    module: '2d',
    name: 'အာ / R (Reversal အပြန်အလှန် လှည့်တွဲယူနည်း)',
    syntaxPattern: '[ဂဏန်း] အာ [ကြေး] သို့မဟုတ် [ဂဏန်း] R [ကြေး]',
    exampleInput: '၂၄ အာ ၅၀၀ သို့ ၂၄R ၅၀၀',
    exampleOutput: '24=500, 42=500 (အပြန်အလှန် ၂ ကွက်)',
    description: 'ဂဏန်းကွက်ထဲ ကြိုက်သည့်ဂဏန်းရိုက်ပြီး "အာ" နှိပ်ပါက အပြန်အလှန်ဂဏန်းအားလုံး ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည် (ဥပမာ: ၂၄ -> 24 42 ၊ ၂၄ ၃၅ -> 24 42 35 53)',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-break',
    module: '2d',
    name: 'ရိတ် / ဘရိတ် (Break ပေါင်းခြင်း ၁၀ ကွက်)',
    syntaxPattern: '[ဂဏန်း] ရိတ် [ကြေး] သို့မဟုတ် [ဂဏန်း] ဘရိတ် [ကြေး]',
    exampleInput: '၅ ရိတ် ၁၀၀၀ သို့ ၅ ဘရိတ် ၁၀၀၀',
    exampleOutput: '05, 14, 23, 32, 41, 50, 69, 78, 87, 96 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: 'ဂဏန်းတစ်လုံးရိုက်ပြီး "ရိတ်" နှိပ်ပါက ပေါင်းခြင်းဘရိတ် ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည် (ဥပမာ: ၅ -> ၁၀ ကွက်)',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-includes',
    module: '2d',
    name: 'အပါ (Includes ပါဝင်သော ၁၉ ကွက်)',
    syntaxPattern: '[ဂဏန်း] အပါ [ကြေး] သို့မဟုတ် [ဂဏန်း] ပါ [ကြေး]',
    exampleInput: '၅ အပါ ၁၀၀၀ သို့ ၅ ပါ ၁၀၀၀',
    exampleOutput: '05, 15, 25, 35, 45, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 65, 75, 85, 95 (၁၉ ကွက်) ၁၀၀၀ စီ',
    description: 'ဂဏန်းတစ်လုံးရိုက်ပြီး "အပါ" နှိပ်ပါက ထိုဂဏန်းပါဝင်သော ၁၉ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-head',
    module: '2d',
    name: 'ထိပ် / ထိပ်စီး (Head ၁၀ ကွက်)',
    syntaxPattern: '[ဂဏန်း] ထိပ် [ကြေး]',
    exampleInput: '၁ ထိပ် ၁၀၀၀',
    exampleOutput: '10, 11, 12, 13, 14, 15, 16, 17, 18, 19 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: 'ဂဏန်းတစ်လုံးရိုက်ပြီး "ထိပ်" နှိပ်ပါက ထိပ်စီး ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-tail',
    module: '2d',
    name: 'ပိတ် / နောက်ပိတ် (Tail ၁၀ ကွက်)',
    syntaxPattern: '[ဂဏန်း] ပိတ် [ကြေး]',
    exampleInput: '၂ ပိတ် ၁၀၀၀',
    exampleOutput: '02, 12, 22, 32, 42, 52, 62, 72, 82, 92 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: 'ဂဏန်းတစ်လုံးရိုက်ပြီး "ပိတ်" နှိပ်ပါက နောက်ပိတ် ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-doubles',
    module: '2d',
    name: 'ပူး / အပူး (Doubles ၁၀ ကွက်)',
    syntaxPattern: 'ပူး [ကြေး] သို့မဟုတ် အပူး [ကြေး]',
    exampleInput: 'အပူး ၁၀၀၀ သို့ ပူး ၁၀၀၀',
    exampleOutput: '00, 11, 22, 33, 44, 55, 66, 77, 88, 99 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: '"ပူး" နှိပ်လိုက်သည်နှင့် အပူး ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'special_set'
  },
  {
    id: 'rule-2d-power',
    module: '2d',
    name: 'ပါဝါ (Power Pairs ၁၀ ကွက်)',
    syntaxPattern: 'ပါဝါ [ကြေး]',
    exampleInput: 'ပါဝါ ၁၀၀၀',
    exampleOutput: '05, 50, 16, 61, 27, 72, 38, 83, 49, 94 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: '"ပါဝါ" နှိပ်လိုက်သည်နှင့် ပါဝါ ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'special_set'
  },
  {
    id: 'rule-2d-natkhat',
    module: '2d',
    name: 'နက္ခတ် (Natkhat Pairs ၁၀ ကွက်)',
    syntaxPattern: 'နက္ခတ် [ကြေး]',
    exampleInput: 'နက္ခတ် ၁၀၀၀',
    exampleOutput: '07, 70, 18, 81, 24, 42, 35, 53, 69, 96 (၁၀ ကွက်) ၁၀၀၀ စီ',
    description: '"နက္ခတ်" နှိပ်လိုက်သည်နှင့် နက္ခတ် ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'special_set'
  },
  {
    id: 'rule-2d-brothers',
    module: '2d',
    name: 'ညီကို (Brothers / Sequential ၂၀ ကွက်)',
    syntaxPattern: 'ညီကို [ကြေး]',
    exampleInput: 'ညီကို ၁၀၀၀',
    exampleOutput: '01, 10, 12, 21, 23, 32, 34, 43, 45, 54, 56, 65, 67, 76, 78, 87, 89, 98, 90, 09 (၂၀ ကွက်) ၁၀၀၀ စီ',
    description: '"ညီကို" နှိပ်လိုက်သည်နှင့် ညီကို ၂၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'special_set'
  },
  {
    id: 'rule-2d-khway',
    module: '2d',
    name: 'ခွေ (ရိုးရိုးခွေ - အရှေ့မှအနောက်သို့သာတွဲ ၆ ကွက်)',
    syntaxPattern: '[ဂဏန်းများ] ခွေ [ကြေး]',
    exampleInput: '1234 ခွေ 500',
    exampleOutput: '12, 13, 14, 23, 24, 34 (၆ ကွက်) ၅၀၀ စီ',
    description: 'ဂဏန်းရိုက်ပြီး "ခွေ" နှိပ်ပါက ရိုးရိုးခွေ ၆ ကွက် (၂၃၄၅၆ ဆိုပါက ၁၀ ကွက်) ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-khway-puu',
    module: '2d',
    name: 'ခွေပူး (ခွေ + အပူးပါ ၁၀ ကွက်)',
    syntaxPattern: '[ဂဏန်းများ] ခွေပူး [ကြေး]',
    exampleInput: '1234 ခွေပူး 500',
    exampleOutput: '12, 13, 14, 23, 24, 34, 11, 22, 33, 44 (၁၀ ကွက်) ၅၀၀ စီ',
    description: 'ဂဏန်းရိုက်ပြီး "ခွေပူး" နှိပ်ပါက ခွေ ၆ ကွက် + အပူး ၄ ကွက် ပေါင်း ၁၀ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-khway-r',
    module: '2d',
    name: 'ခွေr / ခွေအာ (ခွေအာ လှည့်တွဲ ၁၂ ကွက်)',
    syntaxPattern: '[ဂဏန်းများ] ခွေr [ကြေး] သို့မဟုတ် [ဂဏန်းများ] ခွေအာ [ကြေး]',
    exampleInput: '1234 ခွေr 500 သို့ 1234 ခွေအာ 500',
    exampleOutput: '12, 21, 13, 31, 14, 41, 23, 32, 24, 42, 34, 43 (၁၂ ကွက်) ၅၀၀ စီ',
    description: 'ဂဏန်းရိုက်ပြီး "ခွေr" နှိပ်ပါက အပြန်အလှန်လှည့်တွဲ ၁၂ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-khway-puu-r',
    module: '2d',
    name: 'ခွေပူးr / ခွေပူးအာ (ခွေ + အပူး + အာ အကုန်ပါ ၁၆ ကွက်)',
    syntaxPattern: '[ဂဏန်းများ] ခွေပူးr [ကြေး] သို့မဟုတ် [ဂဏန်းများ] ခွေပူးအာ [ကြေး]',
    exampleInput: '1234 ခွေပူးr 500',
    exampleOutput: 'ခွေအာ ၁၂ ကွက် + အပူး ၄ ကွက် = စုစုပေါင်း ၁၆ ကွက် (၅၀၀ စီ)',
    description: 'ဂဏန်းရိုက်ပြီး "ခွေပူးr" နှိပ်ပါက ခွေအာ ၁၂ ကွက် နှင့် အပူး ၄ ကွက် အကုန်ပါ ၁၆ ကွက် ဂဏန်းကွက်ထဲ တိုက်ရိုက်ပေါ်လာပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'combination'
  },
  {
    id: 'rule-2d-ratio-slash',
    module: '2d',
    name: 'ဒဲ့ နှင့် အာ သီးသန့်ခွဲထိုးခြင်း [၈၀၀/၂၀၀]',
    syntaxPattern: '[ဂဏန်းများ] [ဒဲ့ကြေး]/[အာကြေး]',
    exampleInput: '၂၃ ၄၅ ၂၆ ၈၀၀/၂၀၀',
    exampleOutput: '၂၃=၈၀၀, ၄၅=၈၀၀, ၂၆=၈၀၀ (ဒဲ့) ၊ ၃၂=၂၀၀, ၅၄=၂၀၀, ၆၂=၂၀၀ (အာ)',
    description: 'ရိုက်ထည့်ထားသော ဂဏန်းများကို ပထမထိုးကြေး (၈၀၀) ဖြင့် ဒဲ့ယူပြီး၊ ၎င်းတို့၏ ပြန်လှည့် (အာ) ဂဏန်းများကို ဒုတိယထိုးကြေး (၂၀၀) ဖြင့် သီးခြားခွဲယူပါသည်',
    isCustom: false,
    isEnabled: true,
    category: 'ratio'
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
