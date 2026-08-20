---
name: UTV rebrand
description: Site rebranded from taragolfcart.com golf carts to tarautv.com "TARA Utility Task Vehicles (UTV)" — rules for keeping content consistent.
---

Rebrand (Aug 2026): the whole site is now "TARA Utility Task Vehicles (UTV)" at tarautv.com. Target SEO keyword: "TARA Utility Task Vehicles (UTV)" — kept in every page title/header/meta via the brand string.

**Rules:**
- No "golf cart", "Neighborhood Electric Vehicle", "NEV", or "taragolfcart" wording anywhere in visible text, titles, alt text, or metadata. Generic mentions use "utility task vehicle (UTV)".
- Product/category slugs are now UTV-based (`/…-utv-product/`, `/fleet-utvs/`); old golf-cart slugs live on ONLY as redirects, kept in lockstep in FOUR places: `public/content/routes.json`, `server.mjs` REDIRECTS, `vite.config.ts` DEV_REDIRECTS, and content-file names. News article slugs (~370) still contain `golf`; renaming them is deliberate future work.
- Logo is `tara-utv-logo.png`; the old `tara-nev-logo.png` file is kept on disk for external hotlinks but must not be referenced in code/content.
- Home hero slider uses UTV-scene images (`hero-cream-utv-lakeside`, `hero-mountain-trail-utv`, `hero-black-utv-ranch` + existing utility scenes); no golf-course hero photos.
- **Why:** client rebrand + SEO; slug changes 404 pages unless routes.json, both redirect maps, internal links, and sitemaps change together.
- **How to apply:** after any merge or content regeneration, re-grep for `golf cart`, `Neighborhood Electric`, `\bNEV\b`, `taragolfcart` in `public/content`, `index.html`, `src` — merges have re-introduced old content before (see client-requested-removals).
- Inquiry email recipient is now taradealership@gmail.com (dealership CTA line: 1-844-844-3432).
