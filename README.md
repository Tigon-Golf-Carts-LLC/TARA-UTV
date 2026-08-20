# TARA Utility Task Vehicles — static site

A 100% static marketing site for GitHub Pages. There is no server, no API, and
no database: every page is prerendered to real HTML at build time and served as
files.

## Quick start

```bash
npm ci
npm run build      # fetch-data → generate-seo → vite build → prerender
npm run preview    # serve dist/ locally
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, serving per-route HTML like production does |
| `npm run fetch-data` | Resolves all dynamic data into `public/data/` + `src/data/` |
| `npm run generate-seo` | Rebuilds route metadata, sitemaps, and `robots.txt` |
| `npm run build` | Full pipeline: fetch-data → generate-seo → vite build → prerender |
| `npm run build:site` | Same as `build`, skipping the network fetch |
| `npm run preview` | Serves the built `dist/` |
| `npm run typecheck` | `tsc --noEmit` |

## Configuration

Everything is driven by environment variables read at **build time only**.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_DOMAIN` | `tarautv.com` | Bare domain for canonical URLs, OG tags, sitemaps |
| `BASE_PATH` | `/` | `/` for a custom domain or `<user>.github.io`; `/<repo>/` for a project site |
| `CUSTOM_DOMAIN` | contents of `./CNAME` | Domain written to `dist/CNAME`; set to `""` to publish without one |
| `VITE_FORM_ENDPOINT` | _(empty)_ | Third-party contact-form endpoint (Formspree/Netlify/Google Forms) |
| `CONTENT_API_URL` | _(empty)_ | Optional remote source for the data snapshot |
| `CONTENT_API_KEY` | _(empty)_ | Auth for that source — **never** shipped to the client |
| `PRUNE_UNUSED_IMAGES` | `1` | Set to `0` to publish every image in `public/images/` |

Publishing to a project site instead of the custom domain:

```bash
BASE_PATH=/TARA-UTV/ SITE_DOMAIN=tigon-golf-carts-llc.github.io CUSTOM_DOMAIN= npm run build
```

## How the static build works

```
script/fetch-data.ts    → public/data/*.json + src/data/*.json   (data snapshot)
script/generate-seo.ts  → routes.json metadata, sitemap*.xml, robots.txt
vite build              → dist/index.html + dist/assets/*        (no public/ copy)
script/prerender.ts     → dist/<route>/index.html for all 570 routes,
                          public/ copied with base-path rewriting,
                          404.html, .nojekyll, CNAME
```

* **Data** — the snapshot is imported directly into the bundle, so a rendered
  page issues no data request at all. `public/data/*.json` ships too, for
  anything that wants to read it as a file.
* **Routing** — every route, including alias redirects, gets a real
  `index.html`, so each URL is directly linkable and crawlable. `404.html` is
  the app shell with client routing live, so unmatched deep links still resolve.
* **Base path** — no absolute `/assets/...` paths survive the build. Root
  relative URLs in the page content, CSS, and the HTML shell are all rewritten
  to honour `BASE_PATH`.
* **Images** — media no page references is skipped (GitHub Pages caps a site at
  1 GB and `public/images/` holds ~1.3 GB). `build-report/missing-media.txt`
  lists references that point at files the repo does not contain.

## Deployment

`.github/workflows/deploy.yml` builds and publishes on every push to `main` and
on manual dispatch. In the repo: **Settings → Pages → Source: GitHub Actions**.
