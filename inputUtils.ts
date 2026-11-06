/**
 * Utilities for high-productivity input handling on Mobile/Tablet/Desktop:
 * 1. Auto-select full value on tap / click / focus (Touchscreen and Pointer friendly)
 * 2. Standard props for opening numeric keyboard on phones/tablets
 */

import React from 'react';

export const handleAutoSelect = (
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement> | React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>
) => {
  const target = e.currentTarget;
  if (target && typeof target.select === 'function') {
    target.select();
    // Mobile WebKit / Safari touch gesture often resets selection right after focus, so delayed select guarantees highlight:
    setTimeout(() => {
      try {
        target.select();
        if (typeof target.setSelectionRange === 'function') {
          target.setSelectionRange(0, target.value.length);
        }
      } catch (_) {
        // Ignore if element is not selectable type
      }
    }, 25);
  }
};

/**
 * Standard props to spread onto any numeric or PIN input to ensure:
 * - Mobile/Tablet virtual keyboard opens 0-9 numeric pad immediately
 * - Tapping immediately auto-selects existing text for fast replacement
 */
export const numericInputProps = {
  inputMode: 'numeric' as const,
  pattern: '[0-9]*',
  onFocus: handleAutoSelect,
  onClick: handleAutoSelect,
};
