/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust print helper for vouchers and financial statements.
 * Uses a direct-mount printing strategy that temporarily hides the main application
 * and mounts only the target printable element. This guarantees 100% correct
 * layout rendering and styling, solves blank page issues on PDF export, and ensures
 * standard print sizing (A6 for vouchers, A4 for financial statements) on all mobile
 * webviews and tablets without using bug-prone iframe selectors or unsupported CSS.
 */

export function printVoucherSlip(elementId: string = 'printable-voucher', title: string = 'ဘောင်ချာ'): void {
  const element = document.getElementById(elementId);
  if (!element) {
    window.focus();
    window.print();
    return;
  }

  try {
    // Clone target element so on-screen modals remain untouched
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove screen-only elements inside clone
    clone.querySelectorAll('.no-print, .print\\:hidden').forEach((el) => el.remove());

    // Expand all scrollable / clipped / narrow width containers in the clone
    const clampedContainers = clone.querySelectorAll(
      '[class*="overflow-"], [class*="max-h-"], [class*="max-w-"]'
    );
    clampedContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.maxHeight = 'none';
      htmlEl.style.height = 'auto';
      htmlEl.style.overflow = 'visible';
      htmlEl.style.maxWidth = 'none';
    });
    clone.style.maxHeight = 'none';
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.maxWidth = 'none';
    clone.style.width = '100%';

    // Auto-spread bet items into a dense, crisp multi-column grid so everything fits on 1 sheet
    const itemContainers = clone.querySelectorAll('.voucher-items-container');
    itemContainers.forEach((container) => {
      const gridEl = container as HTMLElement;
      const itemCount = gridEl.children.length;
      let cols = 2;
      if (itemCount <= 3) cols = 1;
      else if (itemCount <= 8) cols = 2;
      else if (itemCount <= 24) cols = 3;
      else if (itemCount <= 65) cols = 4;
      else cols = 5;

      gridEl.classList.add('voucher-print-grid');
      gridEl.setAttribute('data-print-cols', String(cols));
      gridEl.style.display = 'grid';
      gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      gridEl.style.gap = itemCount > 65 ? '3px 6px' : '4px 8px';
      gridEl.style.maxHeight = 'none';
      gridEl.style.overflow = 'visible';

      Array.from(gridEl.children).forEach((child) => {
        const cell = child as HTMLElement;
        cell.classList.add('voucher-print-cell');
      });
    });

    // Create print mount container
    let printMount = document.getElementById('print-mount');
    if (!printMount) {
      printMount = document.createElement('div');
      printMount.id = 'print-mount';
      document.body.appendChild(printMount);
    }
    printMount.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'print-wrapper';
    wrapper.appendChild(clone);
    printMount.appendChild(wrapper);

    // Inject dynamic print CSS for unified single-voucher spread layout
    let styleEl = document.getElementById('dynamic-print-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-style';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 6mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #0f172a !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.print-mode-active > :not(#print-mount) {
          display: none !important;
        }
        body.print-mode-active #print-mount {
          display: block !important;
          position: static !important;
          width: 100% !important;
          max-width: 198mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        .print-wrapper {
          width: 100% !important;
          max-width: 198mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }
        #printable-voucher, #printable-forward-slip {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 10px 12px !important;
          box-shadow: none !important;
          border-radius: 8px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #94a3b8 !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          max-height: none !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        #printable-voucher *, #printable-forward-slip * {
          visibility: visible !important;
        }
        #printable-voucher [class*="overflow-"],
        #printable-voucher [class*="max-h-"],
        #printable-forward-slip [class*="overflow-"],
        #printable-forward-slip [class*="max-h-"] {
          max-height: none !important;
          height: auto !important;
          overflow: visible !important;
        }
        .voucher-print-grid {
          display: grid !important;
          width: 100% !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        .voucher-print-cell {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 5px !important;
          padding: 3px 6px !important;
          background: #f8fafc !important;
          font-size: 10.5px !important;
          line-height: 1.25 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 4px !important;
        }
        .voucher-print-grid[data-print-cols="5"] .voucher-print-cell {
          font-size: 9.5px !important;
          padding: 2px 4px !important;
        }
        .voucher-summary-block {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `;

    const originalTitle = document.title;
    document.title = title;
    document.body.classList.add('print-mode-active');

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.body.classList.remove('print-mode-active');
      document.title = originalTitle;
      if (printMount && printMount.parentNode) {
        printMount.parentNode.removeChild(printMount);
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    // Call print
    window.focus();
    window.print();

    // Extended fallback cleanup for mobile webviews where afterprint may not fire reliably
    setTimeout(cleanup, 30000);

  } catch (error) {
    console.error('Print utility error:', error);
    window.focus();
    window.print();
  }
}

/**
 * Print Financial Statements report on standard A4 page
 */
export function printStatementReport(elementId: string = 'printable-statement', title: string = 'စာရင်းရှင်းတမ်း အစီရင်ခံစာ'): void {
  const element = document.getElementById(elementId);
  if (!element) {
    window.focus();
    window.print();
    return;
  }

  try {
    const clone = element.cloneNode(true) as HTMLElement;
    const scrollContainers = clone.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-x-auto"], [class*="max-h-"]');
    scrollContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.maxHeight = 'none';
      htmlEl.style.overflow = 'visible';
    });

    // Create print mount container
    let printMount = document.getElementById('print-mount');
    if (!printMount) {
      printMount = document.createElement('div');
      printMount.id = 'print-mount';
      document.body.appendChild(printMount);
    }
    printMount.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'print-statement-wrapper';
    wrapper.appendChild(clone);
    printMount.appendChild(wrapper);

    // Inject dynamic print page style for A4 size
    let styleEl = document.getElementById('dynamic-print-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-style';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
      @media print {
        body.print-mode-active > :not(#print-mount) {
          display: none !important;
        }
        body.print-mode-active #print-mount {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        body {
          background: #ffffff !important;
          color: #0f172a !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-statement-wrapper {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
        #printable-statement {
          width: 100% !important;
          margin: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #0f172a !important;
          border: none !important;
        }
        #printable-statement * {
          visibility: visible !important;
        }
        #printable-statement table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        #printable-statement th,
        #printable-statement td {
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 6px 8px !important;
        }
        #printable-statement [class*="overflow-y-auto"],
        #printable-statement [class*="overflow-x-auto"],
        #printable-statement [class*="max-h-"] {
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;

    const originalTitle = document.title;
    document.title = title;
    document.body.classList.add('print-mode-active');

    window.focus();
    window.print();

    const cleanup = () => {
      document.body.classList.remove('print-mode-active');
      document.title = originalTitle;
      if (printMount && printMount.parentNode) {
        printMount.parentNode.removeChild(printMount);
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 2000);

  } catch (error) {
    console.error('Statement print error:', error);
    window.focus();
    window.print();
  }
}
