/**
 * Static-asset helpers: base-path rewriting and reference collection.
 *
 * GitHub Pages serves a project site from "/<repo>/", so every root-relative
 * URL baked into the cloned page content ("/images/...", "/about-us/") has to
 * be re-pointed at build time. Nothing rewrites at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';

import { basePath, contentDir, publicDir } from './config.ts';

/** File types whose contents carry root-relative URLs. */
const REWRITABLE = new Set(['.html', '.css', '.xml', '.json', '.webmanifest']);

/**
 * Files whose "/..."-looking strings are route keys, not URLs. The app adds
 * the base prefix to these itself, so rewriting them would double it up.
 */
const NEVER_REWRITE = new Set([
  path.join(contentDir, 'routes.json'),
  path.join(publicDir, 'data', 'site.json'),
  path.join(publicDir, 'data', 'models.json'),
  path.join(publicDir, 'data', 'posts.json'),
  path.join(publicDir, 'data', 'snapshot.json'),
]);

export function isRewritable(sourcePath: string): boolean {
  if (NEVER_REWRITE.has(sourcePath)) return false;
  return REWRITABLE.has(path.extname(sourcePath).toLowerCase());
}

const prefix = basePath.replace(/\/$/, '');

/** Prefix one root-relative URL with the base path. */
export function withBase(url: string): string {
  if (!prefix) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (url.startsWith(prefix + '/') || url === prefix) return url;
  return prefix + url;
}

const ATTR_RE =
  /\b(href|src|data-src|data-original|action|poster|content|formaction)=("|')(\/(?!\/)[^"']*)\2/gi;
const SRCSET_RE = /\b(srcset|data-srcset)=("|')([^"']*)\2/gi;
const CSS_URL_RE = /url\(\s*("|'|)(\/(?!\/)[^)"']*)\1\s*\)/gi;

/**
 * Rewrite every root-relative URL in a text asset so it honours the base path.
 * A no-op when the site is published at "/".
 */
export function applyBase(text: string): string {
  if (!prefix) return text;
  return text
    .replace(ATTR_RE, (_m, attr, q, url) => `${attr}=${q}${withBase(url)}${q}`)
    .replace(SRCSET_RE, (_m, attr, q, value) => {
      const rewritten = value
        .split(',')
        .map((candidate: string) => {
          const trimmed = candidate.trim();
          if (!trimmed) return trimmed;
          const [url, ...rest] = trimmed.split(/\s+/);
          return [withBase(url), ...rest].join(' ');
        })
        .filter(Boolean)
        .join(', ');
      return `${attr}=${q}${rewritten}${q}`;
    })
    .replace(CSS_URL_RE, (_m, q, url) => `url(${q}${withBase(url)}${q})`);
}

// ─── Reference collection (used to skip shipping unused media) ───────────────

const ASSET_ATTR_RE =
  /(?:href|src|data-src|data-original|content|poster)=["']([^"']+)["']|url\(\s*["']?([^)"']+)["']?\s*\)|["'](\/(?:images|uploads|fonts)\/[^"']+)["']/gi;

const MEDIA_ROOTS = ['/images/', '/uploads/', '/fonts/'];

function addRefs(text: string, into: Set<string>) {
  for (const match of text.matchAll(ASSET_ATTR_RE)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    for (const candidate of raw.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (!MEDIA_ROOTS.some((root) => url.startsWith(root))) continue;
      const clean = url.split('#')[0].split('?')[0];
      into.add(clean);
      try {
        into.add(decodeURIComponent(clean));
      } catch {
        /* malformed escape — the raw form is already recorded */
      }
    }
  }
}

/**
 * Every media file the built site can actually request: anything linked from
 * page content, CSS, the HTML shell, the app source, or the web manifest.
 */
export function collectReferencedMedia(extraTexts: string[] = []): Set<string> {
  const refs = new Set<string>();

  const scanDir = (dir: string, exts: string[]) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full, exts);
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        addRefs(fs.readFileSync(full, 'utf8'), refs);
      }
    }
  };

  scanDir(contentDir, ['.html', '.json']);
  scanDir(path.join(publicDir, 'css'), ['.css']);
  scanDir(path.join(publicDir, 'js'), ['.js']);
  scanDir(path.join(publicDir, 'data'), ['.json']);
  for (const file of ['manifest.json', 'browserconfig.xml', 'schema.json']) {
    const full = path.join(publicDir, file);
    if (fs.existsSync(full)) addRefs(fs.readFileSync(full, 'utf8'), refs);
  }
  for (const text of extraTexts) addRefs(text, refs);

  return refs;
}

/** Media that must ship even if no page happens to link it. */
export const ALWAYS_KEEP = [
  '/images/favicon.png',
  '/images/apple-touch-icon.png',
  '/images/og-image.png',
  '/images/tara-utv-logo.png',
];
