/**
 * generate-seo.ts — build-time SEO generation.
 *
 * 1. Rebuilds per-route <title>, meta description, and social-preview image
 *    metadata in public/content/routes.json from the page content. The
 *    prerenderer reads that file to emit per-page <head> tags, canonical
 *    URLs, and OG/Twitter cards.
 * 2. Emits sitemap.xml, sitemap-pages.xml, and robots.txt into public/ so the
 *    copy step ships them at the root of dist/. Every absolute URL is built
 *    from SITE_DOMAIN, so switching domains is a one-variable change.
 *
 * Run with: npm run generate-seo
 */
import fs from 'node:fs';
import path from 'node:path';

import { absoluteUrl, contentDir, publicDir, siteBaseUrl } from './lib/config.ts';
import { escXml, isRedirect, type Routes } from './lib/html.ts';

const root = path.resolve(publicDir, '..');
const routesPath = path.join(contentDir, 'routes.json');
const siteImageFallback = '/images/og-image.png';
const homeImage = '/images/favicon.png';
const maxTitleLength = 60;
const maxDescriptionLength = 155;

const routes: Routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const curatedDescriptions: Record<string, string> = {
  '/about-us/': 'Meet TARA UTV, an authorized US dealer for lithium-powered electric utility task vehicles serving worksites, courses, resorts, and communities.',
  '/accessories/': 'Explore chargers, covers, seat kits, and other accessories designed to equip and protect your TARA utility task vehicle (UTV).',
  '/cases/': 'See how golf courses, resorts, communities, and commercial properties use TARA electric utility task vehicles in daily operations.',
  '/faqs/': 'Find answers about TARA electric utility task vehicle charging, lithium batteries, maintenance, warranties, registration, and dealer support.',
  '/fleet-utvs/': 'Compare TARA fleet utility task vehicles for courses, resorts, campuses, and large properties, including Turfman 450, 700, 700 EEC, and 1000.',
  '/maintenance-support/': 'Find TARA utility task vehicle maintenance guidance, service schedules, and support resources to keep your electric UTV performing reliably.',
  '/rambler-se2-product/': 'Explore the two-seat TARA Rambler SE2 electric utility task vehicle, including premium features, specifications, colors, and resort applications.',
  '/safety-information/': 'Review operating guidance, safety warnings, and best practices for driving, charging, and maintaining TARA electric utility task vehicles.',
  '/t2-series/': 'Compare TARA T2 electric UTVs for work and property operations: Turfman 450, Turfman 700, street-legal 700 EEC, and heavy-duty 1000.',
  '/technical-support/': 'Access TARA electric utility task vehicle troubleshooting resources, technical documentation, service guidance, and support information.',
  '/turfman-1000-utility-vehicle-product/': 'Meet the TARA Turfman 1000, a heavy-duty electric utility task vehicle built for high payloads, towing, and demanding commercial work.',
  '/turfman-450-utility-vehicle-product/': 'Meet the compact TARA Turfman 450 electric utility task vehicle, built for quiet, efficient groundskeeping and everyday property work.',
  '/turfman-700-eec-utility-vehicle-product/': 'Explore the street-legal TARA Turfman 700 EEC electric UTV for on-road work routes across communities, campuses, resorts, and properties.',
  '/turfman-700-utility-vehicle-product/': 'Explore the TARA Turfman 700 electric utility task vehicle, built with added power and payload capacity for larger properties and work crews.',
  '/vogue-2-product/': 'Explore the two-seat TARA Vogue 2 electric utility task vehicle, including its premium finishes, specifications, colors, and resort applications.',
  '/vogue-se2-product/': 'Explore the premium TARA Vogue SE2 electric utility task vehicle, including upgraded features, finishes, specifications, and available colors.',
  '/warranty-terms/': 'Review TARA utility task vehicle warranty terms, coverage details, responsibilities, and support for lithium-powered electric UTV models.',
  '/blog/': 'Read TARA UTV guides, comparisons, ownership advice, and stories about lithium-powered electric utility task vehicles and fleet operations.',
  '/financing/': 'Finance a TARA utility task vehicle with available 0% APR options, flexible monthly payments, same-day decisions, and six lending partners.',
};

function cleanText(value: string = ''): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_: string, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseSlug(route: string): string {
  const leaf = route.replace(/^\/|\/$/g, '').split('/').at(-1) || 'TARA UTV';
  return leaf
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortenTitle(title: string): string {
  if (title.length <= maxTitleLength) return title;
  const suffix = ' | TARA UTV';
  const usable = maxTitleLength - suffix.length;
  const clipped = title.slice(0, usable).replace(/\s+\S*$/, '').trim();
  return `${clipped || title.slice(0, usable).trim()}${suffix}`;
}

function makeTitle(h1: string, route: string, existingTitle: string): string {
  const normalizedExisting = cleanText(existingTitle);
  if (normalizedExisting) return shortenTitle(normalizedExisting);

  const pageName = h1 || titleCaseSlug(route);
  return shortenTitle(`${pageName} | TARA UTV`);
}

function makeUniqueTitle(
  title: string,
  h1: string,
  route: string,
  existingTitle: string,
  usedTitles: Map<string, string>,
): string {
  if (!usedTitles.has(title)) return title;

  // Preserve a pre-existing, content-specific title when a generic heading
  // such as "News" is shared by several archive pages.
  const normalizedExisting = /\|\s*TARA UTV$/i.test(existingTitle)
    ? shortenTitle(existingTitle)
    : shortenTitle(`${existingTitle} | TARA UTV`);
  if (existingTitle && !usedTitles.has(normalizedExisting)) {
    return normalizedExisting;
  }

  // Paginated archives and other repeated headings use the final route
  // segment as readable context (for example, "News — Page 12").
  const routeContext = titleCaseSlug(route);
  const contextualTitle = shortenTitle(`${h1 || title.replace(/\s*\|\s*TARA UTV$/i, '')} — ${routeContext} | TARA UTV`);
  if (!usedTitles.has(contextualTitle)) return contextualTitle;

  throw new Error(`Unable to create a unique title for ${route}: ${contextualTitle}`);
}

function sentenceCandidates(content: string): string[] {
  const paragraphs = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length >= 35)
    .filter((text) => !/^(all posts|hit enter to search|read more|learn more)$/i.test(text));

  const source = paragraphs.join(' ') || cleanText(content);
  return source
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35)
    .filter((sentence) => !/^(all posts|hit enter to search|read more|learn more)/i.test(sentence));
}

function descriptionFromContent(title: string, content: string): string {
  const topic = title.replace(/\s*\|\s*TARA UTV$/i, '').trim();
  const candidates = sentenceCandidates(content);
  const first = candidates[0] || `${topic} from TARA UTV.`;
  const second = candidates[1] || '';

  let description = first;
  if (description.length < 85 && second && `${description} ${second}`.length <= maxDescriptionLength) {
    description = `${description} ${second}`;
  }
  if (!description.toLowerCase().includes(topic.toLowerCase()) && `${topic}: ${description}`.length <= maxDescriptionLength) {
    description = `${topic}: ${description}`;
  }
  if (description.length <= maxDescriptionLength) return description;

  // Keep only complete source sentences; never create a broken or ellipsized
  // search snippet by cutting in the middle of a sentence.
  const complete = candidates.find((sentence) => sentence.length <= maxDescriptionLength);
  return complete || `${topic} from TARA UTV.`;
}

function makeDescription(
  route: string,
  title: string,
  content: string,
  existingDescription: string,
): string {
  if (curatedDescriptions[route]) return curatedDescriptions[route];

  const normalizedExisting = cleanText(existingDescription);
  const isStrongExistingDescription =
    normalizedExisting.length >= 60 &&
    normalizedExisting.length <= maxDescriptionLength &&
    /[.!?]$/.test(normalizedExisting) &&
    !/(?:\.\.\.|…|From TARA UTV, your US dealer)/i.test(normalizedExisting);

  return isStrongExistingDescription
    ? normalizedExisting
    : descriptionFromContent(title, content);
}

function imageFromContent(content: string): string {
  const imageMatches = [...content.matchAll(/<(?:img|source)\b[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)];
  for (const match of imageMatches) {
    const source = match[1].trim();
    if (!source.startsWith('/images/')) continue;
    if (/(tara-utv-logo|favicon|apple-touch-icon|block\.webp|loading|logo)/i.test(source)) continue;
    const localImage = path.join(root, 'public', source);
    if (fs.existsSync(localImage)) return source;
  }
  return siteImageFallback;
}

const usedTitles = new Map<string, string>();
let updated = 0;

for (const [route, entry] of Object.entries(routes)) {
  if (isRedirect(entry)) continue;

  if (route === '/') {
    entry.title = 'TARA Utility Task Vehicles';
    entry.description = 'lithium-powered electric utility task vehicles built for dependable performance on worksites, golf courses, resorts, neighborhoods, and communities.';
    entry.ogImage = homeImage;
    usedTitles.set(entry.title, route);
    updated += 1;
    continue;
  }

  const contentPath = path.join(root, 'public/content', entry.file);
  const html = fs.readFileSync(contentPath, 'utf8');
  const mainContent = html.split(/<\/header>/i).at(-1) || html;
  const h1 = cleanText(mainContent.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');

  const title = makeUniqueTitle(
    makeTitle(h1, route, entry.title || ''),
    h1,
    route,
    entry.title || '',
    usedTitles,
  );

  entry.title = title;
  entry.description = makeDescription(
    route,
    title,
    mainContent,
    entry.description || '',
  );
  entry.ogImage = imageFromContent(mainContent);
  usedTitles.set(title, route);
  updated += 1;
}

fs.writeFileSync(routesPath, `${JSON.stringify(routes, null, 1)}\n`);
console.log(`[generate-seo] Refreshed metadata for ${updated} route(s).`);

// ─── sitemaps ────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

function priorityFor(route: string): string {
  if (route === '/') return '1.0';
  if (/-product\/$/.test(route)) return '0.9';
  if (/^\/(t2-series|fleet-utvs|accessories|financing|contact)\/$/.test(route))
    return '0.9';
  if (/^\/(blog|news)\//.test(route)) return '0.6';
  return '0.7';
}

function changefreqFor(route: string): string {
  if (route === '/') return 'daily';
  if (/^\/(blog|news)\/?$/.test(route)) return 'weekly';
  return 'monthly';
}

// Canonical, indexable routes only — alias routes redirect, so advertising
// them as separate URLs would invite duplicate-content penalties.
const canonicalRoutes = Object.entries(routes).filter(
  (pair): pair is [string, Exclude<Routes[string], { redirect: string }>] =>
    !isRedirect(pair[1]),
);
canonicalRoutes.sort(([a], [b]) => a.localeCompare(b));

const pagesSitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  canonicalRoutes
    .map(
      ([route]) =>
        '  <url>\n' +
        `    <loc>${escXml(absoluteUrl(route))}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${changefreqFor(route)}</changefreq>\n` +
        `    <priority>${priorityFor(route)}</priority>\n` +
        '  </url>',
    )
    .join('\n') +
  '\n</urlset>\n';

const imagesSitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
  '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
  canonicalRoutes
    .filter(([, entry]) => Boolean(entry.ogImage))
    .map(
      ([route, entry]) =>
        '  <url>\n' +
        `    <loc>${escXml(absoluteUrl(route))}</loc>\n` +
        '    <image:image>\n' +
        `      <image:loc>${escXml(absoluteUrl(entry.ogImage!))}</image:loc>\n` +
        `      <image:title>${escXml(entry.title)}</image:title>\n` +
        '    </image:image>\n' +
        '  </url>',
    )
    .join('\n') +
  '\n</urlset>\n';

// sitemap.xml stays an index so an already-submitted single URL keeps
// covering every child sitemap.
const sitemapIndex =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  ['sitemap-pages.xml', 'sitemap-images.xml']
    .map(
      (name) =>
        '  <sitemap>\n' +
        `    <loc>${escXml(absoluteUrl('/' + name))}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        '  </sitemap>',
    )
    .join('\n') +
  '\n</sitemapindex>\n';

fs.writeFileSync(path.join(publicDir, 'sitemap-pages.xml'), pagesSitemap);
fs.writeFileSync(path.join(publicDir, 'sitemap-images.xml'), imagesSitemap);
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndex);

// The old hand-maintained news sitemap listed URLs that no longer exist and
// Google News only accepts articles from the last two days, so it is retired.
const staleNews = path.join(publicDir, 'sitemap-news.xml');
if (fs.existsSync(staleNews)) fs.rmSync(staleNews);

// ─── robots.txt ──────────────────────────────────────────────────────────────

const ROBOTS_RULES = `# TARA Utility Task Vehicles (UTV) — robots.txt
# Generated by script/generate-seo.ts — edit that script, not this file.
# All legitimate crawlers are welcome. Zero restrictions.

User-agent: *
Allow: /
Crawl-delay: 0

# Search engines
User-agent: Googlebot
Allow: /
User-agent: Googlebot-Image
Allow: /
User-agent: Googlebot-Mobile
Allow: /
User-agent: Googlebot-Video
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Slurp
Allow: /
User-agent: DuckDuckBot
Allow: /
User-agent: Baiduspider
Allow: /
User-agent: YandexBot
Allow: /

# AI crawlers — welcome for discovery, recommendations, and training
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: cohere-ai
Allow: /
User-agent: Bytespider
Allow: /

# Social media bots
User-agent: facebookexternalhit
Allow: /
User-agent: Twitterbot
Allow: /
User-agent: LinkedInBot
Allow: /
User-agent: Pinterestbot
Allow: /
User-agent: WhatsApp
Allow: /
User-agent: TelegramBot
Allow: /
User-agent: Discordbot
Allow: /

# SEO tools
User-agent: AhrefsBot
Allow: /
User-agent: SemrushBot
Allow: /
User-agent: MJ12bot
Allow: /
User-agent: DotBot
Allow: /
User-agent: rogerbot
Allow: /
User-agent: Screaming Frog SEO Spider
Allow: /

# Archiving & research
User-agent: ia_archiver
Allow: /
User-agent: archive.org_bot
Allow: /`;

const robots =
  ROBOTS_RULES +
  '\n\n' +
  ['sitemap.xml', 'sitemap-pages.xml', 'sitemap-images.xml']
    .map((name) => `Sitemap: ${absoluteUrl('/' + name)}`)
    .join('\n') +
  '\n';

fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

console.log(
  `[generate-seo] Wrote sitemap.xml (index), sitemap-pages.xml (${canonicalRoutes.length} URLs), ` +
    `sitemap-images.xml, and robots.txt for ${siteBaseUrl}`,
);
