import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './utils/restorePoints.ts';
import { startAutoBackupTimer } from './utils/backupSyncV2';
import { exportSecureMasterBackup } from './utils/backupUtils';
import { getStoredOwnerPin } from './utils/securityUtils';

// Auto-backup at period close (logic only; no UI)
startAutoBackupTimer(() => getStoredOwnerPin(), (pin) => exportSecureMasterBackup(pin));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
