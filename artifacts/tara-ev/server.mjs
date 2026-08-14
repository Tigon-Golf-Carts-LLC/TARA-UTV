/**
 * Production static server for TARA Electric Vehicles.
 * Issues HTTP 301 redirects for deprecated/duplicate URLs before serving
 * static files from the Vite build output, with SPA index.html fallback.
 */
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Canonical redirects for duplicate and typo product URLs.
// Each key is the old alias path; the value is the preferred canonical path.
const REDIRECTS = new Map([
  // Percent-encoding case duplicate: lowercase hex → uppercase canonical.
  // Must be matched against the raw (un-decoded) pathname so both variants
  // cannot both return HTTP 200 — the lowercase form redirects permanently.
  [
    '/news/a-complete-analysis-of-lsvs-what-are-low-speed-%e2%80%8b%e2%80%8bvehicles/',
    '/news/a-complete-analysis-of-lsvs-what-are-low-speed-%E2%80%8B%E2%80%8Bvehicles/',
  ],
  ['/explorer-2-2-product/', '/t2-series/'],
  ['/horizon-4-product/', '/t2-series/'],
  ['/horizon-6-product/', '/t2-series/'],
  ['/lander-4-product/', '/t2-series/'],
  ['/lander-6-product/', '/t2-series/'],
  ['/spirit-plus-product/', '/t2-series/'],
  ['/t3-2-2-product/', '/t2-series/'],
  ['/t3-22-product/', '/t2-series/'],
  ['/t3-2-2-lifted-product/', '/t2-series/'],
  ['/t3-22-lifted-product/', '/t2-series/'],
  // Old golf-cart-era slugs → new UTV-based slugs (rebrand).
  ['/explorer-2-2-golf-cart-product/', '/t2-series/'],
  ['/fleet-golf-carts/', '/fleet-utvs/'],
  ['/harmony-fleet-golf-cart-product/', '/t2-series/'],
  ['/horizon-4-golf-cart-product/', '/t2-series/'],
  ['/horizon-6-golf-cart-product/', '/t2-series/'],
  ['/lander-4-golf-cart-product/', '/t2-series/'],
  ['/lander-6-golf-cart-product/', '/t2-series/'],
  ['/roadster-2-2-golf-cart-product/', '/t2-series/'],
  ['/spirit-plus-fleet-golf-cart-product/', '/t2-series/'],
  ['/spirit-pro-fleet-golf-cart-product/', '/t2-series/'],
  ['/t3-2-2-golf-cart-product/', '/t2-series/'],
  ['/t3-2-2-lifted-golf-cart-product/', '/t2-series/'],
  ['/news/how-to-choose-fleet-golf-carts/', '/news/how-to-choose-fleet-utvs/'],
  ['/varranty-terms/', '/warranty-terms/'],
  ['/mainitenance-support/', '/maintenance-support/'],
  ['/techncal-support/', '/technical-support/'],
  // Retired T1/T3/Horizon/Lander model & series pages → current T2 lineup.
  ['/harmony-product/', '/t2-series/'],
  ['/harmony-fleet-utv-product/', '/t2-series/'],
  ['/spirit-pro-product/', '/t2-series/'],
  ['/spirit-pro-fleet-utv-product/', '/t2-series/'],
  ['/spirit-plus-fleet-utv-product/', '/t2-series/'],
  ['/roadster-2-2-product/', '/t2-series/'],
  ['/roadster-2-2-utv-product/', '/t2-series/'],
  ['/explorer-2-2-utv-product/', '/t2-series/'],
  ['/horizon-4-utv-product/', '/t2-series/'],
  ['/horizon-6-utv-product/', '/t2-series/'],
  ['/lander-4-utv-product/', '/t2-series/'],
  ['/lander-6-utv-product/', '/t2-series/'],
  ['/t3-2-2-utv-product/', '/t2-series/'],
  ['/t3-2-2-lifted-utv-product/', '/t2-series/'],
  ['/t1-series/', '/t2-series/'],
  ['/t3-series/', '/t2-series/'],
]);

const app = express();
const staticDir = path.join(__dirname, 'dist/public');

// 301 redirect middleware — must run before static file handler.
// Uses req.url (raw, un-decoded) for lookup so percent-encoding case
// variants are matched precisely before any URL decoding occurs.
app.use((req, res, next) => {
  // Extract raw path from URL, stripping query string.
  const rawPath = (req.url ?? '/').split('?')[0];
  // Normalize: add trailing slash for non-asset paths.
  const normalized =
    !rawPath.includes('.') && !rawPath.endsWith('/') ? rawPath + '/' : rawPath;

  const target = REDIRECTS.get(normalized);
  if (target) {
    res.redirect(301, target);
    return;
  }
  next();
});

// Serve built static assets (JS bundles, images, CSS, etc.).
app.use(express.static(staticDir, { index: false }));

// SPA fallback: all unmatched routes serve index.html so the React router
// can handle client-side navigation.
app.use((_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TARA EV server listening on port ${PORT}`);
});
