/**
 * Blocks pinch-zoom so the app behaves like a native app in the gym.
 * The viewport meta handles most browsers, but iOS Safari ignores
 * `user-scalable=no`, so its proprietary gesture events and multi-touch
 * scale moves are cancelled too. Trackpad pinch on desktop arrives as
 * ctrl+wheel. Inputs use 16px text, so focusing never auto-zooms.
 */
export function installZoomLock() {
  const prevent = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('gestureend', prevent, { passive: false });
  document.addEventListener(
    'touchmove',
    (e) => {
      const scale = (e as TouchEvent & { scale?: number }).scale;
      if (e.touches.length > 1 || (scale !== undefined && scale !== 1)) e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
