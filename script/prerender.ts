/**
 * prerender.ts — turns the Vite bundle into a fully static GitHub Pages site.
 *
 * Runs AFTER `vite build` and does five things:
 *
 *   1. Copies public/ into dist/, rewriting every root-relative URL so it
 *      honours BASE_PATH, and skipping media no page references.
 *   2. Writes a real dist/<route>/index.html for every route in
 *      public/content/routes.json — including the dynamic detail pages
 *      (product, blog, news) generated from the snapshot — each with its own
 *      <title>, description, canonical URL, and OG/Twitter tags.
 *   3. Writes static redirect pages for alias routes (Pages cannot issue 301s).
 *   4. Writes dist/404.html — the app shell with client routing still live, so
 *      unknown deep links resolve instead of showing GitHub's 404.
 *   5. Writes dist/.nojekyll and, for a custom domain, dist/CNAME.
 *
 * Any failure exits non-zero so a broken site is never published.
 *
 * Run with: npm run prerender
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  basePath,
  contentDir,
  customDomain,
  distDir,
  projectRoot,
  publicDir,
  siteBaseUrl,
} from './lib/config.ts';
import {
  ALWAYS_KEEP,
  applyBase,
  collectReferencedMedia,
  isRewritable,
  withBase,
} from './lib/assets.ts';
import {
  escHtml,
  extractDescription,
  extractOgImage,
  isRedirect,
  type RouteMeta,
  type Routes,
} from './lib/html.ts';

const shellPath = path.join(distDir, 'index.html');

// ─── Preconditions ───────────────────────────────────────────────────────────

if (!fs.existsSync(shellPath)) {
  console.error(
    `[prerender] ERROR: ${shellPath} not found. Run \`vite build\` first.`,
  );
  process.exit(1);
}

const shellHtml = fs.readFileSync(shellPath, 'utf8');

if (/src=["'][^"']*\/src\/main\.tsx["']/.test(shellHtml)) {
  console.error(
    '[prerender] ERROR: dist/index.html still references /src/main.tsx — the\n' +
      '  Vite build did not produce a bundled shell.',
  );
  process.exit(1);
}

const bundleMatch = shellHtml.match(/src=["']([^"']+\.js)["']/);
if (!bundleMatch) {
  console.error(
    '[prerender] ERROR: dist/index.html has no <script src="...js"> tag.',
  );
  process.exit(1);
}

const routesPath = path.join(contentDir, 'routes.json');
if (!fs.existsSync(routesPath)) {
  console.error(`[prerender] ERROR: routes.json not found at ${routesPath}`);
  process.exit(1);
}
const routes: Routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

// ─── 1. Copy public/ → dist/ ─────────────────────────────────────────────────

const pruneMedia = process.env.PRUNE_UNUSED_IMAGES !== '0';
const referenced = collectReferencedMedia([shellHtml]);
for (const keep of ALWAYS_KEEP) referenced.add(keep);

let copied = 0;
let skipped = 0;
let skippedBytes = 0;

function copyTree(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyTree(source, target);
      continue;
    }

    const sitePath =
      '/' + path.relative(publicDir, source).split(path.sep).join('/');

    // Media the built site never requests is not worth publishing — GitHub
    // Pages caps a site at 1 GB and this repo carries far more than that.
    const isMedia = /^\/(images|uploads)\//.test(sitePath);
    if (pruneMedia && isMedia && !referenced.has(sitePath)) {
      skipped++;
      skippedBytes += fs.statSync(source).size;
      continue;
    }

    if (isRewritable(source)) {
      fs.writeFileSync(target, applyBase(fs.readFileSync(source, 'utf8')));
    } else {
      fs.copyFileSync(source, target);
    }
    copied++;
  }
}

copyTree(publicDir, distDir);
console.log(
  `[prerender] Copied ${copied} public file(s)` +
    (skipped
      ? ` — skipped ${skipped} unreferenced media file(s) (${(skippedBytes / 1e6).toFixed(0)} MB)`
      : ''),
);

// Report media the pages link to but the repo does not contain. These are
// pre-existing gaps in the imported content, so they warn rather than fail.
const missingMedia = [...referenced]
  .filter((ref) => !fs.existsSync(path.join(publicDir, ref.replace(/^\//, ''))))
  .sort();

if (missingMedia.length) {
  const reportDir = path.join(projectRoot, 'build-report');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, 'missing-media.txt'),
    missingMedia.join('\n') + '\n',
    'utf8',
  );
  console.warn(
    `[prerender] WARNING: ${missingMedia.length} referenced media file(s) are missing ` +
      'from public/ and will 404 (e.g. ' +
      missingMedia.slice(0, 3).join(', ') +
      '). Full list: build-report/missing-media.txt',
  );
}

// ─── 2. Per-route HTML ───────────────────────────────────────────────────────

function replaceTag(html: string, pattern: RegExp, replacement: string) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function buildPage(
  routePath: string,
  meta: RouteMeta,
  contentHtml: string,
): string {
  const title = meta.title || 'TARA Utility Task Vehicles';
  const description = meta.description || extractDescription(contentHtml);
  const ogImage = meta.ogImage || extractOgImage(contentHtml);
  const canonicalUrl = `${siteBaseUrl}${routePath}`;
  const absoluteOgImage = ogImage.startsWith('http')
    ? ogImage
    : `${siteBaseUrl}${ogImage}`;

  let html = shellHtml;
  html = replaceTag(
    html,
    /<title>[^<]*<\/title>/i,
    `<title>${escHtml(title)}</title>`,
  );
  html = replaceTag(
    html,
    /<meta\s+name="description"[^>]*\/?>/i,
    `<meta name="description" content="${escHtml(description)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name="image"[^>]*\/?>/i,
    `<meta name="image" content="${escHtml(absoluteOgImage)}" />`,
  );
  html = replaceTag(
    html,
    /<link\s+rel="canonical"[^>]*\/?>/i,
    `<link rel="canonical" href="${escHtml(canonicalUrl)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:title"[^>]*\/?>/i,
    `<meta property="og:title" content="${escHtml(title)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:description"[^>]*\/?>/i,
    `<meta property="og:description" content="${escHtml(description)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:image"[^>]*\/?>/i,
    `<meta property="og:image" content="${escHtml(absoluteOgImage)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:url"[^>]*\/?>/i,
    `<meta property="og:url" content="${escHtml(canonicalUrl)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"[^>]*\/?>/i,
    `<meta name="twitter:title" content="${escHtml(title)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"[^>]*\/?>/i,
    `<meta name="twitter:description" content="${escHtml(description)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:image"[^>]*\/?>/i,
    `<meta name="twitter:image" content="${escHtml(absoluteOgImage)}" />`,
  );

  // Bake the page content into the shell. Crawlers (and users with JS off)
  // get the full page; the React bundle adopts this markup instead of
  // re-fetching it, so a rendered page makes no data request at all.
  return html.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered="1" data-route="${escHtml(routePath)}">${applyBase(contentHtml)}</div>`,
  );
}

function outFileFor(routePath: string): string {
  const slug = routePath.replace(/^\/|\/$/g, '');
  return slug
    ? path.join(distDir, ...slug.split('/'), 'index.html')
    : path.join(distDir, 'index.html');
}

function write(file: string, contents: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

let pages = 0;
let redirects = 0;

for (const [routePath, entry] of Object.entries(routes)) {
  if (isRedirect(entry)) {
    // Pages has no server, so an alias becomes a tiny HTML page that points
    // crawlers at the canonical URL and moves browsers there immediately.
    const target = withBase(entry.redirect);
    write(
      outFileFor(routePath),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <link rel="canonical" href="${escHtml(siteBaseUrl + entry.redirect)}" />
    <meta name="robots" content="noindex, follow" />
    <meta http-equiv="refresh" content="0; url=${escHtml(target)}" />
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <p>This page has moved to <a href="${escHtml(target)}">${escHtml(entry.redirect)}</a>.</p>
  </body>
</html>
`,
    );
    redirects++;
    continue;
  }

  const contentFile = path.join(contentDir, entry.file);
  if (!fs.existsSync(contentFile)) {
    console.error(
      `[prerender] ERROR: content file missing for route "${routePath}": ${entry.file}`,
    );
    process.exit(1);
  }
  write(
    outFileFor(routePath),
    buildPage(routePath, entry, fs.readFileSync(contentFile, 'utf8')),
  );
  pages++;
}

console.log(
  `[prerender] Wrote ${pages} route page(s) and ${redirects} redirect page(s).`,
);

// ─── 3. 404.html ─────────────────────────────────────────────────────────────

// The shell WITHOUT baked content: client routing is still live, so a deep
// link GitHub could not match on disk is resolved by the app from the static
// route manifest rather than dead-ending.
write(path.join(distDir, '404.html'), shellHtml);

// ─── 4. .nojekyll ────────────────────────────────────────────────────────────

// Without this, Pages runs Jekyll and drops every file or folder starting "_".
write(path.join(distDir, '.nojekyll'), '');

// ─── 5. CNAME ────────────────────────────────────────────────────────────────

// Pages wipes the published tree on each deploy, so the custom-domain file has
// to be re-emitted by every build.
if (customDomain) {
  write(path.join(distDir, 'CNAME'), customDomain + '\n');
  console.log(`[prerender] Wrote CNAME → ${customDomain}`);
} else {
  const stale = path.join(distDir, 'CNAME');
  if (fs.existsSync(stale)) fs.rmSync(stale);
  console.log('[prerender] No custom domain configured — CNAME not written.');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const required = ['index.html', '404.html', '.nojekyll', 'sitemap.xml', 'robots.txt'];
const missing = required.filter((f) => !fs.existsSync(path.join(distDir, f)));
if (missing.length) {
  console.error(`[prerender] ERROR: dist/ is missing ${missing.join(', ')}`);
  process.exit(1);
}

console.log(
  `[prerender] Done. base="${basePath}" site="${siteBaseUrl}" out="${path.relative(projectRoot, distDir)}/"`,
);
