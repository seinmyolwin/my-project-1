export const SETTLEMENT_EDIT_WINDOW_MS = Number.MAX_SAFE_INTEGER;

export interface SettlementEditStatus {
  isSettledOrReopened: boolean;
  anchorTimestamp?: string;
  withinWindow: boolean;
  expired: boolean;
  remainingMs: number;
  remainingFormatted: string;
}

export function formatRemainingEditTimeMy(_remainingMs: number): string {
  return 'ကာလမပိတ်သေးသမျှ';
}

export function getSettlementEditStatus(
  round: {
    status?: string;
    settledAt?: string;
    firstSettledAt?: string;
    reopenedForEdit?: boolean;
  } | undefined | null,
  _nowMs: number = Date.now()
): SettlementEditStatus {
  if (!round) {
    return {
      isSettledOrReopened: false,
      withinWindow: false,
      expired: false,
      remainingMs: 0,
      remainingFormatted: ''
    };
  }

  const isSettledOrReopened = round.status === 'settled' || !!round.reopenedForEdit;
  const anchorTimestamp = round.firstSettledAt || round.settledAt;

  return {
    isSettledOrReopened,
    anchorTimestamp,
    withinWindow: true,
    expired: false,
    remainingMs: SETTLEMENT_EDIT_WINDOW_MS,
    remainingFormatted: 'ကာလမပိတ်သေးသမျှ'
  };
}
