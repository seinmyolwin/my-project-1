export const SETTLEMENT_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

export interface SettlementEditStatus {
  isSettledOrReopened: boolean;
  anchorTimestamp?: string;
  withinWindow: boolean;
  expired: boolean;
  remainingMs: number;
  remainingFormatted: string;
}

export function formatRemainingEditTimeMy(remainingMs: number): string {
  if (remainingMs <= 0) return '၀ မိနစ်';
  const totalMinutes = Math.floor(remainingMs / 60000);
  if (totalMinutes < 1) return '၁ မိနစ်အောက်';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours} နာရီ ${minutes} မိနစ်`;
  }
  if (hours > 0) {
    return `${hours} နာရီ`;
  }
  return `${minutes} မိနစ်`;
}

export function getSettlementEditStatus(
  round: {
    status?: string;
    settledAt?: string;
    firstSettledAt?: string;
    reopenedForEdit?: boolean;
  } | undefined | null,
  nowMs: number = Date.now()
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

  if (!isSettledOrReopened) {
    return {
      isSettledOrReopened: false,
      anchorTimestamp,
      withinWindow: true,
      expired: false,
      remainingMs: SETTLEMENT_EDIT_WINDOW_MS,
      remainingFormatted: formatRemainingEditTimeMy(SETTLEMENT_EDIT_WINDOW_MS)
    };
  }

  if (!anchorTimestamp) {
    return {
      isSettledOrReopened: true,
      anchorTimestamp: undefined,
      withinWindow: false,
      expired: true,
      remainingMs: 0,
      remainingFormatted: '၀ မိနစ်'
    };
  }

  const anchorMs = new Date(anchorTimestamp).getTime();
  if (!Number.isFinite(anchorMs)) {
    return {
      isSettledOrReopened: true,
      anchorTimestamp,
      withinWindow: false,
      expired: true,
      remainingMs: 0,
      remainingFormatted: '၀ မိနစ်'
    };
  }

  const elapsedMs = Math.max(0, nowMs - anchorMs);
  const remainingMs = Math.max(0, SETTLEMENT_EDIT_WINDOW_MS - elapsedMs);
  const withinWindow = remainingMs > 0;

  return {
    isSettledOrReopened: true,
    anchorTimestamp,
    withinWindow,
    expired: !withinWindow,
    remainingMs,
    remainingFormatted: formatRemainingEditTimeMy(remainingMs)
  };
}
