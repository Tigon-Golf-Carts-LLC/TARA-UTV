import path from 'node:path';
import fs from 'node:fs';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

/**
 * Base path the site is published under.
 *   "/"        → custom domain or <user>.github.io
 *   "/<repo>/" → project site (https://<user>.github.io/<repo>/)
 */
const base = normalizeBase(process.env.BASE_PATH || '/');

function normalizeBase(value: string): string {
  let result = value.trim();
  if (!result.startsWith('/')) result = '/' + result;
  if (!result.endsWith('/')) result += '/';
  return result.replace(/\/{2,}/g, '/');
}

const projectRoot = path.resolve(import.meta.dirname);
const contentDir = path.join(projectRoot, 'public', 'content');

type RouteMeta = { file: string; title: string; bodyClass?: string };
type RouteEntry = RouteMeta | { redirect: string };

/**
 * Dev-only: mirror what the prerenderer does in production, so `npm run dev`
 * serves the same per-route HTML that ships to Pages.
 */
function devRoutes(): Plugin {
  return {
    name: 'tara-dev-routes',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!(req.headers.accept ?? '').includes('text/html')) return next();

        let reqPath = (req.url ?? '/').split('?')[0];
        const prefix = base.replace(/\/$/, '');
        if (prefix && reqPath.startsWith(prefix)) {
          reqPath = reqPath.slice(prefix.length) || '/';
        }
        if (reqPath.startsWith('/@') || reqPath.startsWith('/node_modules/')) {
          return next();
        }
        if (reqPath !== '/' && !reqPath.endsWith('/')) reqPath += '/';

        let routes: Record<string, RouteEntry>;
        try {
          routes = JSON.parse(
            fs.readFileSync(path.join(contentDir, 'routes.json'), 'utf8'),
          );
        } catch {
          return next();
        }

        const entry = routes[reqPath];
        if (!entry) return next();

        if ('redirect' in entry) {
          res.writeHead(301, { Location: prefix + entry.redirect });
          res.end();
          return;
        }

        const contentFile = path.join(contentDir, entry.file);
        if (!fs.existsSync(contentFile)) return next();

        try {
          const shell = await server.transformIndexHtml(
            reqPath,
            fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8'),
          );
          const content = fs.readFileSync(contentFile, 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(
            shell
              .replace(
                /<title>[^<]*<\/title>/i,
                `<title>${entry.title}</title>`,
              )
              .replace(
                '<div id="root"></div>',
                `<div id="root" data-prerendered="1" data-route="${reqPath}">${content}</div>`,
              ),
          );
        } catch {
          return next();
        }
      });
    },
  };
}

export default defineConfig({
  base,
  root: projectRoot,
  plugins: [react(), tailwindcss(), devRoutes()],
  resolve: {
    alias: { '@': path.join(projectRoot, 'src') },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.join(projectRoot, 'dist'),
    emptyOutDir: true,
    // public/ is copied by script/prerender.ts instead, which rewrites
    // root-relative URLs for the base path and drops unreferenced media.
    copyPublicDir: false,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
  preview: {
    port: Number(process.env.PORT) || 4173,
    host: true,
  },
});
