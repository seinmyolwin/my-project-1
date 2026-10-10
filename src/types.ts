export type BetType = 'straight' | 'rumble'; // 'straight' (တည့်) or 'rumble' (ပတ်လည် / R)

export interface BetItem {
  id: string;
  number: string; // 3 digits, e.g. "123"
  amount: number; // in MMK / Currency
  isRumble?: boolean; // If input as R (permutation)
  originalInput?: string; // e.g. "123 R"
  betType?: BetType; // 'straight' or 'rumble'
  groupId?: string; // unique group ID for this rumble group
  originalNumber?: string; // e.g. "123"
  originalAmount?: number; // e.g. 1000
  permutations?: string[]; // e.g. ['123', '132', '213', '231', '312', '321']
}

export interface VoucherItem {
  number: string;
  amount: number;
  betType: BetType;
  groupId?: string; // unique group ID for rumble group
  originalNumber?: string; // e.g. "123"
  originalAmount?: number; // e.g. 1000
  permutations?: string[]; // e.g. ['123', '132', '213', '231', '312', '321']
  isWon?: boolean;
  wonAmount?: number;
}

export interface Voucher {
  id: string;
  voucherNo: string; // e.g. "V-3D-1001"
  roundId: string;
  customerName: string;
  customerPhone?: string;
  items: VoucherItem[];
  subtotal: number;
  discountPercent: number; // e.g. 10% dealer discount to customer
  discountAmount: number;
  netPayable: number;
  createdAt: string;
  notes?: string;
  isPaid: boolean;
  status: 'active' | 'cancelled' | 'settled';
}

export interface ForwardSlipItem {
  number: string;
  amount: number;
}

export interface ForwardSlip {
  id: string;
  slipNo: string;
  roundId: string;
  masterAgentName: string; // e.g. "Ko Aung (Main Bookie)"
  masterAgentPhone?: string;
  items: ForwardSlipItem[];
  totalAmount: number;
  commissionRate: number; // e.g. 12% received from bookmaker
  commissionAmount: number;
  netPaid: number;
  createdAt: string;
  notes?: string;
}

export interface DrawRound {
  id: string;
  name: string; // e.g., "16-Sep-2026 (Thai 3D)"
  drawDate: string; // "2026-09-16"
  closingTime: string; // "15:00"
  status: 'open' | 'closed' | 'settled';
  winningNumber?: string; // e.g. "789"
  toddNumbers?: string[]; // permutations e.g. ["798", "879", "897", "978", "987"]
  multiplier: number; // default 500 or 600 or 700 (e.g. 1000 ks bet wins 500,000 ks at 500x)
  toddMultiplier: number; // default 100 or 120 (e.g. 1000 ks bet wins 100,000 ks at 100x)
  commissionRate: number; // e.g. 10%
  settledAt?: string;
}

export interface NumberLimit {
  [number: string]: number; // number -> max total amount allowed, e.g. "123": 50000
}

export interface BlockedNumbers {
  [number: string]: boolean; // completely closed numbers
}

export interface ThreeDQuickActionButtonsConfig {
  straight: boolean;
  rumble: boolean;
  triples: boolean;
  brothers: boolean;
  power: boolean;
  natkhat: boolean;
}

export interface AppSettings {
  appName: string; // Customizable App Name e.g. "ရွှေမင်္ဂလာ"
  shopName: string;
  shopPhone: string;
  shopAddress?: string;
  currency: string; // "MMK", "Ks", "THB", "USD"
  defaultMultiplier: number; // 600
  defaultToddMultiplier: number; // 100
  defaultCommissionRate: number; // 10%
  defaultCustomerDiscount: number; // 0%
  globalStockLimit: number; // e.g. 100,000 Ks per number default limit
  lowStockAlertPercentage: number; // e.g. 80% (trigger notification when 80% of limit is sold)
  language: 'my' | 'en'; // Myanmar or English
  soundEffects: boolean;
  printPaperSize: '58mm' | '80mm' | 'A4';
  voucherFooterMessage: string;
  defaultMasterAgentName?: string;
  defaultMasterAgentPhone?: string;
  quickActionButtons?: ThreeDQuickActionButtonsConfig;
}

export type OverLimitAction = 'forward_excess' | 'forward_all' | 'accept_locally' | 'cap_at_limit' | 'reject';

export interface OverLimitItemInfo {
  id: string;
  number: string;
  originalAmount: number;
  isRumble?: boolean;
  existingSold: number;
  limit: number;
  remainingQuota: number;
  excessAmount: number;
  action: OverLimitAction;
}

export interface NumberAggregate {
  number: string;
  totalSold: number;
  forwardedAmount: number;
  retainedAmount: number; // totalSold - forwardedAmount
  limit: number;
  isBlocked: boolean;
  betCount: number;
  estimatedPayout: number; // retainedAmount * multiplier
  netRisk: number; // estimatedPayout - totalRoundRevenue
  riskLevel: 'safe' | 'warning' | 'danger'; // safe (<50%), warning (50-80%), danger (>80%)
  toddEstimatedPayout?: number;
}

export interface RoundSummary {
  totalSales: number;
  totalVouchers: number;
  totalDiscount: number;
  netRevenue: number;
  totalForwarded: number;
  forwardedCommission: number;
  totalPayout: number;
  retainedPayout?: number;
  netPaid?: number;
  winningNumber?: string;
  totalWinnersCount: number;
  netProfit: number;
  isProfit: boolean;
}

export interface LowStockAlert {
  id: string;
  number: string;
  soldAmount: number;
  limit: number;
  percentage: number;
  timestamp: string;
  type: 'near_limit' | 'limit_reached' | 'blocked';
}

// ----------------------------------------------------
// 2D (ဇီးကွက် - နှစ်လုံး စာရင်း) TYPES
// ----------------------------------------------------
export interface TwoDDrawRound {
  id: string;
  name: string; // e.g., "02-Sep-2026 (12:01 PM မနက်ပိုင်း)" or "02-Sep-2026 (04:30 PM ညနေပိုင်း)"
  drawDate: string; // "2026-09-02"
  session: 'morning' | 'evening' | 'special'; // 12:01 PM or 04:30 PM
  closingTime: string; // "12:00" or "16:25"
  status: 'open' | 'closed' | 'settled';
  winningNumber?: string; // 2 digits: "00" - "99"
  multiplier: number; // default 80 (e.g. 1000 ks wins 80,000 ks)
  commissionRate: number; // e.g. 12%
  settledAt?: string;
}

export interface TwoDBetItem {
  id: string;
  number: string; // 2 digits: "00" - "99"
  amount: number;
  isRumble?: boolean;
  originalInput?: string; // e.g. "24 R" or "အပူး"
  betType?: BetType; // 'straight' or 'rumble'
  groupId?: string; // unique group ID for this rumble group
  originalNumber?: string; // e.g. "24"
  originalAmount?: number; // e.g. 500
  permutations?: string[]; // e.g. ['24', '42']
}

export interface TwoDVoucherItem {
  number: string;
  amount: number;
  betType: BetType;
  groupId?: string; // unique group ID for rumble group
  originalNumber?: string; // e.g. "24"
  originalAmount?: number; // e.g. 500
  permutations?: string[]; // e.g. ['24', '42']
  isRumble?: boolean;
  isWon?: boolean;
  wonAmount?: number;
}

export interface TwoDVoucher {
  id: string;
  voucherNo: string; // e.g. "V-2D-1001"
  roundId: string;
  customerName: string;
  customerPhone?: string;
  items: TwoDVoucherItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  createdAt: string;
  notes?: string;
  isPaid: boolean;
  status: 'active' | 'cancelled' | 'settled';
}

export interface TwoDForwardSlip {
  id: string;
  slipNo: string;
  roundId: string;
  masterAgentName: string;
  masterAgentPhone?: string;
  items: ForwardSlipItem[];
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netPaid: number;
  createdAt: string;
  notes?: string;
}

export interface TwoDQuickActionButtonsConfig {
  straight: boolean;    // ဒဲ့ (တိုက်ရိုက်ထိုးကြေး)
  rumble: boolean;      // ပတ်လည် (အာ / R)
  break: boolean;       // ရိတ် (ဘရိတ် ၁၀ ကွက်)
  includes: boolean;    // အပါ (အပါ ၁၉ ကွက်)
  head: boolean;        // ထိပ် (ထိပ်စီး ၁၀ ကွက်)
  tail: boolean;        // ပိတ် (နောက်ပိတ် ၁၀ ကွက်)
  doubles: boolean;     // ပူး (အပူး ၁၀ ကွက်)
  power: boolean;       // ပါဝါ (ပါဝါ ၁၀ ကွက်)
  natkhat: boolean;     // နက္ခတ် (နက္ခတ် ၁၀ ကွက်)
  brothers: boolean;    // ညီကို (ညီကို ၂၀ ကွက်)
  khway: boolean;       // ခွေ (ရိုးရိုးခွေ)
  khwayPuu: boolean;    // ခွေပူး (ခွေ + အပူး)
  khwayRumble: boolean; // ခွေr (ခွေအာ လှည့်တွဲ)
  khwayPuuRumble: boolean; // ခွေပူးr (ခွေပူးအာ)
}

export interface TwoDAppSettings {
  appName: string;
  shopName: string;
  shopPhone: string;
  shopAddress?: string;
  currency: string;
  defaultMultiplier: number; // 85x
  defaultCommissionRate: number; // 12%
  defaultCustomerDiscount: number; // 0%
  globalStockLimit: number; // e.g. 150,000 Ks per 2D number
  lowStockAlertPercentage: number; // 80%
  language: 'my' | 'en';
  soundEffects: boolean;
  printPaperSize: '58mm' | '80mm' | 'A4';
  voucherFooterMessage: string;
  defaultMasterAgentName?: string;
  defaultMasterAgentPhone?: string;
  quickActionButtons?: TwoDQuickActionButtonsConfig;
}

export interface TwoDNumberAggregate {
  number: string;
  totalSold: number;
  forwardedAmount: number;
  retainedAmount: number;
  limit: number;
  isBlocked: boolean;
  betCount: number;
  estimatedPayout: number;
  netRisk: number;
  riskLevel: 'safe' | 'warning' | 'danger';
}

export interface TwoDRoundSummary {
  totalSales: number;
  totalVouchers: number;
  totalDiscount: number;
  netRevenue: number;
  totalForwarded: number;
  forwardedCommission: number;
  totalPayout: number;
  retainedPayout?: number;
  winningNumber?: string;
  totalWinnersCount: number;
  netProfit: number;
  isProfit: boolean;
}

// ----------------------------------------------------
// FOOTBALL (ပစ်တိုင်းထောင် - အားကစား စာရင်း) TYPES
// ----------------------------------------------------
export type FootballBetType = 'body_home' | 'body_away' | 'over' | 'under';
export type FootballSlipType = 'body_single' | 'maung';
export type MatchResultStatus = 'upcoming' | 'live' | 'finished' | 'postponed' | 'void';
export type SelectionOutcome = 'pending' | 'win' | 'half_win' | 'draw' | 'half_loss' | 'loss' | 'void';

export interface FootballLeague {
  id: string;
  name: string;
  teams: string[];
}

export interface FootballMatch {
  id: string;
  league: string; // e.g. "English Premier League", "UEFA Champions League"
  homeTeam: string;
  awayTeam: string;
  matchDate: string; // "2026-09-03"
  kickoffTime: string; // "21:00"
  handicapTeam: 'home' | 'away' | 'level'; // Which team gives handicap
  handicapValue: string; // e.g. "0.5 (ဝက်)", "0-50 (သရေ ၅၀ ရှုံး)", "1-80 (၁ လုံး ၈၀ စား)", "1=1.5 (၁ ပြား ၇၀)", "0=0 (တူတူ)"
  overUnderValue: string; // e.g. "2.5 (၂ လုံးခွဲ)", "2.5-3 (၂ လုံးခွဲ ၃ လုံးရှုံး)", "3=3.5 (၃ ပြား ၇၀)"
  bodyOdds: number; // Decimal odds e.g. 1.90
  goalOdds: number; // Decimal odds e.g. 1.90
  homeScore?: number;
  awayScore?: number;
  status: MatchResultStatus;
  isFeatured?: boolean;
}

export interface FootballBetSelection {
  matchId: string;
  matchSummary: string; // "Arsenal vs Chelsea"
  league: string;
  betType: FootballBetType; // 'body_home' | 'body_away' | 'over' | 'under'
  choiceLabel: string; // "Arsenal (-0.5)" or "Over 2.5"
  lineDescription: string; // "အကြော 0.5 (ဝက်)"
  odds: number; // e.g. 1.90
  homeScore?: number;
  awayScore?: number;
  outcome?: SelectionOutcome;
}

export interface FootballSlip {
  id: string;
  slipNo: string; // e.g. "FB-0902-1001"
  roundDate: string; // "2026-09-02"
  customerName: string;
  customerPhone?: string;
  slipType: FootballSlipType; // 'body_single' or 'maung'
  selections: FootballBetSelection[];
  teamCount: number; // 1 for single, 2..11 for maung
  stakeAmount: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  combinedOdds: number; // e.g. 1.90 * 1.90 * 1.90 = 6.85
  potentialPayout: number;
  actualPayout?: number;
  outcome?: 'pending' | 'won' | 'half_won' | 'draw' | 'half_lost' | 'lost';
  status: 'active' | 'settled' | 'cancelled';
  createdAt: string;
  notes?: string;
}

export interface FootballForwardSlip {
  id: string;
  slipId?: string;
  slipNo: string;
  roundDate: string;
  masterAgentName: string;
  masterAgentPhone?: string;
  slipType: 'body' | 'maung';
  description: string;
  matchesSummary: string;
  stakeAmount: number;
  commissionRate: number; // e.g. 8%
  commissionAmount: number;
  netPaid: number;
  potentialPayout: number;
  actualPayout?: number;
  status: 'active' | 'settled';
  createdAt: string;
  notes?: string;
}

export interface FootballSettings {
  appName: string;
  shopName: string;
  shopPhone: string;
  currency: string;
  minMaungCount: number; // default 2
  maxMaungCount: number; // default 11
  defaultCommissionRate: number; // 10%
  defaultCustomerDiscount: number; // 0%
  maxPayoutPerTicket: number; // e.g. 10,000,000 Ks
  language: 'my' | 'en';
  soundEffects: boolean;
  printPaperSize: '58mm' | '80mm' | 'A4';
  slipFooterMessage: string;
  defaultMasterAgentName?: string;
  defaultMasterAgentPhone?: string;
}

export interface FootballSummary {
  totalStake: number;
  totalTickets: number;
  totalBodyStake: number;
  totalMaungStake: number;
  totalDiscount: number;
  netRevenue: number;
  totalForwarded: number;
  forwardedCommission: number;
  totalPayout: number;
  retainedPayout?: number;
  netProfit: number;
  isProfit: boolean;
  wonTicketsCount: number;
  lostTicketsCount: number;
  pendingTicketsCount: number;
}

// Master Bookie Mode
export type BookieMode = '3d' | '2d' | 'football';

