import { useRef, useCallback, TouchEvent } from 'react';

export interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

export interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum horizontal distance in px, default 45
  maxVerticalRatio?: number; // Max ratio of vertical movement to horizontal movement, default 0.75
  disabled?: boolean;
}

/**
 * Custom hook for smooth mobile swipe gestures between tabs.
 * Allows switching tabs by swiping left or right on touchscreen/mobile devices
 * while safely ignoring vertical scrolling, text inputs, and sliders.
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 45,
  maxVerticalRatio = 0.75,
  disabled = false
}: UseSwipeGestureOptions): SwipeHandlers {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        // Don't trigger if interacting with form controls or sliders
        const tagName = target.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable ||
          target.closest('[data-no-swipe="true"]') ||
          target.closest('input[type="range"]')
        ) {
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }

        // Avoid triggering if inside a dedicated horizontally scrollable container
        const scrollableX = target.closest('.overflow-x-auto, [data-scrollable="x"]');
        if (scrollableX) {
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }
      }

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    },
    [disabled]
  );

  const onTouchMove = useCallback((e: TouchEvent) => {
    // Normal touchmove without blocking vertical scroll
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled || touchStartX.current === null || touchStartY.current === null) return;
      if (e.changedTouches.length === 0) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - touchStartX.current;
      const diffY = endY - touchStartY.current;
      const duration = Date.now() - touchStartTime.current;

      touchStartX.current = null;
      touchStartY.current = null;

      // Ignore if gesture took too long (over 800ms)
      if (duration > 800) return;

      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);

      if (absX >= threshold && absY / absX <= maxVerticalRatio) {
        if (diffX < 0) {
          // Swiped Left -> go to Next Tab
          onSwipeLeft?.();
        } else {
          // Swiped Right -> go to Previous Tab
          onSwipeRight?.();
        }
      }
    },
    [disabled, threshold, maxVerticalRatio, onSwipeLeft, onSwipeRight]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}
