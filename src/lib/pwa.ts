import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';
import { toast } from '../store/toast';
import { isIOS } from './utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  canInstall: boolean;
  offlineReady: boolean;
  standalone: boolean;
  /** iOS Safari has no install prompt — show manual instructions instead. */
  iosInstallable: boolean;
}

const standalone =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const usePWA = create<PWAState>()(() => ({
  canInstall: false,
  offlineReady: false,
  standalone,
  iosInstallable: isIOS && !standalone,
}));

let deferred: BeforeInstallPromptEvent | null = null;

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    usePWA.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePWA.setState({ canInstall: false, standalone: true });
    toast.success('Forge installed', 'Launch it from your home screen.');
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Never auto-reload: an in-progress workout should not be interrupted.
      toast.action(
        'Update available',
        { label: 'Reload now', onClick: () => void updateSW(true) },
        'Your workout is saved and will survive the reload.',
      );
    },
    onOfflineReady() {
      usePWA.setState({ offlineReady: true });
    },
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePWA.setState({ canInstall: false });
  return outcome === 'accepted';
}
