---
name: Mega-menu edit quirks
description: What to watch for when editing the Vehicles mega-menu across public/content/*.html
---
The Vehicles mega-menu is duplicated in every one of the ~578 `public/content/*.html` files — there is no single source. Edits must be scripted across all files.

**Why:** ~18 legacy-layout pages (old product pages like harmony-product, horizon/lander, t3-*-product, plus a few news/support pages) carry a *different*, tab-indented menu variant with an outdated T2 submenu (Horizon/Lander instead of Turfman). Regexes written against the standard menu silently skip them.

**How to apply:** after any scripted menu change, grep for stale menu-item IDs and for model names that should no longer appear (e.g. `horizon`, `lander`) — and remember lines may be tab-indented, so allow leading whitespace (`\s*`) in line-anchored regexes. Site is now T2/Turfman-only in nav, footer (src/App.tsx), home.html, fleet-utvs.html; canonical T2 submenu items are menu-item-3477/3479/3481/3483.
