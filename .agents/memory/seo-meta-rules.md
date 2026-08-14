---
name: SEO meta rules for routes.json
description: Standards for page titles and meta descriptions in the tara-ev content mirror, and the rebuild requirement after meta edits.
---

Rule: every route's title stays ≤60 chars and unique (enforced by the removal-guard script against both source and built routes.json). Descriptions must be complete, self-contained sentences ≤155 chars — no ellipsis truncation, no "by admin on <date>" scrape noise, no generic "From TARA UTV, your US dealer…" boilerplate suffix.

**Why:** An earlier rebrand pass stripped leading digit tokens (e.g. "2-", "48V", "4×4") from news descriptions, leaving snippets that started mid-sentence in Google; mechanical truncation with "…" was rejected as still garbled — descriptions had to be rewritten as real sentences. The user cancelled a proposed permanent description guard, so only the title check is enforced.

**How to apply:** When editing metadata, rewrite rather than truncate. After any meta change, rebuild (build needs PORT set, e.g. `PORT=5000 pnpm run build`) — the guard also scans dist, and a stale pre-rebrand dist will fail it even when source is clean.
