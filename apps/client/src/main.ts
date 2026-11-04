import { AppFlow } from './app/AppFlow.js';
import { showGallery } from './render/Gallery.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #game canvas');
if (import.meta.env.DEV && new URLSearchParams(location.search).has('gallery')) {
  showGallery(canvas); // S9 dev-only art gallery
} else {
  const app = new AppFlow(canvas);
  const dispose = (): void => { app.dispose(); window.removeEventListener('pagehide', dispose); };
  window.addEventListener('pagehide', dispose);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}
