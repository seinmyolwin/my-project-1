import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Hide when already running as an installed standalone app
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop direct native install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>App သွင်းမည်</span>
      </button>
    );
  }

  // iOS Safari: invoke native Share sheet directly (no instruction modal)
  if (isIOS && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const handleIOSShare = () => {
      navigator
        .share({
          title: 'ရွှေမင်္ဂလာ',
          url: window.location.href
        })
        .catch(() => {});
    };

    return (
      <button
        type="button"
        onClick={handleIOSShare}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>App သွင်းမည်</span>
      </button>
    );
  }

  return null;
};
