/** Shared HTML/text helpers used by the build scripts. */

export type RouteMeta = {
  file: string;
  title: string;
  description?: string;
  ogImage?: string;
  bodyClass: string;
};

export type RouteRedirect = { redirect: string };

export type RouteEntry = RouteMeta | RouteRedirect;

export type Routes = Record<string, RouteEntry>;

export function isRedirect(entry: RouteEntry): entry is RouteRedirect {
  return 'redirect' in entry;
}

export function escHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escXml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201C',
  rdquo: '\u201D',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(Number(dec)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** First meaningful paragraph, trimmed to ~158 characters. */
export function extractDescription(html: string): string {
  const cleaned = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  for (const match of cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 50 || text.includes(' / ')) continue;
    return truncate(text, 158);
  }
  return truncate(stripTags(cleaned), 158);
}

/** First content image in the page, skipping chrome (logo/icon/menu). */
export function extractOgImage(html: string): string {
  const skip = /logo|favicon|menu-image|icon/i;
  for (const match of html.matchAll(
    /src=["']([^"']+\.(?:webp|jpg|jpeg|png))["']/gi,
  )) {
    const src = match[1];
    if (skip.test(src)) continue;
    if (src.startsWith('/images/') || src.startsWith('/uploads/')) return src;
  }
  return '/images/og-image.png';
}

export function extractTitle(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const text = stripTags(h1[1]);
    if (text) return text;
  }
  return '';
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

/** Turn "/turfman-450-utility-vehicle-product/" into a stable slug. */
export function routeSlug(routePath: string): string {
  return routePath.replace(/^\/|\/$/g, '');
}
