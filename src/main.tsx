import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { initPWA } from './lib/pwa';
import { installAudioUnlock } from './lib/sound';
import { installZoomLock } from './lib/zoomLock';

installAudioUnlock();
installZoomLock();
initPWA();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
