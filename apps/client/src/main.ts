import { AppFlow } from './app/AppFlow.js';
import { showGallery } from './render/Gallery.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #game canvas');
if (import.meta.env.DEV && new URLSearchParams(location.search).has('gallery')) {
  showGallery(canvas); // S9 dev-only art gallery
} else {
  const app = new AppFlow(canvas);
  // iOS Safari ignores user-scalable=no: block pinch (gesture events, 2+ touches) and the long-press menu; CSS touch-action handles double-tap.
  const stop = (e: Event): void => { e.preventDefault(); };
  const multi = (e: TouchEvent): void => { if (e.touches.length > 1) e.preventDefault(); };
  const gestures = ['gesturestart', 'gesturechange', 'gestureend'] as const;
  for (const g of gestures) document.addEventListener(g, stop);
  document.addEventListener('contextmenu', stop);
  document.addEventListener('touchstart', multi, { passive: false });
  document.addEventListener('touchmove', multi, { passive: false });
  const dispose = (): void => {
    app.dispose();
    window.removeEventListener('pagehide', dispose);
    for (const g of gestures) document.removeEventListener(g, stop);
    document.removeEventListener('contextmenu', stop);
    document.removeEventListener('touchstart', multi);
    document.removeEventListener('touchmove', multi);
  };
  window.addEventListener('pagehide', dispose);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}

// S14 PWA: offline shell for the installed iPad app (production builds only; dev never registers a worker).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* offline shell is optional */ });
}
