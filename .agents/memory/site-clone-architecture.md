---
name: TARA site clone architecture
description: How the taragolfcart.com clone is structured and how to edit it
---
The tara-ev artifact is a static content mirror, not a component-based React app.
**Why:** 650 pages (575 blog posts) share WordPress templates; per-page HTML + original CSS/jQuery gives pixel-exact fidelity.
**How to apply:** Edit page text in `artifacts/tara-ev/public/content/<slug>.html` (slug = URL path with `/`→`__`). Routes/titles in `content/routes.json`. Never point asset URLs back at cdn.globalso.com — everything is localized under `public/images|css|fonts|js`.

- Brand: site is now "TARA UTV" (see utv-rebrand.md); the earlier NEV brand and its logo are retired and guarded against by verify-removals.sh.
- `pnpm run build` needs `PORT` set (vite.config.ts requires it even for build); use e.g. `PORT=5000 pnpm run build`. Build also runs verify-removals.sh --require-dist, which checks removals AND routes.json title limits (≤60 chars, unique) in source and dist.
- dist/public can be stale pre-rebrand output that fails verify-removals; rebuild before trusting dist-based check failures.
