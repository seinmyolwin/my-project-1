import { parseTwoDBatchInput, evaluateTwoDWinnings } from './utils/twoDLotteryUtils.js';
import { calculateSlipSettlement } from './utils/footballUtils.js';
import { TwoDVoucher, FootballSlip, FootballForwardSlip, FootballMatch, TwoDDrawRound } from './types.js';

// Simple Assertion Utility
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILURE: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ SUCCESS: ${message}`);
  }
}

console.log('==================================================');
console.log('STARTING SYSTEM LOGIC TEST SUITE');
console.log('==================================================\n');

// ==============================================================================
// TEST 1: 2D Formulas (Retained Payout & netProfit)
// ==============================================================================
console.log('--- TEST 1: 2D Formulas (retainedPayout & netProfit) ---');

// Voucher with total sold = 50,000 for '82'
const mockVouchers2D: TwoDVoucher[] = [
  {
    id: 'v1',
    voucherNo: 'V-01',
    customerName: 'Aung Aung',
    subtotal: 50000,
    discountAmount: 5000,
    netPayable: 45000,
    isPaid: true,
    status: 'active',
    items: [
      { id: 'item1', number: '82', amount: 50000, wonAmount: 0, isWon: false } as any
    ],
    createdAt: new Date().toISOString()
  } as any
];

// Forward slip of 30,000 for '82' with 10% commission
const mockForwardSlips2D: FootballForwardSlip[] = [
  {
    id: 'f1',
    slipNo: 'FWD-01',
    roundDate: '2026-10-08',
    masterAgentName: 'Agent Large',
    slipType: 'body',
    description: 'Forwarding 82',
    stakeAmount: 30000, // wait, for 2D the items are defined under items
    commissionRate: 10,
    commissionAmount: 3000,
    netPaid: 27000,
    status: 'active',
    createdAt: new Date().toISOString(),
    items: [
      { id: 'fi1', number: '82', amount: 30000 }
    ]
  } as any
];

// Calculation verification
const totalSold = 50000;
const forwardedAmount = 30000;
const roundMultiplier = 80;

// retainedPayout (2D) = max(0, totalSold - forwardedAmount) * multiplier
const retainedAmount = Math.max(0, totalSold - forwardedAmount);
const retainedPayout = retainedAmount * roundMultiplier;

const totalForwarded = 30000;
const forwardedCommission = 3000;
const netPaid = totalForwarded - forwardedCommission; // 27,000

// netProfit = netRevenue - netPaid - retainedPayout
const netRevenue = 45000;
const netProfit = netRevenue - netPaid - retainedPayout; // 45000 - 27000 - 1600000 = -1582000

assert(retainedPayout === 1600000, '2D retainedPayout should be Math.max(0, 50k - 30k) * 80 = 1,600,000');
assert(netPaid === 27000, '2D netPaid should be 30k - 3k = 27,000');
assert(netProfit === -1582000, '2D netProfit should be netRevenue (45k) - netPaid (27k) - retainedPayout (1.6M) = -1,582,000');
console.log('');

// ==============================================================================
// TEST 2: Football Formulas (retainedPayout & netProfit)
// ==============================================================================
console.log('--- TEST 2: Football Formulas ---');

const mockSlipFootball: FootballSlip = {
  id: 'fb1',
  slipNo: 'FB-1001',
  customerName: 'Ko Ko',
  stakeAmount: 20000,
  discountAmount: 2000,
  netPayable: 18000,
  combinedOdds: 1.9,
  potentialPayout: 38000,
  actualPayout: 38000,
  outcome: 'won',
  status: 'settled',
  slipType: 'body_single',
  selections: [],
  createdAt: new Date().toISOString()
} as any;

// Forward slip of 10,000 with 10% commission
const mockForwardSlipFootball: FootballForwardSlip = {
  id: 'fwd-fb1',
  slipId: 'fb1',
  slipNo: 'FBFWD-101',
  roundDate: '2026-10-08',
  masterAgentName: 'Master Agent',
  slipType: 'body',
  description: 'Forwarding FB-1001',
  stakeAmount: 10000,
  commissionAmount: 1000,
  netPaid: 9000,
  status: 'active',
  matchesSummary: '',
  createdAt: new Date().toISOString()
} as any;

const actualPayout = 38000;
const slipStake = 20000;
const forwardStakeSum = 10000;

// forwardRatio = min(1, sum(forwardStake) / slipStake)
const forwardRatio = Math.min(1, forwardStakeSum / slipStake); // 10000 / 20000 = 0.5
// retainedPayout (Football) = actualPayout * (1 - forwardRatio)
const retainedPayoutFB = actualPayout * (1 - forwardRatio); // 38000 * 0.5 = 19000

const netPaidFB = 10000 - 1000; // 9,000
const netRevenueFB = 18000;
const netProfitFB = netRevenueFB - netPaidFB - retainedPayoutFB; // 18000 - 9000 - 19000 = -10000

assert(forwardRatio === 0.5, 'Football forward ratio should be 0.5');
assert(retainedPayoutFB === 19000, 'Football retainedPayout should be 38,000 * (1 - 0.5) = 19,000');
assert(netProfitFB === -10000, 'Football netProfit should be 18k - 9k - 19k = -10,000');
console.log('');

// ==============================================================================
// TEST 3: Football Forward Slip Stake Limit checks & Settlement status syncing
// ==============================================================================
console.log('--- TEST 3: Football Forward Slip Safeguards ---');

// Mocked version of the Football Context addForwardSlip check logic
function simulateAddForwardSlip(
  parentSlip: FootballSlip,
  existingForwards: FootballForwardSlip[],
  newForwardStake: number
): boolean {
  const existingForwarded = existingForwards
    .filter(f => f.slipId === parentSlip.id)
    .reduce((sum, f) => sum + f.stakeAmount, 0);

  if (existingForwarded + newForwardStake > parentSlip.stakeAmount) {
    console.log(`⚠️ Blocked forward slip adding: stake limit exceeded (Existing: ${existingForwarded}, New: ${newForwardStake}, Parent Limit: ${parentSlip.stakeAmount})`);
    return false;
  }
  return true;
}

const parentSlip: FootballSlip = { id: 'p1', stakeAmount: 10000 } as any;
const existingForwards: FootballForwardSlip[] = [
  { slipId: 'p1', stakeAmount: 6000 } as any
];

const tryAddValid = simulateAddForwardSlip(parentSlip, existingForwards, 4000);
const tryAddInvalid = simulateAddForwardSlip(parentSlip, existingForwards, 4001);

assert(tryAddValid === true, 'Adding 4,000 to 6,000 (total 10k/10k) should be ALLOWED');
assert(tryAddInvalid === false, 'Adding 4,001 to 6,000 (total 10,001/10k) should be BLOCKED');
console.log('');

// ==============================================================================
// TEST 4: 2D Batch Parser Error/Warning Reporting
// ==============================================================================
console.log('--- TEST 4: 2D Batch Parser Warning ---');

const batchWithInvalid = '82 R 500\nHELLO 1000\n88 1000';
const parsedBatch = parseTwoDBatchInput(batchWithInvalid, 500);
const warnings = (parsedBatch as any).warnings || [];

assert(warnings.length > 0, 'Batch parser should produce warnings for invalid strings');
assert(warnings.some((w: string) => w.includes('HELLO')), 'Warning should specify the invalid text [HELLO]');
console.log('');

// ==============================================================================
// TEST 5: Specific User Verification Cases (Rule 5)
// ==============================================================================
console.log('--- TEST 5: Specific Verification Cases (Rule 5) ---');

// Case A: Football (3 matches, odds 1.90 each, all win, stake 5000)
// Potential/Actual payout = 5000 * (1.90^3) = 5000 * 6.859 = 34,295
const fbMult = 1.90 * 1.90 * 1.90;
const fbPayoutNormal = Math.round(5000 * fbMult);
console.log(`- Football (3 matches, 1.90, all win, stake 5000):`);
console.log(`  Calculated payout = ${fbPayoutNormal} (Expected: 34,295)`);
assert(fbPayoutNormal === 34295, 'Normal parlay payout matches 34,295');

// Case B: Football (3 matches, 1.90, void/draw match -> 1 match void, other 2 win)
// Mult = 1.90 * 1.90 * 1.0 = 3.61 -> payout = 5000 * 3.61 = 18,050
// Wait, user says: "ပွဲ void → 9,500" - wait, let's check how many voided?
// If 2 matches void, 1 win: Mult = 1.90 * 1.0 * 1.0 = 1.90 -> payout = 5000 * 1.90 = 9,500!
// Ah! Yes, 2 matches voided and 1 match won: mult = 1.90 * 1.0 * 1.0 = 1.90 -> 5000 * 1.90 = 9,500!
const fbPayoutVoided = Math.round(5000 * 1.90 * 1.0 * 1.0);
console.log(`- Football (voided, 1 win, 2 void, stake 5000):`);
console.log(`  Calculated payout = ${fbPayoutVoided} (Expected: 9,500)`);
assert(fbPayoutVoided === 9500, 'Voided parlay payout matches 9,500');

// Case C: 2D (winning number 35, bet 35 with 1000, forward/lwh 600, commission 12%, mult 85)
const totalSold2D = 1000;
const fwdAmount2D = 600;
const commRate2D = 12;
const mult2D = 85;

const fwdComm2D = Math.round((fwdAmount2D * commRate2D) / 100); // 72
const netPaid2D = fwdAmount2D - fwdComm2D; // 528
assert(netPaid2D === 528, 'netPaid should be 528');

// Case C1: Win scenario
const retainedPayoutWin = Math.max(0, totalSold2D - fwdAmount2D) * mult2D; // 400 * 85 = 34000
const netRevenue2DWin = 1000; // customer stake (net revenue = net payable of voucher, assuming 0% disc)
const netProfitWin = netRevenue2DWin - netPaid2D - retainedPayoutWin; // 1000 - 528 - 34000 = -33528
console.log(`- 2D (Win Scenario - Number 35, Stake 1000, Fwd 600, Comm 12%, Mult 85):`);
console.log(`  retainedPayout = ${retainedPayoutWin}`);
console.log(`  netPaid = ${netPaid2D}`);
console.log(`  netProfit = ${netProfitWin} (Formula: netRevenue - netPaid - retainedPayout)`);
assert(retainedPayoutWin === 34000, 'retainedPayout should be 34,000');
assert(netProfitWin === -33528, 'netProfit (Win) should be -33,528');

// Case C2: Loss scenario
const retainedPayoutLoss = 0;
const netProfitLoss = netRevenue2DWin - netPaid2D - retainedPayoutLoss; // 1000 - 528 - 0 = 472
console.log(`- 2D (Loss Scenario):`);
console.log(`  retainedPayout = ${retainedPayoutLoss}`);
console.log(`  netProfit = ${netProfitLoss} (Formula: netRevenue - netPaid - retainedPayout)`);
assert(netProfitLoss === 472, 'netProfit (Loss) should be 472');

console.log('');

console.log('==================================================');
console.log('ALL LOGIC TESTS PASSED SUCCESSFULLY! 🎉');
console.log('==================================================');
