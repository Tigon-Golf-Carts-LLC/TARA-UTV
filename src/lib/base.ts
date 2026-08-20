/** Base path the site is served from ("/" or "/<repo>/"), set at build time. */
export const BASE: string = import.meta.env.BASE_URL;

/** Prefix a root-relative site path with the base path. */
export function withBase(urlPath: string): string {
  if (!urlPath.startsWith('/')) return urlPath;
  const prefix = BASE.replace(/\/$/, '');
  if (!prefix) return urlPath;
  return prefix + urlPath;
}
