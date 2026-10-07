import {
  DrawRound,
  Voucher,
  ForwardSlip,
  AppSettings,
  NumberLimit,
  BlockedNumbers,
  TwoDAppSettings,
  TwoDDrawRound,
  TwoDVoucher,
  TwoDForwardSlip,
  FootballSettings,
  FootballMatch,
  FootballSlip,
  FootballForwardSlip,
  FootballLeague
} from '../types';
import { generateUpToDate2DRounds, generateUpToDate3DRounds } from './thaiLotteryApi';

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'ရွှေမင်္ဂလာ',
  shopName: 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်',
  shopPhone: '09-798889900',
  shopAddress: 'ရန်ကုန်မြို့ / မန္တလေးမြို့',
  currency: 'Ks',
  defaultMultiplier: 600,
  defaultToddMultiplier: 100,
  defaultCommissionRate: 10,
  defaultCustomerDiscount: 0,
  globalStockLimit: 100000, // 100,000 Ks per number default limit
  lowStockAlertPercentage: 80, // alert when 80% reached
  language: 'my',
  soundEffects: true,
  printPaperSize: '80mm',
  voucherFooterMessage: 'ထိုးပြီးဘောင်ချာအား သိမ်းထားပေးပါ။ ပေါက်ဂဏန်းထွက်ပြီး ၃ ရက်အတွင်း ငွေလာရောက်ထုတ်ယူနိုင်ပါသည်။',
  defaultMasterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
  defaultMasterAgentPhone: '09-970001111'
};

export const INITIAL_ROUNDS: DrawRound[] = generateUpToDate3DRounds();

export const INITIAL_LIMITS: NumberLimit = {
  '789': 60000,
  '555': 40000,
  '123': 80000,
  '999': 50000,
  '853': 50000
};

export const INITIAL_BLOCKED: BlockedNumbers = {
  '000': false,
  '777': false
};

export const INITIAL_VOUCHERS: Voucher[] = [
  {
    id: 'vouch-1',
    voucherNo: 'V-3D-1001',
    roundId: 'round-2026-09-01',
    customerName: 'ဦးကျော်စွာ',
    customerPhone: '09-450011223',
    items: [
      { number: '789', amount: 5000, betType: 'straight' },
      { number: '123', amount: 3000, betType: 'straight' },
      { number: '456', amount: 2000, betType: 'straight' }
    ],
    subtotal: 10000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 10000,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    notes: 'ဖုန်းဖြင့် မှာယူသည်',
    isPaid: true,
    status: 'active'
  },
  {
    id: 'vouch-2',
    voucherNo: 'V-3D-1002',
    roundId: 'round-2026-09-01',
    customerName: 'ဒေါ်လှလှဝင်း',
    customerPhone: '09-790112233',
    items: [
      { number: '853', amount: 10000, betType: 'straight' },
      { number: '538', amount: 2000, betType: 'rumble' },
      { number: '358', amount: 2000, betType: 'rumble' },
      { number: '835', amount: 2000, betType: 'rumble' }
    ],
    subtotal: 16000,
    discountPercent: 5,
    discountAmount: 800,
    netPayable: 15200,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    notes: 'ဆိုင်လာထိုးသူ',
    isPaid: true,
    status: 'active'
  },
  {
    id: 'vouch-3',
    voucherNo: 'V-3D-1003',
    roundId: 'round-2026-09-01',
    customerName: 'ကိုအောင်သူ (စက်ရုံ)',
    customerPhone: '09-250334455',
    items: [
      { number: '789', amount: 25000, betType: 'straight' },
      { number: '999', amount: 15000, betType: 'straight' },
      { number: '555', amount: 10000, betType: 'straight' }
    ],
    subtotal: 50000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 50000,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'VIP ဖောက်သည်',
    isPaid: true,
    status: 'active'
  },
  {
    id: 'vouch-4',
    voucherNo: 'V-3D-1004',
    roundId: 'round-2026-09-01',
    customerName: 'မနွယ်နွယ်',
    customerPhone: '09-970556677',
    items: [
      { number: '789', amount: 20000, betType: 'straight' },
      { number: '853', amount: 15000, betType: 'straight' },
      { number: '369', amount: 5000, betType: 'straight' }
    ],
    subtotal: 40000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 40000,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    notes: 'KPay ဖြင့်လွှဲထားသည်',
    isPaid: true,
    status: 'active'
  }
];

export const INITIAL_FORWARD_SLIPS: ForwardSlip[] = [
  {
    id: 'fwd-1',
    slipNo: 'FWD-0901-01',
    roundId: 'round-2026-09-01',
    masterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
    masterAgentPhone: '09-970001111',
    items: [
      { number: '789', amount: 20000 }
    ],
    totalAmount: 20000,
    commissionRate: 12,
    commissionAmount: 2400,
    netPaid: 17600,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    notes: '၇၈၉ အထွက်များ၍ ဘေးကင်းရန် အပေါ်ဖြတ်တင်သည်'
  }
];

// ====================================================
// 2D LOTTERY INITIAL DATA & STORAGE
// ====================================================
export const DEFAULT_2D_SETTINGS: TwoDAppSettings = {
  appName: 'ရွှေမင်္ဂလာ',
  shopName: 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်',
  shopPhone: '09-798889900',
  shopAddress: 'ရန်ကုန်မြို့ / မန္တလေးမြို့',
  currency: 'Ks',
  defaultMultiplier: 85, // 85x for 2D
  defaultCommissionRate: 12,
  defaultCustomerDiscount: 0,
  globalStockLimit: 200000, // 200,000 Ks per 2D number
  lowStockAlertPercentage: 80,
  language: 'my',
  soundEffects: true,
  printPaperSize: '80mm',
  voucherFooterMessage: 'ထိုးပြီးဘောင်ချာအား သေချာသိမ်းထားပေးပါ။ ပေါက်ဂဏန်းထွက်ပြီး ၂၄ နာရီအတွင်း ငွေထုတ်ယူနိုင်ပါသည်။',
  defaultMasterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
  defaultMasterAgentPhone: '09-970001111'
};

export const INITIAL_2D_ROUNDS: TwoDDrawRound[] = generateUpToDate2DRounds();

export const INITIAL_2D_LIMITS: NumberLimit = {
  '82': 100000,
  '55': 80000,
  '99': 80000,
  '24': 150000,
  '42': 150000,
  '00': 100000
};

export const INITIAL_2D_BLOCKED: BlockedNumbers = {
  '11': false,
  '77': false
};

export const INITIAL_2D_VOUCHERS: TwoDVoucher[] = [
  {
    id: 'vouch-2d-1',
    voucherNo: 'V-2D-2001',
    roundId: 'round-2d-2026-09-02-eve',
    customerName: 'ကိုညီညီ',
    customerPhone: '09-781112233',
    items: [
      { number: '24', amount: 10000, betType: 'straight' },
      { number: '42', amount: 10000, betType: 'straight' },
      { number: '55', amount: 5000, betType: 'straight' }
    ],
    subtotal: 25000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 25000,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'ဆိုင်လာထိုးသူ',
    isPaid: true,
    status: 'active'
  },
  {
    id: 'vouch-2d-2',
    voucherNo: 'V-2D-2002',
    roundId: 'round-2d-2026-09-02-eve',
    customerName: 'ဒေါ်အေးသန်း',
    customerPhone: '09-450009988',
    items: [
      { number: '82', amount: 30000, betType: 'straight' },
      { number: '99', amount: 20000, betType: 'straight' }
    ],
    subtotal: 50000,
    discountPercent: 5,
    discountAmount: 2500,
    netPayable: 47500,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    notes: 'KPay ငွေလွှဲ',
    isPaid: true,
    status: 'active'
  }
];

export const INITIAL_2D_FORWARD_SLIPS: TwoDForwardSlip[] = [
  {
    id: 'fwd-2d-1',
    slipNo: 'FWD-2D-0902-01',
    roundId: 'round-2d-2026-09-02-eve',
    masterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
    masterAgentPhone: '09-970001111',
    items: [
      { number: '82', amount: 30000 }
    ],
    totalAmount: 30000,
    commissionRate: 14,
    commissionAmount: 4200,
    netPaid: 25800,
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    notes: '၈၂ အထွက်များ၍ ဒိုင်ကြီးဆီ လွှဲတင်သည်'
  }
];

// ====================================================
// FOOTBALL BETTING INITIAL DATA & STORAGE
// ====================================================
export const DEFAULT_FOOTBALL_SETTINGS: FootballSettings = {
  appName: 'ရွှေမင်္ဂလာ',
  shopName: 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်',
  shopPhone: '09-798889900',
  currency: 'Ks',
  minMaungCount: 2,
  maxMaungCount: 11,
  defaultCommissionRate: 8,
  defaultCustomerDiscount: 0,
  maxPayoutPerTicket: 15000000, // 15 million Ks
  language: 'my',
  soundEffects: true,
  printPaperSize: '80mm',
  slipFooterMessage: 'ဘောလုံးပွဲစဉ် ပြီးဆုံးပြီး တရားဝင်ရလဒ်ထွက်ချိန်တွင် ငွေထုတ်ယူနိုင်ပါသည်။ သရေပွဲများ အဆမဖြတ်ပါက ပုံမှန်အတိုင်း ပြန်ပေါင်းတွက်ပါမည်။',
  defaultMasterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
  defaultMasterAgentPhone: '09-970001111'
};

export const DEFAULT_FOOTBALL_LEAGUES: FootballLeague[] = [
  {
    id: 'league-epl',
    name: 'English Premier League',
    teams: [
      'Arsenal',
      'Chelsea',
      'Liverpool',
      'Man City',
      'Man United',
      'Tottenham',
      'Aston Villa',
      'Newcastle',
      'Brighton',
      'West Ham',
      'Wolves',
      'Everton',
      'Fulham',
      'Crystal Palace',
      'Brentford',
      'Bournemouth',
      'Leicester City',
      'Southampton',
      'Ipswich Town',
      'Nottingham Forest'
    ]
  },
  {
    id: 'league-laliga',
    name: 'Spanish La Liga',
    teams: [
      'Real Madrid',
      'Barcelona',
      'Atletico Madrid',
      'Sevilla',
      'Villarreal',
      'Real Sociedad',
      'Athletic Bilbao',
      'Real Betis',
      'Girona',
      'Valencia',
      'Celta Vigo',
      'Mallorca',
      'Osasuna',
      'Las Palmas',
      'Rayo Vallecano',
      'Getafe',
      'Alaves',
      'Espanyol',
      'Leganes',
      'Valladolid'
    ]
  },
  {
    id: 'league-seriea',
    name: 'Italian Serie A',
    teams: [
      'Inter Milan',
      'AC Milan',
      'Juventus',
      'Napoli',
      'Roma',
      'Lazio',
      'Atalanta',
      'Fiorentina',
      'Torino',
      'Bologna',
      'Monza',
      'Genoa',
      'Udinese',
      'Cagliari',
      'Parma',
      'Verona',
      'Lecce',
      'Empoli',
      'Venezia',
      'Como'
    ]
  },
  {
    id: 'league-bundesliga',
    name: 'German Bundesliga',
    teams: [
      'Bayern Munich',
      'Dortmund',
      'Bayer Leverkusen',
      'RB Leipzig',
      'Stuttgart',
      'Eintracht Frankfurt',
      'Wolfsburg',
      'Freiburg',
      'Hoffenheim',
      'Werder Bremen',
      'Borussia M\'gladbach',
      'Augsburg',
      'Union Berlin',
      'Mainz',
      'Heidenheim',
      'St. Pauli',
      'Holstein Kiel',
      'Bochum'
    ]
  },
  {
    id: 'league-ligue1',
    name: 'French Ligue 1',
    teams: [
      'PSG',
      'Monaco',
      'Marseille',
      'Lille',
      'Lyon',
      'Lens',
      'Nice',
      'Rennes',
      'Reims',
      'Brest',
      'Strasbourg',
      'Toulouse',
      'Montpellier',
      'Nantes',
      'Auxerre',
      'Angers',
      'Saint-Etienne',
      'Le Havre'
    ]
  },
  {
    id: 'league-ucl',
    name: 'UEFA Champions League',
    teams: [
      'Real Madrid',
      'Man City',
      'Bayern Munich',
      'Arsenal',
      'Barcelona',
      'PSG',
      'Inter Milan',
      'Liverpool',
      'Bayer Leverkusen',
      'Atletico Madrid',
      'Dortmund',
      'Juventus',
      'AC Milan',
      'Aston Villa',
      'Sporting CP',
      'Benfica',
      'Celtic',
      'Monaco'
    ]
  },
  {
    id: 'league-mnl',
    name: 'Myanmar National League',
    teams: [
      'Shan United',
      'Yangon United',
      'Hantharwaddy United',
      'Yadanarbon',
      'ISPE FC',
      'Dagon Star United',
      'Mahar United',
      'Rakhine United',
      'Ayeyawady United',
      'Thitsar Arman',
      'Dagon Port',
      'Glory Goal'
    ]
  },
  {
    id: 'league-other',
    name: 'အခြားလိဂ် / နိုင်ငံတကာ (Other & International)',
    teams: [
      'England',
      'France',
      'Spain',
      'Germany',
      'Argentina',
      'Brazil',
      'Portugal',
      'Italy',
      'Netherlands',
      'Japan',
      'South Korea',
      'Myanmar'
    ]
  }
];

export const INITIAL_FOOTBALL_MATCHES: FootballMatch[] = [
  {
    id: 'match-1',
    league: 'English Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    matchDate: '2026-09-03',
    kickoffTime: '21:00',
    handicapTeam: 'home',
    handicapValue: '0.5 (ဝက်နိုင်)',
    overUnderValue: '2.5 (၂ လုံးခွဲ)',
    bodyOdds: 1.90,
    goalOdds: 1.92,
    status: 'upcoming',
    isFeatured: true
  },
  {
    id: 'match-2',
    league: 'English Premier League',
    homeTeam: 'Man City',
    awayTeam: 'Tottenham',
    matchDate: '2026-09-03',
    kickoffTime: '23:30',
    handicapTeam: 'home',
    handicapValue: '1-80 (၁ လုံး ၈၀ စား)',
    overUnderValue: '3.0 (၃ လုံးသရေ)',
    bodyOdds: 1.95,
    goalOdds: 1.88,
    status: 'upcoming',
    isFeatured: true
  },
  {
    id: 'match-3',
    league: 'Spanish La Liga',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    matchDate: '2026-09-04',
    kickoffTime: '01:30',
    handicapTeam: 'home',
    handicapValue: '0-50 (သရေ ၅၀ ရှုံး)',
    overUnderValue: '2.5-3 (၂ လုံးခွဲ ၃ လုံးရှုံး)',
    bodyOdds: 1.90,
    goalOdds: 1.90,
    status: 'upcoming',
    isFeatured: true
  },
  {
    id: 'match-4',
    league: 'English Premier League',
    homeTeam: 'Liverpool',
    awayTeam: 'Aston Villa',
    matchDate: '2026-09-02',
    kickoffTime: '19:30',
    handicapTeam: 'home',
    handicapValue: '0.5-1 (တစ်လုံး ၅၀ စား)',
    overUnderValue: '2.5 (၂ လုံးခွဲ)',
    bodyOdds: 1.92,
    goalOdds: 1.85,
    homeScore: 3,
    awayScore: 1,
    status: 'finished'
  },
  {
    id: 'match-5',
    league: 'German Bundesliga',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Dortmund',
    matchDate: '2026-09-02',
    kickoffTime: '22:00',
    handicapTeam: 'home',
    handicapValue: '1=1.5 (၁ ပြား ၇၀)',
    overUnderValue: '3=3.5 (၃ ပြား ၇၀)',
    bodyOdds: 1.90,
    goalOdds: 1.90,
    homeScore: 3,
    awayScore: 0,
    status: 'finished'
  },
  {
    id: 'match-6',
    league: 'Italian Serie A',
    homeTeam: 'AC Milan',
    awayTeam: 'Inter Milan',
    matchDate: '2026-09-01',
    kickoffTime: '23:15',
    handicapTeam: 'away',
    handicapValue: '0-50 (သရေ ၅၀ ရှုံး)',
    overUnderValue: '2.5 (၂ လုံးခွဲ)',
    bodyOdds: 1.92,
    goalOdds: 1.88,
    homeScore: 1,
    awayScore: 2,
    status: 'finished'
  }
];

export const INITIAL_FOOTBALL_SLIPS: FootballSlip[] = [
  {
    id: 'fb-slip-1',
    slipNo: 'FB-0903-1001',
    roundDate: '2026-09-03',
    customerName: 'ကိုအောင်မိုး',
    customerPhone: '09-450099887',
    slipType: 'maung',
    teamCount: 3,
    stakeAmount: 10000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 10000,
    combinedOdds: 6.85,
    potentialPayout: 68500,
    outcome: 'pending',
    status: 'active',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    notes: '၃ သင်းမောင်း',
    selections: [
      {
        matchId: 'match-1',
        matchSummary: 'Arsenal vs Chelsea',
        league: 'English Premier League',
        betType: 'body_home',
        choiceLabel: 'Arsenal (-0.5)',
        lineDescription: 'အကြော 0.5 (ဝက်နိုင်)',
        odds: 1.90
      },
      {
        matchId: 'match-2',
        matchSummary: 'Man City vs Tottenham',
        league: 'English Premier League',
        betType: 'over',
        choiceLabel: 'Over 3.0 (ဂိုးပေါင်းအပေါ်)',
        lineDescription: 'ဂိုးပေါင်း 3.0',
        odds: 1.88
      },
      {
        matchId: 'match-3',
        matchSummary: 'Real Madrid vs Barcelona',
        league: 'Spanish La Liga',
        betType: 'body_home',
        choiceLabel: 'Real Madrid (-0/50)',
        lineDescription: 'အကြော 0-50',
        odds: 1.90
      }
    ]
  },
  {
    id: 'fb-slip-2',
    slipNo: 'FB-0903-1002',
    roundDate: '2026-09-03',
    customerName: 'ကိုသူရိန်',
    customerPhone: '09-970112233',
    slipType: 'body_single',
    teamCount: 1,
    stakeAmount: 50000,
    discountPercent: 0,
    discountAmount: 0,
    netPayable: 50000,
    combinedOdds: 1.95,
    potentialPayout: 97500,
    outcome: 'pending',
    status: 'active',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    notes: 'ဘော်ဒီသီးသန့် (Single)',
    selections: [
      {
        matchId: 'match-2',
        matchSummary: 'Man City vs Tottenham',
        league: 'English Premier League',
        betType: 'body_home',
        choiceLabel: 'Man City (-1/80)',
        lineDescription: 'အကြော 1-80',
        odds: 1.95
      }
    ]
  }
];

export const INITIAL_FOOTBALL_FORWARD_SLIPS: FootballForwardSlip[] = [
  {
    id: 'fb-fwd-1',
    slipNo: 'FB-FWD-0903-01',
    roundDate: '2026-09-03',
    masterAgentName: 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)',
    masterAgentPhone: '09-970001111',
    slipType: 'body',
    description: 'Man City ဘော်ဒီ ထိုးကြေးကြီးသဖြင့် ဒိုင်ကြီးဆီ လွှဲတင်',
    matchesSummary: 'Man City (-1-80)',
    stakeAmount: 30000,
    commissionRate: 8,
    commissionAmount: 2400,
    netPaid: 27600,
    potentialPayout: 58500,
    status: 'active',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    notes: 'အန္တရာယ်ကင်းစေရန် အပေါ်လွှဲ'
  }
];

// ====================================================
// STORAGE KEYS DEFINITION (STRICTLY SEGREGATED)
// ====================================================
const STORAGE_KEYS = {
  // 3D Storage Keys
  ROUNDS: '3d_ledger_rounds_v1',
  VOUCHERS: '3d_ledger_vouchers_v1',
  LIMITS: '3d_ledger_limits_v1',
  BLOCKED: '3d_ledger_blocked_v1',
  FORWARD_SLIPS: '3d_ledger_forward_slips_v1',
  SETTINGS: '3d_ledger_settings_v1',
  ACTIVE_ROUND_ID: '3d_ledger_active_round_id_v1',

  // Active Dealer Mode ('3d' | '2d' | 'football')
  DEALER_MODE: 'master_bookie_dealer_mode_v1',

  // 2D Storage Keys (Isolated)
  ROUNDS_2D: '2d_ledger_rounds_v1',
  VOUCHERS_2D: '2d_ledger_vouchers_v1',
  LIMITS_2D: '2d_ledger_limits_v1',
  BLOCKED_2D: '2d_ledger_blocked_v1',
  FORWARD_SLIPS_2D: '2d_ledger_forward_slips_v1',
  SETTINGS_2D: '2d_ledger_settings_v1',
  ACTIVE_ROUND_ID_2D: '2d_ledger_active_round_id_v1',

  // Football Storage Keys (Isolated)
  MATCHES_FOOTBALL: 'football_ledger_matches_v1',
  SLIPS_FOOTBALL: 'football_ledger_slips_v1',
  FORWARD_SLIPS_FOOTBALL: 'football_ledger_forward_slips_v1',
  SETTINGS_FOOTBALL: 'football_ledger_settings_v1',
  ACTIVE_DATE_FOOTBALL: 'football_ledger_active_date_v1',
  LEAGUES_FOOTBALL: 'football_ledger_leagues_v1'
};

// Request browser to keep storage persistent (prevents eviction on iOS Safari & Android Chrome)
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

export function loadStoredData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
    // Secondary fallback to safety backup copy if primary was null
    const backupRaw = localStorage.getItem(`${key}_backup`);
    if (backupRaw) {
      return JSON.parse(backupRaw);
    }
    return defaultValue;
  } catch (err) {
    console.error(`Failed to load ${key} from storage, attempting backup recovery:`, err);
    try {
      const backupRaw = localStorage.getItem(`${key}_backup`);
      if (backupRaw) {
        return JSON.parse(backupRaw);
      }
    } catch {
      // ignore
    }
    return defaultValue;
  }
}

export function saveStoredData<T>(key: string, data: T): boolean {
  const previousPrimary = localStorage.getItem(key);
  const previousBackup = localStorage.getItem(`${key}_backup`);

  try {
    const str = JSON.stringify(data);
    localStorage.setItem(key, str);
    localStorage.setItem(`${key}_backup`, str);
    return true;
  } catch (err) {
    console.error(`Failed to save ${key} to storage. Rolling back to previous state:`, err);
    try {
      if (previousPrimary !== null) {
        localStorage.setItem(key, previousPrimary);
      } else {
        localStorage.removeItem(key);
      }
      if (previousBackup !== null) {
        localStorage.setItem(`${key}_backup`, previousBackup);
      } else {
        localStorage.removeItem(`${key}_backup`);
      }
    } catch (rollbackErr) {
      console.error(`Rollback failed for ${key}:`, rollbackErr);
    }
    return false;
  }
}

/**
 * Atomically saves multiple key-value pairs to localStorage.
 * If any single key write fails (e.g. storage limit, browser error),
 * ALL keys are immediately rolled back to their exact previous state (ACID transaction).
 */
export function saveBatchTransactional(updates: Record<string, any>): boolean {
  const snapshots: Record<string, { primary: string | null; backup: string | null }> = {};

  // 1. Take snapshot of all target keys
  for (const key of Object.keys(updates)) {
    snapshots[key] = {
      primary: localStorage.getItem(key),
      backup: localStorage.getItem(`${key}_backup`)
    };
  }

  // 2. Attempt atomic updates
  const writtenKeys: string[] = [];
  try {
    for (const [key, value] of Object.entries(updates)) {
      const str = JSON.stringify(value);
      localStorage.setItem(key, str);
      localStorage.setItem(`${key}_backup`, str);
      writtenKeys.push(key);
    }
    return true;
  } catch (err) {
    console.error('Atomic batch save failed! Reverting all modified storage keys...', err);
    // 3. Rollback all modified keys to exact previous snapshot
    for (const key of writtenKeys) {
      const snap = snapshots[key];
      if (snap) {
        if (snap.primary !== null) localStorage.setItem(key, snap.primary);
        else localStorage.removeItem(key);

        if (snap.backup !== null) localStorage.setItem(`${key}_backup`, snap.backup);
        else localStorage.removeItem(`${key}_backup`);
      }
    }
    return false;
  }
}

export { STORAGE_KEYS };

