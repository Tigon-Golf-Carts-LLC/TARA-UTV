/**
 * fetch-data.ts — build-time data snapshot.
 *
 * The site used to read its dynamic data from a same-origin Express API.
 * GitHub Pages serves files only, so every piece of that data is resolved
 * ONCE here, at build time, and written to plain JSON:
 *
 *   public/data/*.json   — snapshot served as static files
 *   src/data/*.json      — the same snapshot, imported into the bundle so the
 *                          app makes zero network calls for it at runtime
 *
 * Data sources, in priority order:
 *   1. A remote content API, if CONTENT_API_URL is set (key read from
 *      CONTENT_API_KEY — process.env is read HERE ONLY; no key is ever
 *      written into the snapshot or the client bundle).
 *   2. The committed page content under public/content (always available,
 *      so the build works fully offline and in CI without any secret).
 *
 * Run with: npm run fetch-data
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  contact,
  contentDir,
  dataDir,
  formEndpoint,
  publicDir,
  siteBaseUrl,
  siteDomain,
  siteOrigin,
  srcDataDir,
} from './lib/config.ts';
import {
  extractDescription,
  extractOgImage,
  extractTitle,
  isRedirect,
  routeSlug,
  stripTags,
  truncate,
  type RouteMeta,
  type Routes,
} from './lib/html.ts';

// ─── Types written into the snapshot ─────────────────────────────────────────

type Model = {
  slug: string;
  url: string;
  name: string;
  description: string;
  image: string;
  series: string;
  specs: Record<string, string>;
};

type Post = {
  slug: string;
  url: string;
  section: 'blog' | 'news';
  title: string;
  description: string;
  image: string;
};

type Snapshot = {
  generatedAt: string;
  source: 'remote-api' | 'local-content';
  site: {
    name: string;
    domain: string;
    origin: string;
    baseUrl: string;
    contact: { email: string; phoneDisplay: string; phoneTel: string };
    formEndpoint: string;
  };
  models: Model[];
  posts: Post[];
  nav: { label: string; url: string }[];
};

// ─── Remote source (optional) ────────────────────────────────────────────────

const remoteUrl = process.env.CONTENT_API_URL;
const remoteKey = process.env.CONTENT_API_KEY;

async function fetchRemote(): Promise<Partial<Snapshot> | null> {
  if (!remoteUrl) return null;
  const headers: Record<string, string> = { accept: 'application/json' };
  // The key stays in the build environment. It is used to authenticate this
  // request and is never persisted to any file the browser can read.
  if (remoteKey) headers.authorization = `Bearer ${remoteKey}`;

  try {
    const res = await fetch(remoteUrl, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as Partial<Snapshot>;
    console.log(`[fetch-data] Pulled snapshot from ${new URL(remoteUrl).host}`);
    return body;
  } catch (err) {
    console.warn(
      `[fetch-data] Remote fetch failed (${(err as Error).message}); ` +
        'falling back to committed content.',
    );
    return null;
  }
}

// ─── Local source: derive the snapshot from the committed page content ───────

function readRoutes(): Routes {
  const routesPath = path.join(contentDir, 'routes.json');
  if (!fs.existsSync(routesPath)) {
    throw new Error(`[fetch-data] routes.json not found at ${routesPath}`);
  }
  return JSON.parse(fs.readFileSync(routesPath, 'utf8')) as Routes;
}

/**
 * Pull the specification groups off a product page. The cloned pages present
 * them as accordion sections ("DIMENSIONS", "POWER", "FEATURES", …) and, on a
 * few pages, as two-column tables — both shapes are collected.
 */
function extractSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};

  for (const item of html.matchAll(
    /<div class="fl-accordion-item">([\s\S]*?)<\/div>\s*<\/div>/gi,
  )) {
    const label = item[1].match(
      /<span class="fl-accordion-button-label">([\s\S]*?)<\/span>/i,
    );
    const content = item[1].match(
      /<div class="fl-accordion-content[^"]*">([\s\S]*?)$/i,
    );
    if (!label || !content) continue;
    const key = stripTags(label[1]);
    const value = stripTags(content[1])
      .replace(/\s*•\s*/g, ' ')
      .trim();
    if (!key || !value) continue;
    specs[key] = truncate(value, 400);
  }

  // Premium pages (Rambler / Vogue) list feature highlights as a heading plus
  // a one-line description instead of a spec accordion.
  if (Object.keys(specs).length === 0) {
    const blocks = [
      ...html.matchAll(
        /fl-heading-text">([\s\S]*?)<\/span>([\s\S]*?)(?=fl-heading-text">|$)/gi,
      ),
    ];
    for (const block of blocks) {
      const key = stripTags(block[1]);
      if (!key || /^(vehicle highlights|product line)/i.test(key)) continue;
      const paragraph = block[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (!paragraph) continue;
      const value = stripTags(paragraph[1]);
      if (!value) continue;
      specs[key] = truncate(value, 400);
    }
  }

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (cell) => stripTags(cell[1]),
    );
    if (cells.length !== 2) continue;
    const [key, value] = cells;
    if (!key || !value || key.length > 60) continue;
    specs[key.replace(/[:\uFF1A]\s*$/, '')] = truncate(value, 400);
  }

  return specs;
}

function seriesFor(slug: string): string {
  if (/turfman/.test(slug)) return 'T2 Series';
  if (/vogue|rambler/.test(slug)) return 'Premium';
  return 'TARA';
}

function buildFromContent(routes: Routes): Snapshot {
  const models: Model[] = [];
  const posts: Post[] = [];

  for (const [routePath, entry] of Object.entries(routes)) {
    if (isRedirect(entry)) continue;
    const meta = entry as RouteMeta;
    const file = path.join(contentDir, meta.file);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');

    const slug = routeSlug(routePath);
    const description = meta.description || extractDescription(html);
    const image = meta.ogImage || extractOgImage(html);

    if (/-product\/$/.test(routePath)) {
      models.push({
        slug,
        url: routePath,
        name: meta.title.split('|')[0].trim() || extractTitle(html) || slug,
        description,
        image,
        series: seriesFor(slug),
        specs: extractSpecs(html),
      });
      continue;
    }

    if (routePath.startsWith('/blog/') || routePath.startsWith('/news/')) {
      posts.push({
        slug,
        url: routePath,
        section: routePath.startsWith('/blog/') ? 'blog' : 'news',
        title: meta.title.split('|')[0].trim() || extractTitle(html) || slug,
        description,
        image,
      });
    }
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  posts.sort((a, b) => a.title.localeCompare(b.title));

  return {
    generatedAt: new Date().toISOString(),
    source: 'local-content',
    site: {
      name: 'TARA Utility Task Vehicles',
      domain: siteDomain,
      origin: siteOrigin,
      baseUrl: siteBaseUrl,
      contact: {
        email: contact.email,
        phoneDisplay: contact.phoneDisplay,
        phoneTel: contact.phoneTel,
      },
      formEndpoint,
    },
    models,
    posts,
    nav: [
      { label: 'Home', url: '/' },
      { label: 'T2 Series', url: '/t2-series/' },
      { label: 'Fleet UTVs', url: '/fleet-utvs/' },
      { label: 'Accessories', url: '/accessories/' },
      { label: 'Financing', url: '/financing/' },
      { label: 'Blog', url: '/blog/' },
      { label: 'About Us', url: '/about-us/' },
      { label: 'Contact', url: '/contact/' },
    ],
  };
}

// ─── Write ───────────────────────────────────────────────────────────────────

function writeJson(dir: string, name: string, value: unknown) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, name),
    JSON.stringify(value, null, 2) + '\n',
    'utf8',
  );
}

async function main() {
  const routes = readRoutes();
  const local = buildFromContent(routes);
  const remote = await fetchRemote();

  const snapshot: Snapshot = remote
    ? { ...local, ...remote, source: 'remote-api', site: local.site }
    : local;

  // Guard: a secret must never reach a file that is published.
  const serialized = JSON.stringify(snapshot);
  for (const [name, value] of Object.entries(process.env)) {
    if (!/KEY|TOKEN|SECRET|PASSWORD/i.test(name)) continue;
    if (value && value.length > 7 && serialized.includes(value)) {
      throw new Error(
        `[fetch-data] Refusing to write snapshot: it contains the value of ${name}.`,
      );
    }
  }

  // Snapshot served as static files (also handy for third-party consumers).
  writeJson(dataDir, 'site.json', snapshot.site);
  writeJson(dataDir, 'models.json', snapshot.models);
  writeJson(dataDir, 'posts.json', snapshot.posts);
  writeJson(dataDir, 'snapshot.json', snapshot);

  // Same snapshot imported directly into the bundle → zero runtime fetches.
  writeJson(srcDataDir, 'site.json', snapshot.site);
  writeJson(srcDataDir, 'models.json', snapshot.models);
  writeJson(srcDataDir, 'posts.json', snapshot.posts);

  console.log(
    `[fetch-data] source=${snapshot.source} models=${snapshot.models.length} ` +
      `posts=${snapshot.posts.length} → ${path.relative(publicDir, dataDir)}/ and src/data/`,
  );
}

main().catch((err) => {
  console.error('[fetch-data] Fatal:', err);
  process.exit(1);
});
