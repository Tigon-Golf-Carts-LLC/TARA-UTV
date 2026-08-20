import { createRoot } from 'react-dom/client';

import App from './App';

const rootEl = document.getElementById('root')!;

/**
 * Pages are prerendered at build time (script/prerender.ts), so the markup is
 * already in the document. Capture it before React mounts and hand it to the
 * app, which re-adopts it instead of fetching the page over the network.
 */
const prerendered = rootEl.dataset.prerendered === '1';
const prerenderedHtml = prerendered ? rootEl.innerHTML : '';
const prerenderedRoute = rootEl.dataset.route ?? '';

createRoot(rootEl).render(
  <App
    prerenderedHtml={prerenderedHtml}
    prerenderedRoute={prerenderedRoute}
  />,
);
