/**
 * Rebuild title, description, and social-preview image metadata from the
 * extracted HTML pages. Run after adding or substantially rewriting content.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const routesPath = path.join(root, 'public/content/routes.json');
const siteImageFallback = '/images/og-image.png';
const homeImage = '/images/favicon.png';
const maxTitleLength = 60;
const maxDescriptionLength = 155;

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const curatedDescriptions = {
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

function cleanText(value = '') {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseSlug(route) {
  const leaf = route.replace(/^\/|\/$/g, '').split('/').at(-1) || 'TARA UTV';
  return leaf
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortenTitle(title) {
  if (title.length <= maxTitleLength) return title;
  const suffix = ' | TARA UTV';
  const usable = maxTitleLength - suffix.length;
  const clipped = title.slice(0, usable).replace(/\s+\S*$/, '').trim();
  return `${clipped || title.slice(0, usable).trim()}${suffix}`;
}

function makeTitle(h1, route, existingTitle) {
  const normalizedExisting = cleanText(existingTitle);
  if (normalizedExisting) return shortenTitle(normalizedExisting);

  const pageName = h1 || titleCaseSlug(route);
  return shortenTitle(`${pageName} | TARA UTV`);
}

function makeUniqueTitle(title, h1, route, existingTitle, usedTitles) {
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

function sentenceCandidates(content) {
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

function descriptionFromContent(title, content) {
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

function makeDescription(route, title, content, existingDescription) {
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

function imageFromContent(content) {
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

const usedTitles = new Map();
let updated = 0;

for (const [route, entry] of Object.entries(routes)) {
  if ('redirect' in entry) continue;

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
console.log(`Updated SEO metadata for ${updated} live routes.`);