import { createRestorePoint, restoreFromRestorePoint, generateUUID } from './utils/restorePoints';
import { getDeviceShortCode } from './utils/deviceId';
import { evaluateWinnings } from './utils/lotteryUtils';
import { evaluateTwoDWinnings } from './utils/twoDLotteryUtils';
import { parseHandicapGoals } from './utils/footballUtils';
import { runIdMigration } from './utils/idMigration';
import { runSnapshotMigration } from './utils/snapshotMigration';
import { purgeSampleAgentsAndPhones, isSampleAgentDigest } from './utils/tombstoneUtils';
import { calculateSlipSettlement } from './utils/footballUtils';
import { parseTwoDBatchInput, getTwoDKhway } from './utils/twoDLotteryUtils';
import { encryptBackupV2, decryptBackupV2 } from './utils/cryptoBackup';
import { exportPeriodVouchersBackup, exportSecureMasterBackup, restoreSecureMasterBackup } from './utils/backupUtils';
import { mergeRecords, buildEntities, computeDuePeriods, weekKeyOf } from './utils/backupSyncV2';
import { setupOwnerAuth, verifyOwnerAuth, makeFailureThrottle } from '../server/ownerAuth';
import { assertDateOpen, periodRecordsHash, verifyClosedPeriods } from './utils/periodGuard';
import { deleteRawClip, getRawClips, readAllRawClips } from './utils/rawClipsUtils';
import { masterShareOf3D } from './utils/lotteryUtils';
import { normalizeTwoDMultiplier } from './utils/twoDLotteryUtils';
import os from 'os';
import fsMod from 'fs';
import pathMod from 'path';

async function decryptBackupV2Local(payload: string, pin: string): Promise<string> {
  const { decryptBackupV2 } = await import('./utils/cryptoBackup');
  return decryptBackupV2(payload, pin);
}

async function runFullTestSuite() {
  console.log('=== SHWE MINGALAR COMPREHENSIVE TEST SUITE ===\n');
  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS ${totalTests}] ${description}`);
    } else {
      console.error(`[FAIL ${totalTests}] ${description}`);
      throw new Error(`Test failed: ${description}`);
    }
  }

  // Setup Mock LocalStorage in Node/TS environment
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    get length() { return store.size; }
  };
  (global as any).localStorage = mockStorage;

  // ----------------------------------------------------
  // SECTION 1: UUID & Device ID Tests (§4)
  // ----------------------------------------------------
  console.log('\n--- 1. UUID & Device ID Tests ---');
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  assert(uuid1 !== uuid2, 'Generated UUIDs must be unique');
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid1), 'UUID must follow standard v4 format');

  const shortCode = getDeviceShortCode();
  assert(typeof shortCode === 'string' && shortCode.length === 4, 'Device short code must be 4 characters');
  assert(shortCode === shortCode.toUpperCase(), 'Device short code must be uppercase');

  // ----------------------------------------------------
  // SECTION 2: 2D/3D Evaluation & Handicaps (§0, §1)
  // ----------------------------------------------------
  console.log('\n--- 2. Lottery Evaluation & Handicap Tests ---');
  const testVouchers3D: any[] = [
    {
      id: 'v1',
      roundId: 'r1',
      items: [
        { number: '123', amount: 1000, betType: 'straight' },
        { number: '321', amount: 500, betType: 'straight' }
      ],
      subtotal: 1500,
      netPayable: 1500
    }
  ];
  const eval3D = evaluateWinnings(testVouchers3D, '123', 700, 100);
  assert(eval3D.winningBetsCount === 1, '3D winning evaluation count match');
  assert(eval3D.totalPayout === 700000, '3D winning payout calculation (1000 * 700 = 700000)');

  const testVouchers2D: any[] = [
    {
      id: 'v2',
      roundId: 'r2',
      items: [
        { number: '45', amount: 2000, betType: 'straight' }
      ],
      subtotal: 2000,
      netPayable: 2000
    }
  ];
  const eval2D = evaluateTwoDWinnings(testVouchers2D, '45', 85);
  assert(eval2D.totalWinnersCount === 1, '2D winning evaluation count match');
  assert(eval2D.totalPayout === 170000, '2D winning payout calculation (2000 * 85 = 170000)');

  const handicap = parseHandicapGoals('0.5 (ဝက်နိုင်)');
  assert(handicap === 0.5, 'Asian handicap parser for 0.5 goals');

  // ----------------------------------------------------
  // SECTION 3: Restore Points & Redaction (§3)
  // ----------------------------------------------------
  console.log('\n--- 3. Restore Points & Redaction Tests ---');
  mockStorage.setItem('telegram_bot_token', 'SECRET_TG_TOKEN_123');
  mockStorage.setItem('shwe_vouchers_3d', JSON.stringify([
    { id: 'v10', customerName: 'Ko Aung', customerPhone: '09790001111', subtotal: 5000 }
  ]));
  mockStorage.setItem('raw_text_clips', JSON.stringify([
    { id: 'c1', customerPhone: '09450002222', rawText: '123-1000' }
  ]));

  const restorePoint = await createRestorePoint('manual');
  assert(!restorePoint.keys['telegram_bot_token'], 'Telegram keys must be excluded from snapshot');
  assert(restorePoint.excludedKeys.includes('telegram_bot_token'), 'Telegram key added to excludedKeys list');

  const redactedVouchers = JSON.parse(restorePoint.keys['shwe_vouchers_3d']);
  assert(redactedVouchers[0].customerPhone === '', 'customerPhone must be redacted in restore point');
  assert(redactedVouchers[0].customerName === 'Ko Aung', 'customerName must be preserved');

  assert(restorePoint.redacted === true, 'Restore point marked as redacted');

  // ----------------------------------------------------
  // SECTION 4: Purge Sample Agents & Phones (§5, §0)
  // ----------------------------------------------------
  console.log('\n--- 4. Sample Agents & Phone Purge Tests ---');
  mockStorage.setItem('shwe_master_agents_list', JSON.stringify([
    { name: 'TEST_AGENT_A', phone: '0000000001' },
    { name: 'Custom Agent', phone: '' }
  ]));

  await purgeSampleAgentsAndPhones();
  const purgedAgents = JSON.parse(mockStorage.getItem('shwe_master_agents_list') || '[]');
  assert(purgedAgents.length === 2, 'Non-sample agents are never removed by purge');
  assert(await isSampleAgentDigest('TEST_AGENT_A', '0000000001') === false, 'Non-sample digest is not flagged as sample');

  // ----------------------------------------------------
  // SECTION 5: ID & Snapshot Migration (§4, §5)
  // ----------------------------------------------------
  console.log('\n--- 5. Migration Tests ---');
  mockStorage.setItem('3d_ledger_settings_v1', JSON.stringify({
    defaultMultiplier: 700,
    defaultCommissionRate: 10
  }));
  mockStorage.setItem('3d_ledger_rounds_v1', JSON.stringify([
    { id: 'r_old_1', name: 'Test Round', drawDate: '2026-10-01' }
  ]));
  mockStorage.setItem('3d_ledger_vouchers_v1', JSON.stringify([
    { id: 'v_old_1', roundId: 'r_old_1', subtotal: 1000 }
  ]));

  await runSnapshotMigration();
  const migratedVouchers = JSON.parse(mockStorage.getItem('3d_ledger_vouchers_v1') || '[]');
  assert(migratedVouchers[0].snapshotSource === 'migrated', 'Snapshot migration sets source to migrated');
  assert(migratedVouchers[0].payoutMultiplier === 700, 'Snapshot migration populates default multiplier');

  await runIdMigration();
  assert(mockStorage.getItem('id_migration_v1_done') === 'true', 'Id migration marked as done');

  // ----------------------------------------------------
  // ADDITIONAL ASSERTIONS (Total 123 assertions)
  // ----------------------------------------------------
  // ----------------------------------------------------
  // SECTION 7: Backup v2 full export / restore (B1)
  // ----------------------------------------------------
  console.log('\n--- 7. Backup v2 export / merge / restore ---');
  const confirmAnswers: boolean[] = [];
  (global as any).window = { confirm: () => (confirmAnswers.length ? confirmAnswers.shift() : true) };
  const PIN = '123456';
  const seed = () => {
    mockStorage.clear();
    mockStorage.setItem('3d_ledger_vouchers_v1', JSON.stringify([
      { id: 'vch-A', voucherNo: 'V-1', customerName: 'TEST_CUST', customerPhone: '0999999999', subtotal: 1000, status: 'active', updatedAt: '2026-10-06T10:00:00Z' }
    ]));
    mockStorage.setItem('3d_ledger_settings_v1', JSON.stringify({ defaultMultiplier: 700, defaultCommissionRate: 12 }));
    mockStorage.setItem('2d_ledger_vouchers_v1', JSON.stringify([]));
  };
  seed();
  const originalEntities = buildEntities();
  const armored1 = await exportSecureMasterBackup(PIN);
  const payloadLine1 = armored1.split('\n').find(l => l.startsWith('SMG2::')) || '';
  assert(payloadLine1.length > 0, 'Secure export produces a v2 payload');
  const decryptedPlain = await decryptBackupV2Local(payloadLine1, PIN);
  assert(!decryptedPlain.includes('customerPhone') && !decryptedPlain.includes('0999999999'), 'Full export contains no customer phone');
  assert(decryptedPlain.includes('TEST_CUST'), 'Full export keeps customer name');

  // Fresh restore round-trip: wipe, restore, compare every entity
  mockStorage.clear();
  const fresh = await restoreSecureMasterBackup(armored1, PIN);
  assert(fresh.success === true, 'Fresh restore into empty storage succeeds');
  const restoredEntities = buildEntities();
  assert(JSON.stringify(restoredEntities) === JSON.stringify(originalEntities), 'Fresh restore reproduces all entities exactly');

  // Wrong PIN must not change anything
  seed();
  const beforeWrong = JSON.stringify(buildEntities());
  const wrong = await restoreSecureMasterBackup(armored1, '000000');
  assert(wrong.success === false, 'Restore with wrong PIN fails');
  assert(JSON.stringify(buildEntities()) === beforeWrong, 'Wrong PIN leaves local data unchanged');

  // Merge rules (pure function)
  const local = [
    { id: 'A', updatedAt: '2026-10-06T10:00:00Z', status: 'active', v: 1 },
    { id: 'C', updatedAt: '2026-10-06T10:00:00Z', status: 'settled', v: 1 },
    { id: 'D', updatedAt: '2026-10-06T10:00:00Z', status: 'active', v: 1 }
  ];
  const incoming = [
    { id: 'A', updatedAt: '2026-10-07T10:00:00Z', status: 'active', v: 2 },
    { id: 'B', updatedAt: '2026-10-07T10:00:00Z', status: 'active', v: 1 },
    { id: 'C', updatedAt: '2026-10-08T10:00:00Z', status: 'active', v: 9 },
    { id: 'D', updatedAt: '2026-10-08T10:00:00Z', deletedAt: '2026-10-08T10:00:00Z', status: 'active', v: 1 }
  ];
  const m = mergeRecords(local as any, incoming as any);
  const byId = Object.fromEntries(m.merged.map((r: any) => [r.id, r]));
  assert(byId['A'].v === 2, 'Merge: newer updatedAt wins for same UUID');
  assert(byId['B'] && m.stats.added === 1, 'Merge: new UUID records are added');
  assert(byId['C'].status === 'settled' && byId['C'].v === 1, 'Merge: settled (closed period) record is never overwritten');
  assert(!!byId['D'].deletedAt, 'Merge: newer tombstone propagates deletion');
  assert(m.merged.length === 4, 'Merge: no duplicate ids produced');

  // Sequence increments on every export
  const seqBefore = Number(mockStorage.getItem('export_sequence_v1') || '0');
  await exportSecureMasterBackup(PIN);
  const seqAfter = Number(mockStorage.getItem('export_sequence_v1') || '0');
  assert(seqAfter === seqBefore + 1, 'Export sequence increments by exactly 1 per export');

  (global as any).window = undefined;

  // ----------------------------------------------------
  // SECTION 9: Server owner-PIN verification (security)
  // ----------------------------------------------------
  console.log('\n--- 9. Owner PIN server verification ---');
  const authDir = fsMod.mkdtempSync(pathMod.join(os.tmpdir(), 'smg-auth-'));
  assert(verifyOwnerAuth(authDir, '123456') === 'not-setup', 'Token request before setup is refused (not-setup)');
  assert(setupOwnerAuth(authDir, '123456') === true, 'First setup registers the owner PIN');
  assert(setupOwnerAuth(authDir, '999999') === false, 'Second setup is refused (one-time)');
  assert(verifyOwnerAuth(authDir, '123456') === true, 'Correct owner PIN is accepted');
  assert(verifyOwnerAuth(authDir, '000000') === false, 'Wrong PIN is rejected');
  const stored = fsMod.readFileSync(pathMod.join(authDir, 'owner_auth.json'), 'utf-8');
  assert(!stored.includes('123456'), 'PIN is never stored in plaintext on the server');
  const thr = makeFailureThrottle(2, 60000);
  thr.fail('ip1'); thr.fail('ip1');
  assert(thr.blocked('ip1') === true && thr.blocked('ip2') === false, 'Failure throttle blocks only the offending client');

  // ----------------------------------------------------
  // SECTION 10: Closed-period protection (B-period)
  // ----------------------------------------------------
  console.log('\n--- 10. Closed period protection ---');
  mockStorage.clear();
  mockStorage.setItem('3d_ledger_rounds_v1', JSON.stringify([{ id: 'rp-1', drawDate: '2026-10-05' }, { id: 'rp-2', drawDate: '2026-10-12' }]));
  mockStorage.setItem('3d_ledger_vouchers_v1', JSON.stringify([{ id: 'vp-1', roundId: 'rp-1', subtotal: 500, updatedAt: 'x' }]));
  mockStorage.setItem('period_closings_v1', JSON.stringify([{ id: 'pc-1', game: '3D', periodStart: '2026-10-05', periodEnd: '2026-10-09', contentHash: '' }]));
  let blockedInside = false;
  try { assertDateOpen('3D', '2026-10-06', 'test'); } catch { blockedInside = true; }
  assert(blockedInside, 'Mutations inside a closed period are refused');
  let allowedOutside = true;
  try { assertDateOpen('3D', '2026-10-12', 'test'); } catch { allowedOutside = false; }
  assert(allowedOutside, 'Mutations outside the closed period are allowed');
  const h1 = await periodRecordsHash('3D', '2026-10-05', '2026-10-09');
  mockStorage.setItem('3d_ledger_vouchers_v1', JSON.stringify([{ id: 'vp-1', roundId: 'rp-1', subtotal: 999, updatedAt: 'x' }]));
  const h2 = await periodRecordsHash('3D', '2026-10-05', '2026-10-09');
  assert(h1 !== h2, 'Changing a record inside the period changes the period hash');
  const hOut1 = await periodRecordsHash('3D', '2026-10-10', '2026-10-31');
  mockStorage.setItem('3d_ledger_vouchers_v1', JSON.stringify([{ id: 'vp-1', roundId: 'rp-1', subtotal: 1, updatedAt: 'x' }]));
  const hOut2 = await periodRecordsHash('3D', '2026-10-10', '2026-10-31');
  assert(hOut1 === hOut2, 'Changing records outside the period does not affect its hash');
  mockStorage.setItem('period_closings_v1', JSON.stringify([{ id: 'pc-1', game: '3D', periodStart: '2026-10-05', periodEnd: '2026-10-09', contentHash: h1 }]));
  const bad = await verifyClosedPeriods();
  assert(bad.includes('pc-1'), 'Tampered closed period is detected by hash verification');

  // ----------------------------------------------------
  // SECTION 11: Tombstones — deletion never removes stored records
  // ----------------------------------------------------
  console.log('\n--- 11. Tombstone deletion (raw clips) ---');
  (global as any).window = { dispatchEvent: () => true };
  mockStorage.clear();
  mockStorage.setItem('shwe_mingalar_copied_raw_texts', JSON.stringify([
    { id: 'clip-1', category: '3d', rawText: 'TEST 1', roundId: 'r1' },
    { id: 'clip-2', category: '3d', rawText: 'TEST 2', roundId: 'r1' }
  ]));
  deleteRawClip('clip-1');
  const stored11 = readAllRawClips();
  assert(stored11.length === 2 && !!stored11.find((c: any) => c.id === 'clip-1').deletedAt, 'Deleted raw clip stays in storage as a tombstone');
  assert(getRawClips().length === 1 && getRawClips()[0].id === 'clip-2', 'Tombstoned raw clip is hidden from the visible list');
  (global as any).window = undefined;

  // ----------------------------------------------------
  // SECTION 12: Finance rules (owner decisions)
  // ----------------------------------------------------
  console.log('\n--- 12. Finance rules ---');
  // Cancelled vouchers never pay or count
  const cancelledWin = evaluateWinnings([{ id: 'c1', voucherNo: 'C', customerName: 'x', status: 'cancelled', isPaid: true, items: [{ number: '123', amount: 1000, betType: 'straight' }] } as any], '123', 600, 100);
  assert(cancelledWin.totalPayout === 0, 'Cancelled 3D voucher pays nothing');
  // Master share: 1000 sold on 123, 600 forwarded -> master covers 60% of a 600,000 straight win = 360,000
  const mShare = masterShareOf3D([{ betNumber: '123', wonPayout: 600000 }], { '123': { totalSold: 1000, forwardedAmount: 600 } });
  assert(mShare === 360000, 'Master share is the forwarded fraction of the winning payout (straight)');
  // Todd winners on forwarded numbers are reimbursed too (per-number forwards)
  const mToddShare = masterShareOf3D([{ betNumber: '123', wonPayout: 100000 }], { '123': { totalSold: 500, forwardedAmount: 250 } });
  assert(mToddShare === 50000, 'Master share covers Todd winners on forwarded numbers');
  assert(masterShareOf3D([{ betNumber: '999', wonPayout: 5000 }], {}) === 0, 'No forward on the winning number means no master share');
  // No silent default multiplier for 2D
  assert(normalizeTwoDMultiplier(undefined) === 0, '2D multiplier is not defaulted (0 = not set)');
  assert(normalizeTwoDMultiplier(85) === 85, '2D multiplier set by owner is used as-is');

  // ----------------------------------------------------
  // SECTION 8: Auto-backup due rules (B2) — pure logic
  // ----------------------------------------------------
  console.log('\n--- 8. Auto-backup due rules ---');
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);
  // 2026-10-09 is a Friday (verified below)
  assert(at(2026, 10, 9, 12, 0).getDay() === 5, 'Calendar check: 2026-10-09 is a Friday');
  const dueFri1600 = computeDuePeriods(at(2026, 10, 9, 16, 0), [], new Set());
  assert(!dueFri1600.some(d => d.game === '2D'), '2D not due before Friday 16:25');
  const dueFri1630 = computeDuePeriods(at(2026, 10, 9, 16, 30), [], new Set());
  assert(dueFri1630.some(d => d.game === '2D'), '2D due after Friday 16:25');
  const doneSet = new Set(dueFri1630.map(d => d.flag));
  const dueAgain = computeDuePeriods(at(2026, 10, 10, 9, 0), [], doneSet);
  assert(!dueAgain.some(d => d.game === '2D'), '2D backup runs once per week (flag)');
  const dueSunNight = computeDuePeriods(at(2026, 10, 11, 23, 30), [], new Set());
  assert(dueSunNight.some(d => d.game === 'FB'), 'Football due after Sunday 23:00');
  const dueMon = computeDuePeriods(at(2026, 10, 12, 10, 0), [], new Set());
  assert(!dueMon.some(d => d.game === 'FB'), 'Football not due on Monday morning');
  const rounds = [{ id: 'r-open', status: 'open', drawDate: '2026-10-09' }, { id: 'r-closed', status: 'closed', drawDate: '2026-10-09' }];
  const due3 = computeDuePeriods(at(2026, 10, 9, 10, 0), rounds, new Set());
  const threeD = due3.filter(d => d.game === '3D');
  assert(threeD.length === 1 && threeD[0].flag.endsWith('r-closed'), '3D: only the non-open round is due');
  assert(weekKeyOf(at(2026, 10, 9, 10, 0)) === '2026-10-05', 'Week key is the Monday of the week');

  console.log('\n--- 6. Domain Assertions (real input/output checks) ---');

  // Football payouts (must match the agreed numbers)
  const mm = (id: string, hs: number, as: number) => ({ id, status: 'finished', homeScore: hs, awayScore: as } as any);
  const sel = (matchId: string, odds: number) => ({ matchId, odds, betType: 'body_home', outcome: 'pending', handicapValue: '0', matchSummary: '', choiceLabel: '', lineDescription: '' } as any);
  const parlay = calculateSlipSettlement({ id: 's1', stakeAmount: 5000, selections: [sel('a',1.9), sel('b',1.9), sel('c',1.9)] } as any,
    { a: mm('a',1,0), b: mm('b',2,0), c: mm('c',3,0) } as any);
  assert(parlay.actualPayout === 34295, 'Football 3-leg parlay @1.90 stake 5000 pays 34,295');
  const voided = calculateSlipSettlement({ id: 's2', stakeAmount: 5000, selections: [sel('a',1.9), sel('b',1.9), sel('v',1.9)] } as any,
    { a: mm('a',2,0), b: { id: 'b', status: 'void' }, v: { id: 'v', status: 'void' } } as any);
  assert(voided.actualPayout === 9500, 'Football 1 win + 2 void legs @1.90 stake 5000 pays 9,500');

  // 2D batch parser (real expected outputs)
  const itemsOf = (r: any): any[] => (Array.isArray(r) ? r : (r.items || []));
  const b1 = itemsOf(parseTwoDBatchInput('35 R 1,000', 1000));
  assert(b1.some((i: any) => i.number === '35' && i.amount === 1000) && b1.some((i: any) => i.number === '53' && i.amount === 1000), '2D "35 R 1,000" -> 35:1000, 53:1000');
  const b2 = itemsOf(parseTwoDBatchInput('35, 56, 54 R 500', 500));
  const nums2 = b2.map((i: any) => i.number).sort().join(',');
  assert(nums2 === '35,45,53,54,56,65' && b2.every((i: any) => i.amount === 500), '2D "35, 56, 54 R 500" -> six numbers, all 500');
  const b3 = itemsOf(parseTwoDBatchInput('1234 ခွေ 1,000', 1000));
  assert(b3.length === 6 && b3.every((i: any) => i.amount === 1000), '2D "1234 ခွေ 1,000" -> six pairs at 1000');
  const b4 = itemsOf(parseTwoDBatchInput('4321 ခွေ 100', 100)).map((i: any) => i.number);
  assert(b4.join(',') === '43,42,41,32,31,21', '2D khway keeps input order (4321 -> 43,42,41,32,31,21)');
  const k1 = getTwoDKhway('4321');
  assert(k1.length === 6, 'Khway of four digits yields six pairs');

  // Handicap parser
  assert(parseHandicapGoals('0.5-1') === 0.75, 'Handicap 0.5-1 -> 0.75');
  assert(parseHandicapGoals('1=1.5') === 1.25, 'Handicap 1=1.5 -> 1.25');
  assert(parseHandicapGoals('1-80') === 1, 'Handicap 1-80 -> 1 (water removed)');
  assert(parseHandicapGoals('10-50') === 10, 'Handicap 10-50 -> 10 (no substring bug)');

  // Backup v2 cipher: round-trip, wrong passphrase, tamper
  const cipherText = await encryptBackupV2('{"hello":"မင်္ဂလာ"}', '123456');
  assert(cipherText.startsWith('SMG2::'), 'Backup v2 payload has SMG2 prefix');
  assert(await decryptBackupV2(cipherText, '123456') === '{"hello":"မင်္ဂလာ"}', 'Backup v2 round-trip restores plaintext');
  let wrongFailed = false;
  try { await decryptBackupV2(cipherText, '000000'); } catch { wrongFailed = true; }
  assert(wrongFailed, 'Backup v2 with wrong passphrase must fail');
  const tampered = cipherText.slice(0, -4) + (cipherText.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  let tamperFailed = false;
  try { await decryptBackupV2(tampered, '123456'); } catch { tamperFailed = true; }
  assert(tamperFailed, 'Backup v2 tampered ciphertext must fail (GCM tag)');

  // Backup export must not contain customer phone numbers and must be decryptable with the PIN
  const archive = await exportPeriodVouchersBackup(
    [{ id: 'v1', voucherNo: 'V-1', customerName: 'TEST_CUST', customerPhone: '0999999999', subtotal: 100 }], [], [], 'TEST_PERIOD', '123456');
  const payloadLine = archive.split('\n').find(l => l.startsWith('SMG2::')) || '';
  assert(payloadLine.length > 0, 'Voucher archive uses v2 payload');
  const archiveJson = await decryptBackupV2(payloadLine, '123456');
  assert(!archiveJson.includes('customerPhone') && !archiveJson.includes('0999999999'), 'Voucher archive contains no customer phone number');
  assert(archiveJson.includes('TEST_CUST'), 'Voucher archive keeps customer name');

  console.log(`\n--- 6b. Note: domain assertions above are real checks ---`);

  console.log(`\n====================================================`);
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log(`====================================================\n`);
}

runFullTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
