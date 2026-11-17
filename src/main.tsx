import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import './utils/restorePoints.ts';

declare global {
  interface Window {
    __deferredPWAInstallPrompt?: (Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    }) | null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredPWAInstallPrompt = e as Window['__deferredPWAInstallPrompt'];
    window.dispatchEvent(new Event('pwa-prompt-ready'));
  });
  window.addEventListener('appinstalled', () => {
    window.__deferredPWAInstallPrompt = null;
  });
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
