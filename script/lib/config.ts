/**
 * Single source of truth for build-time site configuration.
 *
 * Everything here is resolved from environment variables at BUILD time and
 * baked into the generated static output — nothing is read at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const publicDir = path.join(projectRoot, 'public');
export const contentDir = path.join(publicDir, 'content');
export const dataDir = path.join(publicDir, 'data');
export const srcDataDir = path.join(projectRoot, 'src', 'data');
export const distDir = path.join(projectRoot, 'dist');

/** Bare domain the site is published under, e.g. "tarautv.com". */
export const siteDomain = (process.env.SITE_DOMAIN || 'tarautv.com').replace(
  /^https?:\/\//,
  '',
).replace(/\/$/, '');

/** Scheme + host the site is published under, e.g. "https://tarautv.com". */
export const siteOrigin = `https://${siteDomain}`;

/**
 * Sub-path the site is served from.
 *   "/"            → custom domain or <user>.github.io
 *   "/<repo>/"     → project site (https://<user>.github.io/<repo>/)
 */
export const basePath = normalizeBase(process.env.BASE_PATH || '/');

function normalizeBase(value: string): string {
  let base = value.trim();
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  return base.replace(/\/{2,}/g, '/');
}

/** Prefix a root-relative site path with the configured base path. */
export function withBase(urlPath: string): string {
  if (!urlPath.startsWith('/')) return urlPath;
  if (basePath === '/') return urlPath;
  return basePath.replace(/\/$/, '') + urlPath;
}

/**
 * Absolute root of the published site — origin plus base path. Canonical
 * URLs, OG tags, and sitemaps must all be built from this, otherwise a
 * project site advertises URLs that drop the "/<repo>/" segment.
 */
export const siteBaseUrl = siteOrigin + basePath.replace(/\/$/, '');

/** Absolute, canonical URL for a root-relative route path. */
export function absoluteUrl(urlPath: string): string {
  if (/^https?:\/\//.test(urlPath)) return urlPath;
  return siteBaseUrl + (urlPath.startsWith('/') ? urlPath : '/' + urlPath);
}

/** Contact details used for every CTA on the site. */
export const contact = {
  email: process.env.CONTACT_EMAIL || 'taradealership@gmail.com',
  phoneDisplay: process.env.CONTACT_PHONE || '1-844-844-3432',
  phoneTel: '+18448443432',
} as const;

/**
 * Third-party form endpoint (Formspree / Netlify / Google Forms).
 * Empty means the contact form degrades to a mailto: submission.
 */
export const formEndpoint = process.env.VITE_FORM_ENDPOINT || '';

/**
 * Custom domain for the published site, resolved in this order:
 *   1. CUSTOM_DOMAIN (set it to "" to publish without a custom domain)
 *   2. the committed ./CNAME file
 *   3. SITE_DOMAIN, but only when the site is served from "/"
 *
 * Empty means no CNAME is written. GitHub Pages wipes the published tree on
 * every deploy, so the file has to be re-emitted by each build.
 */
export const customDomain = resolveCustomDomain();

function resolveCustomDomain(): string {
  if (process.env.CUSTOM_DOMAIN !== undefined) {
    return process.env.CUSTOM_DOMAIN.trim();
  }
  const committed = path.join(projectRoot, 'CNAME');
  if (fs.existsSync(committed)) {
    return fs.readFileSync(committed, 'utf8').trim();
  }
  return basePath === '/' ? siteDomain : '';
}
