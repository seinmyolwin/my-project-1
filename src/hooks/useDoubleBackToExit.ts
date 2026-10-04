import { useEffect, useRef, useState } from 'react';

interface UseDoubleBackToExitProps {
  hasActiveModal: boolean;
  closeActiveModal: () => void;
  isSubTab: boolean;
  goToMainTab: () => void;
}

export function useDoubleBackToExit({
  hasActiveModal,
  closeActiveModal,
  isSubTab,
  goToMainTab
}: UseDoubleBackToExitProps) {
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<any>(null);

  useEffect(() => {
    // Push an initial dummy history state to trap the back button
    window.history.pushState({ page: 'app-root' }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();

      // Case 1: Active modal is open -> Close the modal
      if (hasActiveModal) {
        closeActiveModal();
        window.history.pushState({ page: 'app-root' }, '', window.location.href);
        return;
      }

      // Case 2: In a sub-tab (e.g. Ledger, Winning Payouts, Vouchers) -> Go back to Main Sales/Fixtures tab
      if (isSubTab) {
        goToMainTab();
        window.history.pushState({ page: 'app-root' }, '', window.location.href);
        return;
      }

      // Case 3: On Root Home Tab -> Double Press within 2 seconds to exit
      if (now - lastBackTimeRef.current <= 2000) {
        // Pressed twice within 2 seconds -> Allow exit / back
        setShowExitToast(false);
        // Allow default browser back/exit
      } else {
        // First back press on root home
        lastBackTimeRef.current = now;
        window.history.pushState({ page: 'app-root' }, '', window.location.href);

        setShowExitToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [hasActiveModal, isSubTab, closeActiveModal, goToMainTab]);

  return {
    showExitToast,
    dismissExitToast: () => setShowExitToast(false)
  };
}
