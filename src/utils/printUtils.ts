/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust print helper for vouchers and financial statements.
 * Uses an isolated print iframe copying all page stylesheets to guarantee
 * that PDF export / printing never produces a blank page and fits on a single sheet.
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

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.focus();
      window.print();
      return;
    }

    // Collect all stylesheets from main window
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((tag) => tag.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="my">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          ${styleTags}
          <style>
            @page {
              size: A6 portrait;
              margin: 3mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'JetBrains Mono', 'Noto Sans Myanmar', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif !important;
              font-size: 11px !important;
              line-height: 1.3 !important;
              overflow: visible !important;
            }
            .print-wrapper {
              width: 98mm !important;
              max-width: 98mm !important;
              margin: 0 auto !important;
              padding: 3mm 4mm !important;
              background: #ffffff !important;
              border: 1.5px solid #0f172a !important;
              border-radius: 4px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              box-sizing: border-box !important;
            }
            .print-wrapper * {
              visibility: visible !important;
            }
            .print-wrapper [class*="overflow-y-auto"],
            .print-wrapper [class*="max-h-"] {
              max-height: none !important;
              overflow: visible !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${clone.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Small delay for styles and fonts to render inside iframe
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print', err);
        window.focus();
        window.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 2000);
      }
    }, 300);
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

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.focus();
      window.print();
      return;
    }

    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((tag) => tag.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="my">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'JetBrains Mono', 'Noto Sans Myanmar', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              font-size: 11px !important;
            }
            .statement-print-wrapper {
              width: 100% !important;
              margin: 0 auto !important;
              padding: 2mm !important;
            }
            .statement-print-wrapper * {
              visibility: visible !important;
            }
            .statement-print-wrapper table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            .statement-print-wrapper th,
            .statement-print-wrapper td {
              border-bottom: 1px solid #e2e8f0 !important;
              padding: 6px 8px !important;
            }
            .statement-print-wrapper [class*="overflow-y-auto"],
            .statement-print-wrapper [class*="overflow-x-auto"],
            .statement-print-wrapper [class*="max-h-"] {
              max-height: none !important;
              overflow: visible !important;
            }
          </style>
        </head>
        <body>
          <div class="statement-print-wrapper">
            ${clone.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.focus();
        window.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 2000);
      }
    }, 300);
  } catch (error) {
    console.error('Statement print error:', error);
    window.focus();
    window.print();
  }
}
