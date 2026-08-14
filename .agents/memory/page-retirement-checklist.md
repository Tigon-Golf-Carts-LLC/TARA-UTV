---
name: Page retirement checklist
description: What "retire a page" means on the tara-ev static clone — beyond routes/redirects.
---
Retiring a URL on tara-ev requires ALL of: routes.json redirect entry + server.mjs REDIRECTS + vite DEV_REDIRECTS (lockstep), deleting the public/content/*.html source (it is otherwise served raw at /content/<file>.html with HTTP 200), pruning every sitemap-*.xml, rewriting in-content hrefs (aliases AND canonicals, including absolute tarautv.com and space-prefixed hrefs), and scrubbing the AI/SEO manifests (ai/gpt/claude/training/llms/llms-full/nlp/seo/compliance .txt) which list models and key-page URLs.
**Why:** completion review rejected a retirement that left /content/*.html files servable and T1/T3 URLs in the AI manifests.
**How to apply:** whenever removing or renaming a page/model, grep public/*.txt and public/content/<slug>.html too, then curl both the pretty URL (expect 301) and /content/<file>.html (expect no retired content).
