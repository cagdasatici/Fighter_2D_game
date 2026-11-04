import { AppFlow } from './app/AppFlow.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #game canvas');
const app = new AppFlow(canvas);
const dispose = (): void => { app.dispose(); window.removeEventListener('pagehide', dispose); };
window.addEventListener('pagehide', dispose);
if (import.meta.hot) import.meta.hot.dispose(dispose);
