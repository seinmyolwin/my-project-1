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
    // Clone target element
    const clone = element.cloneNode(true) as HTMLElement;

    // Expand any scrollable max-height containers in the clone for single-page printing
    const scrollContainers = clone.querySelectorAll('[class*="overflow-y-auto"], [class*="max-h-"]');
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
    wrapper.className = 'print-wrapper';
    wrapper.appendChild(clone);
    printMount.appendChild(wrapper);

    // Inject dynamic print page style for A6 size
    let styleEl = document.getElementById('dynamic-print-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-style';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @page {
        size: A6 portrait;
        margin: 2mm;
      }
      @media print {
        body.print-mode-active > :not(#print-mount) {
          display: none !important;
        }
        body.print-mode-active #print-mount {
          display: block !important;
          width: 100% !important;
          max-width: 105mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        body {
          background: #ffffff !important;
          color: #0f172a !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-wrapper {
          width: 100% !important;
          max-width: 100mm !important;
          margin: 0 auto !important;
          padding: 1mm !important;
          box-sizing: border-box !important;
        }
        /* Ensure the printable content itself fits exactly inside A6 */
        #printable-voucher {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        #printable-voucher * {
          visibility: visible !important;
        }
        #printable-voucher [class*="overflow-y-auto"],
        #printable-voucher [class*="max-h-"] {
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;

    const originalTitle = document.title;
    document.title = title;
    document.body.classList.add('print-mode-active');

    // Call print
    window.focus();
    window.print();

    // Setup cleanup
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
    // Fallback cleanup
    setTimeout(cleanup, 2000);

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
