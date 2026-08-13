---
name: UTV rebrand
description: Site rebranded from taragolfcart.com golf carts to tarautv.com "TARA Utility Task Vehicles (UTV)" — rules for keeping content consistent.
---

Rebrand (Aug 2026): the whole site is now "TARA Utility Task Vehicles (UTV)" at tarautv.com. Target SEO keyword: "TARA Utility Task Vehicles (UTV)" — kept in every page title/header/meta via the brand string.

**Rules:**
- No "golf cart", "Neighborhood Electric Vehicle", "NEV", or "taragolfcart" wording anywhere in visible text, titles, alt text, or metadata. Generic mentions use "utility task vehicle (UTV)".
- URL slugs, route paths, and image filenames still contain `golf-cart` / `nev` (e.g. `/explorer-2-2-golf-cart-product/`, `tara-nev-logo.png`) — intentionally untouched so routes and assets keep working. Do NOT "fix" them without also updating routes.json and all links.
- **Why:** client rebrand + SEO; changing slugs would 404 every internal link and image.
- **How to apply:** after any merge or content regeneration, re-grep for `golf cart`, `Neighborhood Electric`, `\bNEV\b`, `taragolfcart` in `public/content`, `index.html`, `src` — merges have re-introduced old content before (see client-requested-removals).
- Inquiry email recipient is now sales@tarautv.com.
